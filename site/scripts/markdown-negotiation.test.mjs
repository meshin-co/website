import test from 'node:test';
import assert from 'node:assert/strict';

import { readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import worker, { markdownSidecar, wantsMarkdown } from './markdown-negotiation.mjs';
import { writeEdgeHandler } from './gen-edge-worker.mjs';

const assets = (files) => ({
  fetch: async (request) => {
    const { pathname } = new URL(request.url);
    const body = files[pathname];
    return body === undefined
      ? new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } })
      : new Response(body, {
          status: 200,
          headers: {
            'content-type': pathname.endsWith('.md') ? 'text/markdown' : 'text/html',
            'cache-control': 'public, max-age=60',
          },
        });
  },
});

const get = (path, accept) =>
  new Request(`https://example.com${path}`, { headers: accept === undefined ? {} : { accept } });

const SITE = {
  '/': '<html>home</html>',
  '/index.md': '# Home',
  '/about': '<html>about</html>',
  '/about.md': '# About',
  '/blog/one': '<html>one</html>',
  '/blog/one.md': '# One',
};

test('an agent asking for markdown is understood, a browser is not', () => {
  assert.equal(wantsMarkdown('text/markdown'), true);
  assert.equal(wantsMarkdown('text/markdown, text/html;q=0.9'), true);
  assert.equal(wantsMarkdown('text/html,application/xhtml+xml,*/*;q=0.8'), false);
  assert.equal(wantsMarkdown('*/*'), false);
  assert.equal(wantsMarkdown(''), false);
});

test('a header naming a different markdown-ish type does not count', () => {
  assert.equal(wantsMarkdown('text/markdownish'), false);
  assert.equal(wantsMarkdown('application/markdown'), false);
});

test('each route maps to the sidecar the build already ships', () => {
  assert.equal(markdownSidecar('/'), '/index.md');
  assert.equal(markdownSidecar('/about'), '/about.md');
  assert.equal(markdownSidecar('/about/'), '/about.md');
  assert.equal(markdownSidecar('/blog/one'), '/blog/one.md');
});

test('a request already aimed at markdown or at an asset is left alone', () => {
  assert.equal(markdownSidecar('/about.md'), undefined);
  assert.equal(markdownSidecar('/_astro/app.css'), undefined);
  assert.equal(markdownSidecar('/og/home.png'), undefined);
});

test('the same URL answers markdown when an agent asks for it', async () => {
  const response = await worker.fetch(get('/', 'text/markdown'), { ASSETS: assets(SITE) });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(response.headers.get('content-location'), '/index.md');
  assert.match(response.headers.get('vary') ?? '', /Accept/);
  assert.equal(await response.text(), '# Home');
});

test('a browser asking the same URL still gets the page', async () => {
  const response = await worker.fetch(get('/about', 'text/html,*/*;q=0.8'), { ASSETS: assets(SITE) });

  assert.equal(response.headers.get('content-type'), 'text/html');
  assert.equal(await response.text(), '<html>about</html>');
});

test('a route with no sidecar falls back to the page rather than a 404', async () => {
  const response = await worker.fetch(get('/styleguide', 'text/markdown'), {
    ASSETS: assets({ ...SITE, '/styleguide': '<html>styleguide</html>' }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html');
});

test('a request that is not a GET is never rewritten', async () => {
  const response = await worker.fetch(
    new Request('https://example.com/about', { method: 'HEAD', headers: { accept: 'text/markdown' } }),
    { ASSETS: assets(SITE) }
  );

  assert.equal(response.headers.get('content-type'), 'text/html');
});

test('an asset binding that throws serves the site instead of an outage', async () => {
  let calls = 0;
  const flaky = {
    fetch: async () => {
      calls += 1;
      if (calls === 1) throw new Error('edge hiccup');
      return new Response('<html>home</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    },
  };

  const response = await worker.fetch(get('/', 'text/markdown'), { ASSETS: flaky });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<html>home</html>');
});

test('the build ships the handler byte for byte, under the name Pages runs', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'edge-worker-'));

  const written = await writeEdgeHandler(dist);

  assert.equal(written, join(dist, '_worker.js'));
  assert.equal(
    await readFile(written, 'utf8'),
    await readFile(new URL('./markdown-negotiation.mjs', import.meta.url), 'utf8')
  );
});
