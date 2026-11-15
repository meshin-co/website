import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { markdownSidecar } from './markdown-negotiation.mjs';
import { ORIGIN, SITE, etagFor, pagesPlatform, request } from './fixtures/edge-platform.mjs';

const MARKDOWN = 'text/markdown; charset=utf-8';
const ask = (path, accept, init) => worker.fetch(request(path, accept, init), { ASSETS: pagesPlatform() });

const SLASH_FORMS = [
  '/',
  '//',
  '///',
  '/about',
  '/about/',
  '/about//',
  '/about/./',
  '//about/',
  '//about//',
  '/about/?x=1',
  '/services//sprint',
  '/services/sprint/',
  '/spec/evals-baseline/1.0',
  '/spec/evals-baseline/1.0/',
  '/spec/evals-baseline/1.0//',
  '/index',
  '/index/',
  '/index.html',
  '/about.html',
  '/about.md/',
  '/nope',
  '/nope/',
  '//x',
  '//x/about',
  '//x/about/',
];

test('a run of slashes in a path is read as one, so no path can begin by naming a host', () => {
  assert.equal(markdownSidecar('//x'), '/x.md');
  assert.equal(markdownSidecar('///about'), '/about.md');
  assert.equal(markdownSidecar('/services//sprint'), '/services/sprint.md');
  assert.equal(markdownSidecar('//x/about/'), '/x/about.md');
  assert.equal(markdownSidecar('//'), '/index.md');
});

test('the asset binding is only ever asked for this origin, whatever the first segment of the path', async () => {
  for (const path of ['//x', '//x/about', '///about', '//about', '//about.md.example/about']) {
    const platform = pagesPlatform();
    await worker.fetch(request(path, 'text/markdown'), { ASSETS: platform });
    const hosts = platform.asked.map((href) => new URL(href).origin);
    assert.deepEqual([...new Set(hosts)], [ORIGIN], path);
  }
});

test('a path that begins with two slashes and names no page is answered as HTML answers it, never as markdown', async () => {
  for (const path of ['//x', '//x/about']) {
    const markdown = await ask(path, 'text/markdown');
    const html = await ask(path, 'text/html');
    assert.equal(markdown.status, html.status, path);
    assert.equal(markdown.status, 404, path);
    assert.equal(markdown.headers.get('content-type'), 'text/html; charset=utf-8', path);
    assert.equal(markdown.headers.get('content-location'), null, path);
  }
});

test('a path that begins with two slashes and names a page is served in place, labelled with its own address', async () => {
  for (const path of ['//about', '///about']) {
    const response = await ask(path, 'text/markdown');
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), MARKDOWN, path);
    assert.equal(response.headers.get('content-location'), '/about.md', path);
    assert.equal(await response.text(), '# About', path);
  }
});

test('no label the worker writes begins with two slashes, for any path it is given', async () => {
  for (const path of SLASH_FORMS) {
    const label = (await ask(path, 'text/markdown')).headers.get('content-location');
    assert.equal(label === null || /^\/(?!\/)/.test(label), true, `${path} was labelled ${label}`);
  }
});

test('the slash form of a page is the redirect the page answers, for markdown as for HTML', async () => {
  const slash = await ask('/about/', 'text/markdown');
  assert.equal(slash.status, 308);
  assert.equal(slash.headers.get('location'), '/about');
  assert.notEqual(slash.headers.get('content-type'), MARKDOWN);

  const doubled = await ask('/about//', 'text/markdown');
  assert.equal(doubled.status, 308);
  assert.equal(doubled.headers.get('location'), '/about');

  const query = await ask('/about/?x=1', 'text/markdown');
  assert.equal(query.headers.get('location'), '/about?x=1');
});

test('the version page keeps the redirect the page answers, as the specification says it does', async () => {
  const response = await ask('/spec/evals-baseline/1.0//', 'text/markdown');

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/spec/evals-baseline/1.0');
});

test('a route the platform redirects for a reason other than a slash is redirected for markdown as well', async () => {
  for (const path of ['/index', '/index/']) {
    const response = await ask(path, 'text/markdown');
    assert.equal(response.status, 308, path);
    assert.equal(response.headers.get('location'), '/', path);
  }
});

test('markdown and HTML agree on the status and the redirect of every form of every path', async () => {
  for (const method of ['GET', 'HEAD']) {
    for (const path of SLASH_FORMS) {
      const html = await ask(path, 'text/html', { method });
      const markdown = await ask(path, 'text/markdown', { method });
      assert.equal(markdown.status, html.status, `${method} ${path}`);
      assert.equal(markdown.headers.get('location'), html.headers.get('location'), `${method} ${path}`);
    }
  }
});

test('a redirect answered to a markdown request still names Accept in Vary, as the HTML answer does', async () => {
  const markdown = await ask('/about/', 'text/markdown');
  const html = await ask('/about/', 'text/html');

  assert.equal(markdown.headers.get('vary'), html.headers.get('vary'));
  assert.match(markdown.headers.get('vary') ?? '', /Accept/);
});

test('HEAD forwards the Content-Length the asset binding reports and never makes one up', async () => {
  const reporting = {
    fetch: async (incoming) =>
      new Response(incoming.method === 'HEAD' ? null : '# About', {
        headers: { 'content-type': 'text/markdown', 'content-length': '7' },
      }),
  };
  const silent = { fetch: async () => new Response(null, { headers: { 'content-type': 'text/markdown' } }) };

  const forwarded = await worker.fetch(request('/about', 'text/markdown', { method: 'HEAD' }), { ASSETS: reporting });
  const invented = await worker.fetch(request('/about', 'text/markdown', { method: 'HEAD' }), { ASSETS: silent });

  assert.equal(forwarded.headers.get('content-length'), '7');
  assert.equal(invented.headers.get('content-length'), null);
});

test('a client revalidating the markdown it holds is answered 304 in markdown, never with the page', async () => {
  const response = await ask('/about', 'text/markdown', { headers: { 'if-none-match': etagFor('/about.md') } });

  assert.equal(response.status, 304);
  assert.equal(response.headers.get('etag'), etagFor('/about.md'));
  assert.equal(response.headers.get('content-location'), '/about.md');
  assert.match(response.headers.get('vary') ?? '', /Accept/);
  assert.equal(await response.text(), '');
});

test('a client revalidating the page it holds is answered 304 for the page', async () => {
  const response = await ask('/about', 'text/html', { headers: { 'if-none-match': etagFor('/about') } });

  assert.equal(response.status, 304);
  assert.equal(response.headers.get('etag'), etagFor('/about'));
  assert.match(response.headers.get('vary') ?? '', /Accept/);
});

test('a client holding neither validator is sent the markdown it asked for', async () => {
  const response = await ask('/about', 'text/markdown', { headers: { 'if-none-match': '"stale"' } });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), MARKDOWN);
  assert.equal(await response.text(), SITE['/about.md']);
});

const failsOnce = (platform) => {
  let calls = 0;
  return {
    fetch: async (incoming) => {
      calls += 1;
      if (calls === 1) throw new Error('edge hiccup');
      return platform.fetch(incoming);
    },
  };
};

test('the page served after the asset binding throws still varies by Accept, so a cache cannot hand it to an agent', async () => {
  const response = await worker.fetch(request('/about', 'text/markdown'), { ASSETS: failsOnce(pagesPlatform()) });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), SITE['/about']);
  assert.match(response.headers.get('vary') ?? '', /(^|,)\s*Accept\s*(,|$)/i);
});

test('an asset served after the binding throws keeps its cache key and gains no Vary', async () => {
  const response = await worker.fetch(request('/_astro/app.css', 'text/css'), { ASSETS: failsOnce(pagesPlatform()) });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('vary'), null);
});

test('a page whose sidecar lookup throws is served as the page, still varying by Accept', async () => {
  const platform = pagesPlatform();
  let calls = 0;
  const failsOnSidecar = {
    fetch: async (incoming) => {
      calls += 1;
      if (calls === 2) throw new Error('edge hiccup');
      return platform.fetch(incoming);
    },
  };

  const response = await worker.fetch(request('/about', 'text/markdown'), { ASSETS: failsOnSidecar });

  assert.equal(await response.text(), SITE['/about']);
  assert.match(response.headers.get('vary') ?? '', /Accept/);
});
