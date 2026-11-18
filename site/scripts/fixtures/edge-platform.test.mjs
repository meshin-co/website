import assert from 'node:assert/strict';
import test from 'node:test';

import { etagFor, pagesPlatform, request } from './edge-platform.mjs';

const answer = (path, init) => pagesPlatform().fetch(request(path, undefined, init));

test('the slash form of a page is a 308 to the page, as production answered on 2026-11-15', async () => {
  for (const path of ['/about/', '/about//', '//about/', '//about//']) {
    const response = await answer(path);
    assert.equal(response.status, 308, path);
    assert.equal(response.headers.get('location'), '/about', path);
  }
});

test('the redirect keeps the query string', async () => {
  assert.equal((await answer('/about/?x=1')).headers.get('location'), '/about?x=1');
});

test('the home page has three more addresses, and each redirects to the root', async () => {
  for (const path of ['/index', '/index.html', '/index/']) {
    const response = await answer(path);
    assert.equal(response.status, 308, path);
    assert.equal(response.headers.get('location'), '/', path);
  }
});

test('the file name of a page redirects to the page', async () => {
  const response = await answer('/about.html');

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/about');
});

test('repeated slashes elsewhere in a path are served in place, with no redirect', async () => {
  for (const path of ['//about', '///about', '/services//sprint', '//', '///']) {
    assert.equal((await answer(path)).status, 200, path);
  }
});

test('a path no file answers is a 404 page, in its slash form as well', async () => {
  for (const path of ['//x/about', '/nope', '/nope/']) {
    const response = await answer(path);
    assert.equal(response.status, 404, path);
    assert.equal(await response.text(), '<html>not found</html>', path);
  }
});

test('a file that is not a page refuses the slash form, as production refused /about.md/ and /llms.txt/', async () => {
  for (const path of ['/about.md/', '/_astro/app.css/']) {
    assert.equal((await answer(path)).status, 404, path);
  }
});

test('a sidecar and a page at one route carry different validators', async () => {
  assert.notEqual(etagFor('/about'), etagFor('/about.md'));
  assert.equal((await answer('/about.md')).headers.get('etag'), etagFor('/about.md'));
});

test('the matching validator earns a 304 with no body, and HEAD never carries one', async () => {
  const revalidated = await answer('/about', { headers: { 'if-none-match': etagFor('/about') } });
  const head = await answer('/about', { method: 'HEAD' });

  assert.equal(revalidated.status, 304);
  assert.equal(revalidated.body, null);
  assert.equal(head.status, 200);
  assert.equal(head.body, null);
});

test('every request is recorded with its whole URL, so a test can see where a path pointed', async () => {
  const platform = pagesPlatform();

  await platform.fetch(request('//x/about'));

  assert.deepEqual(platform.asked, ['https://example.com//x/about']);
});
