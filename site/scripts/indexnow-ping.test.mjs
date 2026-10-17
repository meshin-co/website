import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';

import {
  changedRoutes,
  keyIsServed,
  pageDigests,
  pageFingerprint,
  pingIndexNow,
  publishedKey,
  run,
} from './indexnow-ping.mjs';

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

test('changedRoutes reports added, removed, edited and unchanged routes', () => {
  const before = { '/': 'a', '/about': 'b', '/faq': 'c' };
  const after = { '/': 'a', '/blog/post': 'd', '/faq': 'x' };

  assert.deepEqual(changedRoutes(before, after), {
    added: ['/blog/post'],
    removed: ['/about'],
    edited: ['/faq'],
    changed: true,
  });
  assert.deepEqual(changedRoutes(before, before), { added: [], removed: [], edited: [], changed: false });
});

test('the fingerprint follows the words on the page and ignores build-hashed asset names', () => {
  const asset = (hash) =>
    `<link href="/_astro/PageLayout.${hash}.css"><p class="astro-cid-${hash.toLowerCase()}">same</p>`;
  assert.equal(pageFingerprint(asset('BS6wqQC3')), pageFingerprint(asset('Zx9kLm2P')));
  assert.notEqual(pageFingerprint('<p>same</p>'), pageFingerprint('<p>same.</p>'));
  assert.notEqual(
    pageFingerprint('<img src="/_astro/og-default.BELzXGOL.png">'),
    pageFingerprint('<img src="/_astro/og-other.BELzXGOL.png">')
  );
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

test('run skips without side effects when nothing was added, removed or edited', async () => {
  const dist = await makeDist(['/', '/about']);
  const previousPath = join(dist, 'previous.json');
  const state = `${JSON.stringify(await pageDigests(dist, ['/', '/about']), null, 2)}\n`;
  await writeFile(previousPath, state);

  const result = await run({ distDir: dist, previousPath, key: 'the-key-0123', fetchImpl: explodingFetch });

  assert.deepEqual(result, { action: 'skipped', reason: 'unchanged' });
  assert.equal(await readFile(previousPath, 'utf8'), state);
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
  assert.deepEqual(JSON.parse(await readFile(previousPath, 'utf8')), await pageDigests(dist, ['/', '/about']));
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
  await writeFile(previousPath, `${JSON.stringify({ '/retired-page': 'x' }, null, 2)}\n`);

  const { stdout } = await runFile(process.execPath, [
    'scripts/indexnow-ping.mjs',
    dist,
    '--previous',
    previousPath,
    '--dry-run',
  ]);

  assert.match(stdout, /dry-run.*3 url\(s\)/);
  assert.match(stdout, /added 3, removed 1, edited 0/);
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

async function announcedDist(pages) {
  const dist = await makeDist(Object.keys(pages));
  for (const [route, body] of Object.entries(pages)) await writePage(dist, route, body);
  await writeFile(join(dist, 'the-key-0123.txt'), 'the-key-0123');
  const previousPath = join(dist, 'previous.json');
  const first = fakeFetch(200);
  const result = await run({ distDir: dist, previousPath, fetchImpl: first, keyCheck: async () => true });
  assert.equal(result.action, 'pinged');
  return { dist, previousPath };
}

async function writePage(dist, route, body) {
  const file = route === '/' ? join(dist, 'index.html') : join(dist, `${route.slice(1)}.html`);
  await writeFile(file, body);
}

async function rerun({ dist, previousPath }) {
  const fetchImpl = fakeFetch(200);
  const result = await run({ distDir: dist, previousPath, fetchImpl, keyCheck: async () => true });
  return { result, fetchImpl };
}

const announcedUrls = (fetchImpl) => JSON.parse(fetchImpl.calls[0].options.body).urlList;

test('an edited page on an unchanged route is announced, even when its date was not bumped', async () => {
  const state = await announcedDist({
    '/': '<html><body>home</body></html>',
    '/blog/post': '<html><body><time>2026-10-07</time>first draft</body></html>',
  });
  await writePage(state.dist, '/blog/post', '<html><body><time>2026-10-07</time>rewritten</body></html>');

  const { result, fetchImpl } = await rerun(state);

  assert.equal(result.action, 'pinged');
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.edited, ['/blog/post']);
  assert.ok(announcedUrls(fetchImpl).includes('https://meshin.co/blog/post'));
});

test('an identical rebuild announces nothing and leaves the stored state untouched', async () => {
  const state = await announcedDist({ '/': '<html>home</html>', '/about': '<html>about</html>' });
  const stored = await readFile(state.previousPath, 'utf8');

  const { result, fetchImpl } = await rerun(state);

  assert.deepEqual(result, { action: 'skipped', reason: 'unchanged' });
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(await readFile(state.previousPath, 'utf8'), stored);
});

test('after an edit is announced, the next identical build announces nothing', async () => {
  const state = await announcedDist({ '/': '<html>home</html>' });
  await writePage(state.dist, '/', '<html>home, edited</html>');
  assert.equal((await rerun(state)).result.action, 'pinged');

  const { result, fetchImpl } = await rerun(state);

  assert.equal(result.reason, 'unchanged');
  assert.equal(fetchImpl.calls.length, 0);
});

test('a new route and a deleted route are announced alongside an unchanged page', async () => {
  const state = await announcedDist({ '/': '<html>home</html>', '/about': '<html>about</html>' });
  await writePage(state.dist, '/blog', '<html>blog</html>');
  await rm(join(state.dist, 'about.html'));

  const { result } = await rerun(state);

  assert.equal(result.action, 'pinged');
  assert.deepEqual(result.added, ['/blog']);
  assert.deepEqual(result.removed, ['/about']);
  assert.deepEqual(result.edited, []);
});

test('a rebuild that only re-hashes the asset filenames announces nothing', async () => {
  const page = (hash) =>
    `<html><head><link rel="stylesheet" href="/_astro/PageLayout.${hash}.css"><script type="module" src="/_astro/page.${hash}.js"></script></head><body class="astro-cid-${hash.toLowerCase()}">same words</body></html>`;
  const state = await announcedDist({ '/': page('BS6wqQC3') });
  await writePage(state.dist, '/', page('Zx9kLm2P'));

  const { result, fetchImpl } = await rerun(state);

  assert.equal(result.reason, 'unchanged');
  assert.equal(fetchImpl.calls.length, 0);
});

test('a state file written by the earlier route-list format is treated as nothing announced yet', async () => {
  const state = await announcedDist({ '/': '<html>home</html>' });
  await writeFile(state.previousPath, `${JSON.stringify(['/'], null, 2)}\n`);

  const { result } = await rerun(state);

  assert.equal(result.action, 'pinged');
  assert.deepEqual(result.added, ['/']);
});

test('only the routes that changed are announced, because the rest are already known', async () => {
  const { dist, previousPath } = await announcedDist({ '/': '<html>home</html>', '/about': '<html>about</html>' });
  await writePage(dist, '/about', '<html>about, rewritten</html>');

  const { result, fetchImpl } = await rerun({ dist, previousPath });

  assert.equal(result.action, 'pinged');
  assert.deepEqual(announcedUrls(fetchImpl), ['https://meshin.co/about']);
});

test('a removed route is not announced, because there is no page left to fetch', async () => {
  const { dist, previousPath } = await announcedDist({ '/': '<html>home</html>', '/gone': '<html>gone</html>' });
  await rm(join(dist, 'gone.html'), { force: true });

  const { result, fetchImpl } = await rerun({ dist, previousPath });

  assert.deepEqual(result.removed, ['/gone']);
  assert.deepEqual(announcedUrls(fetchImpl), []);
});
