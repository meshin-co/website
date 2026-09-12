import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';

import { changedRoutes, pingIndexNow, run } from './indexnow-ping.mjs';

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

  const result = await pingIndexNow({ host: 'meshin.co', key: 'the-key', urls: ['/', '/about'], fetchImpl });

  assert.deepEqual(result, { ok: true, status: 202 });
  const [call] = fetchImpl.calls;
  assert.equal(call.url, 'https://api.indexnow.org/indexnow');
  assert.equal(call.options.method, 'POST');
  assert.deepEqual(JSON.parse(call.options.body), {
    host: 'meshin.co',
    key: 'the-key',
    keyLocation: 'https://meshin.co/the-key.txt',
    urlList: ['https://meshin.co/', 'https://meshin.co/about'],
  });
});

test('run skips without side effects when the route set is unchanged', async () => {
  const dist = await makeDist(['/', '/about']);
  const previousPath = join(dist, 'previous.json');
  await writeFile(previousPath, `${JSON.stringify(['/', '/about'], null, 2)}\n`);

  const result = await run({ distDir: dist, previousPath, key: 'the-key', fetchImpl: explodingFetch });

  assert.deepEqual(result, { action: 'skipped', reason: 'unchanged' });
  assert.equal(JSON.stringify(JSON.parse(await readFile(previousPath, 'utf8'))), JSON.stringify(['/', '/about']));
});

test('run skips gracefully when the key is missing and keeps the announce pending', async () => {
  const dist = await makeDist(['/']);
  const previousPath = join(dist, 'previous.json');

  const result = await run({ distDir: dist, previousPath, key: undefined, fetchImpl: fakeFetch() });

  assert.equal(result.action, 'skipped');
  assert.equal(result.reason, 'missing-key');
  assert.deepEqual(result.added, ['/']);
  const files = await readdir(dist);
  assert.ok(!files.includes('previous.json'), 'route set must not be persisted before a ping');
});

test('run dry-run reports the plan without network or file writes', async () => {
  const dist = await makeDist(['/', '/about']);
  const previousPath = join(dist, 'previous.json');
  const exploding = async () => {
    throw new Error('network must not be touched in dry-run');
  };

  const result = await run({ distDir: dist, previousPath, key: 'the-key', dryRun: true, fetchImpl: exploding });

  assert.equal(result.action, 'dry-run');
  assert.deepEqual(result.added, ['/', '/about']);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.urls, ['/', '/about']);
  assert.ok(!(await readdir(dist)).includes('the-key.txt'));
  assert.ok(!(await readdir(dist)).includes('previous.json'));
});

test('run pings every route, serves the key file and persists the announced set', async () => {
  const dist = await makeDist(['/', '/about']);
  const previousPath = join(dist, 'previous.json');
  const fetchImpl = fakeFetch(200);

  const result = await run({ distDir: dist, previousPath, key: 'the-key', fetchImpl });

  assert.equal(result.action, 'pinged');
  assert.equal(result.count, 2);
  assert.equal(await readFile(join(dist, 'the-key.txt'), 'utf8'), 'the-key');
  assert.deepEqual(JSON.parse(await readFile(previousPath, 'utf8')), ['/', '/about']);
  assert.equal(fetchImpl.calls.length, 1);
});

test('run fails the step when the endpoint rejects the ping', async () => {
  const dist = await makeDist(['/']);
  const previousPath = join(dist, 'previous.json');

  const result = await run({ distDir: dist, previousPath, key: 'the-key', fetchImpl: fakeFetch(400) });

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
