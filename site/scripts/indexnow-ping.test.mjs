import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';

import { changedRoutes, keyIsServed, pingIndexNow, publishedKey, run } from './indexnow-ping.mjs';

const runFile = promisify(execFile);

async function makeDist(routes) {
  const dist = await mkdtemp(join(tmpdir(), 'indexnow-dist-'));
  for (const route of routes) {
    if (route === '/') {
      await writeFile(join(dist, 'index.html'), '<html></html>');
    } else {
      const file = join(dist, `${route.slice(1)}.html`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, '<html></html>');
    }
  }
  return dist;
}

function fakeFetch(status = 202) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return { ok: status >= 200 && status < 300, status };
  };
  impl.calls = calls;
  return impl;
}

test('changedRoutes reports added, removed and unchanged sets', () => {
  const before = ['/', '/about'];
  const after = ['/', '/blog/post'];

  assert.deepEqual(changedRoutes(before, after), { added: ['/blog/post'], removed: ['/about'], changed: true });
  assert.deepEqual(changedRoutes(before, before), { added: [], removed: [], changed: false });
});

test('pingIndexNow posts key, key location and absolute urls', async () => {
  const fetchImpl = fakeFetch(202);

  const result = await pingIndexNow({ host: 'meshin.co', key: 'the-key-0123', urls: ['/', '/about'], fetchImpl });

  assert.deepEqual(result, { ok: true, status: 202 });
  const [call] = fetchImpl.calls;
  assert.equal(call.url, 'https://api.indexnow.org/indexnow');
  assert.equal(call.options.method, 'POST');
  assert.deepEqual(JSON.parse(call.options.body), {
    host: 'meshin.co',
    key: 'the-key-0123',
    keyLocation: 'https://meshin.co/the-key-0123.txt',
    urlList: ['https://meshin.co/', 'https://meshin.co/about'],
  });
});

test('run skips without side effects when the route set is unchanged', async () => {
  const dist = await makeDist(['/', '/about']);
  const previousPath = join(dist, 'previous.json');
  await writeFile(previousPath, `${JSON.stringify(['/', '/about'], null, 2)}\n`);

  const result = await run({ distDir: dist, previousPath, key: 'the-key-0123', fetchImpl: explodingFetch });

  assert.deepEqual(result, { action: 'skipped', reason: 'unchanged' });
  assert.equal(JSON.stringify(JSON.parse(await readFile(previousPath, 'utf8'))), JSON.stringify(['/', '/about']));
});

test('run skips gracefully when the build publishes no key and keeps the announce pending', async () => {
  const dist = await makeDist(['/']);
  const previousPath = join(dist, 'previous.json');

  const result = await run({ distDir: dist, previousPath, fetchImpl: fakeFetch() });

  assert.equal(result.action, 'skipped');
  assert.equal(result.reason, 'missing-key');
  assert.deepEqual(result.added, ['/']);
  const files = await readdir(dist);
  assert.ok(!files.includes('previous.json'), 'route set must not be persisted before a ping');
});

test('the key is the one the build publishes, so it can never name a file the site does not serve', async () => {
  const dist = await makeDist(['/']);
  assert.equal(await publishedKey(dist), null);

  await writeFile(join(dist, 'deadbeefcafe1234.txt'), 'deadbeefcafe1234');
  assert.equal(await publishedKey(dist), 'deadbeefcafe1234');
});

test('a text file whose body does not equal its name is not a key, however much it looks like one', async () => {
  const dist = await makeDist(['/']);
  await writeFile(join(dist, 'robots.txt'), 'User-agent: *');
  await writeFile(join(dist, 'aabbccddeeff0011.txt'), 'something else');
  assert.equal(await publishedKey(dist), null);
});

test('run dry-run reports the plan without network or file writes', async () => {
  const dist = await makeDist(['/', '/about']);
  const previousPath = join(dist, 'previous.json');
  const exploding = async () => {
    throw new Error('network must not be touched in dry-run');
  };

  const result = await run({ distDir: dist, previousPath, dryRun: true, fetchImpl: exploding });

  assert.equal(result.action, 'dry-run');
  assert.deepEqual(result.added, ['/', '/about']);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.urls, ['/', '/about']);
  assert.ok(!(await readdir(dist)).includes('the-key-0123.txt'));
  assert.ok(!(await readdir(dist)).includes('previous.json'));
});

test('run pings every route with the published key and persists the announced set', async () => {
  const dist = await makeDist(['/', '/about']);
  const previousPath = join(dist, 'previous.json');
  await writeFile(join(dist, 'the-key-0123.txt'), 'the-key-0123');
  const fetchImpl = fakeFetch(200);

  const result = await run({ distDir: dist, previousPath, fetchImpl, keyCheck: async () => true });

  assert.equal(result.action, 'pinged');
  assert.equal(result.count, 2);
  assert.equal(JSON.parse(fetchImpl.calls[0].options.body).key, 'the-key-0123');
  assert.deepEqual(JSON.parse(await readFile(previousPath, 'utf8')), ['/', '/about']);
  assert.equal(fetchImpl.calls.length, 1);
});

test('run fails the step when the endpoint rejects the ping', async () => {
  const dist = await makeDist(['/']);
  const previousPath = join(dist, 'previous.json');

  await writeFile(join(dist, 'the-key-0123.txt'), 'the-key-0123');
  const result = await run({ distDir: dist, previousPath, fetchImpl: fakeFetch(400), keyCheck: async () => true });

  assert.equal(result.action, 'error');
  assert.deepEqual(result, { action: 'error', ok: false, status: 400 });
  assert.ok(!(await readdir(dist)).includes('previous.json'));
});

test('the cli dry-run exits zero over a real dist tree', async () => {
  const dist = await makeDist(['/', '/about', '/blog/post']);
  const previousPath = join(dist, 'previous.json');
  await writeFile(previousPath, `${JSON.stringify(['/retired-page'], null, 2)}\n`);

  const { stdout } = await runFile(process.execPath, [
    'scripts/indexnow-ping.mjs',
    dist,
    '--previous',
    previousPath,
    '--dry-run',
  ]);

  assert.match(stdout, /dry-run.*3 url\(s\)/);
  assert.match(stdout, /added 3, removed 1/);
});

const explodingFetch = async () => {
  throw new Error('network must not be touched when the route set is unchanged');
};

test('a key the live host does not serve is never announced', async () => {
  const serving = async () => ({ ok: true, text: async () => 'abcdefgh1234\n' });
  assert.equal(await keyIsServed({ host: 'meshin.co', key: 'abcdefgh1234', fetchImpl: serving }), true);

  const missing = async () => ({ ok: false, text: async () => 'Not found' });
  assert.equal(await keyIsServed({ host: 'meshin.co', key: 'abcdefgh1234', fetchImpl: missing }), false);

  const other = async () => ({ ok: true, text: async () => 'a different key' });
  assert.equal(await keyIsServed({ host: 'meshin.co', key: 'abcdefgh1234', fetchImpl: other }), false);

  const offline = async () => {
    throw new Error('getaddrinfo ENOTFOUND');
  };
  assert.equal(await keyIsServed({ host: 'meshin.co', key: 'abcdefgh1234', fetchImpl: offline }), false);
});

test('run stops before the endpoint when the host does not serve the key yet', async () => {
  const dist = await makeDist(['/']);
  const previousPath = join(dist, 'previous.json');
  await writeFile(join(dist, 'the-key-0123.txt'), 'the-key-0123');
  const fetchImpl = fakeFetch(200);
  fetchImpl.calls.length = 0;

  const result = await run({
    distDir: dist,
    previousPath,
    fetchImpl,
    keyCheck: async () => false,
  });

  assert.equal(result.action, 'skipped');
  assert.equal(result.reason, 'key-not-served');
  assert.equal(fetchImpl.calls.length, 0, 'nothing may reach the endpoint');
  const files = await readdir(dist);
  assert.ok(!files.includes('previous.json'), 'an unannounced route set must stay pending');
});
