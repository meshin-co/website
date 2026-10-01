import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';

import {
  acceptsGzip,
  contentTypeFor,
  headerRulesFor,
  overPlainHttp,
  resolveRequest,
  startGateServer,
} from './gate-server.mjs';
import { renderHeaders } from './gen-headers.mjs';

const BUILT = ['index.html', 'about.html', 'blog.html', 'blog/post.html', '404.html', 'llms.txt', '_astro/app.css'];
const answerFor = (url) => resolveRequest(url, (file) => BUILT.includes(file));

test('a flat page answers 200 at its slashless URL and the home page at the root', () => {
  assert.deepEqual(answerFor('/'), { status: 200, file: 'index.html' });
  assert.deepEqual(answerFor('/about'), { status: 200, file: 'about.html' });
  assert.deepEqual(answerFor('/blog'), { status: 200, file: 'blog.html' });
  assert.deepEqual(answerFor('/blog/post'), { status: 200, file: 'blog/post.html' });
});

test('the slash form of a flat page is a 308 to the slashless URL', () => {
  assert.deepEqual(answerFor('/about/'), { status: 308, location: '/about' });
  assert.deepEqual(answerFor('/blog/'), { status: 308, location: '/blog' });
  assert.deepEqual(answerFor('/blog/post/'), { status: 308, location: '/blog/post' });
});

test('a redirect carries the query string and a direct answer ignores it', () => {
  assert.deepEqual(answerFor('/about/?utm=x'), { status: 308, location: '/about?utm=x' });
  assert.deepEqual(answerFor('/blog?page=2'), { status: 200, file: 'blog.html' });
});

test('naming the .html file redirects to the slashless URL, and naming the home file redirects to the root', () => {
  assert.deepEqual(answerFor('/about.html'), { status: 308, location: '/about' });
  assert.deepEqual(answerFor('/blog/post.html'), { status: 308, location: '/blog/post' });
  assert.deepEqual(answerFor('/index.html'), { status: 308, location: '/' });
});

test('the custom error page answers 200 at /404 and redirects from .html and from a trailing slash', () => {
  assert.deepEqual(answerFor('/404'), { status: 200, file: '404.html' });
  assert.deepEqual(answerFor('/404.html'), { status: 308, location: '/404' });
  assert.deepEqual(answerFor('/404/'), { status: 308, location: '/404' });
});

test('a non-html file answers as itself and refuses a trailing slash', () => {
  assert.deepEqual(answerFor('/llms.txt'), { status: 200, file: 'llms.txt' });
  assert.deepEqual(answerFor('/_astro/app.css'), { status: 200, file: '_astro/app.css' });
  assert.deepEqual(answerFor('/llms.txt/'), { status: 404 });
});

test('a path no built file answers is a 404, including an .html name with no page behind it', () => {
  assert.deepEqual(answerFor('/missing'), { status: 404 });
  assert.deepEqual(answerFor('/missing/'), { status: 404 });
  assert.deepEqual(answerFor('/missing.html'), { status: 404 });
});

test('a directory build is not served: about/index.html answers neither /about nor /about/', () => {
  const directoryBuild = (url) => resolveRequest(url, (file) => file === 'about/index.html');
  assert.deepEqual(directoryBuild('/about'), { status: 404 });
  assert.deepEqual(directoryBuild('/about/'), { status: 404 });
});

test('leading double slashes collapse before the lookup', () => {
  assert.deepEqual(answerFor('//about'), { status: 200, file: 'about.html' });
});

test('a redirect location is percent-encoded', () => {
  const isFile = (file) => file === 'café.html';
  assert.deepEqual(resolveRequest('/caf%C3%A9/', isFile), { status: 308, location: '/caf%C3%A9' });
  assert.deepEqual(resolveRequest('/caf%C3%A9.html', isFile), { status: 308, location: '/caf%C3%A9' });
});

test('traversal and malformed escapes are refused before any file is probed', () => {
  const probe = () => assert.fail('probed the filesystem');
  for (const url of ['/../secrets.env', '/%2e%2e/secrets.env', '/%zz']) {
    assert.deepEqual(resolveRequest(url, probe), { status: 404 });
  }
});

test('gzip is used only when the client offers it', () => {
  assert.equal(acceptsGzip('gzip, deflate, br'), true);
  assert.equal(acceptsGzip('br'), false);
  assert.equal(acceptsGzip(undefined), false);
});

test('content types cover every artifact the gate fetches', () => {
  assert.equal(contentTypeFor('index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('app.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('app.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('llms.txt'), 'text/plain; charset=utf-8');
  assert.equal(contentTypeFor('feed.json'), 'application/json; charset=utf-8');
  assert.equal(contentTypeFor('card.png'), 'image/png');
  assert.equal(contentTypeFor('body.woff2'), 'font/woff2');
  assert.equal(contentTypeFor('sitemap.xml'), 'application/xml; charset=utf-8');
});

test('the headers file drives the response headers, not a second hand-written list', () => {
  const rules = headerRulesFor(
    ['/*', '  X-Frame-Options: DENY', '', '/_astro/*', '  Cache-Control: immutable'].join('\n')
  );
  assert.deepEqual(rules[0], { pattern: '/*', headers: [['X-Frame-Options', 'DENY']] });
  assert.deepEqual(rules[1], { pattern: '/_astro/*', headers: [['Cache-Control', 'immutable']] });
});

const PAGES = {
  'index.html': '<h1>home</h1>',
  'about.html': '<h1>about</h1>',
  '404.html': '<h1>missing</h1>',
  'rss.xml': '<rss/>',
};

let dist;
let origin;
let server;

before(async () => {
  dist = await mkdtemp(join(tmpdir(), 'gate-server-'));
  for (const [file, body] of Object.entries(PAGES)) {
    await mkdir(dirname(join(dist, file)), { recursive: true });
    await writeFile(join(dist, file), body);
  }
  await writeFile(join(dist, '_headers'), renderHeaders([]));
  const started = await startGateServer({ root: dist, headersPath: join(dist, '_headers') });
  server = started.server;
  origin = `http://127.0.0.1:${started.port}`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await rm(dist, { recursive: true, force: true });
});

const get = (path) => fetch(`${origin}${path}`, { redirect: 'manual' });

test('a flat page answers 200 at its slashless URL with the page', async () => {
  const response = await get('/about');

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<h1>about</h1>');
});

test('the slash form of a flat page answers 308 to the slashless URL, with no body', async () => {
  const response = await get('/about/');

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/about');
  assert.equal(await response.text(), '');
});

test('the .html name of a flat page answers 308 to the slashless URL', async () => {
  const response = await get('/about.html');

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/about');
});

test('a client that follows redirects lands on the slashless URL with its query intact', async () => {
  const response = await fetch(`${origin}/about/?utm=x`);

  assert.equal(response.url, `${origin}/about?utm=x`);
  assert.equal(response.status, 200);
});

test('an unknown path answers 404 with the custom page', async () => {
  const response = await get('/missing');

  assert.equal(response.status, 404);
  assert.equal(await response.text(), '<h1>missing</h1>');
});

test('the custom page answers 200 at /404 and 308 from /404.html', async () => {
  const served = await get('/404');
  const named = await get('/404.html');

  assert.equal(served.status, 200);
  assert.equal(await served.text(), '<h1>missing</h1>');
  assert.equal(named.status, 308);
  assert.equal(named.headers.get('location'), '/404');
});

test('a host-scoped noindex rule from the generated _headers never reaches a local page, while a path rule still does', async () => {
  const page = await get('/about');
  const feed = await get('/rss.xml');

  assert.ok(page.headers.get('content-security-policy'));
  assert.equal(page.headers.get('x-robots-tag'), null);
  assert.equal(feed.headers.get('x-robots-tag'), 'noindex');
});

test('a path rule is matched against the URL a page is served at, never against its .html file name', async () => {
  const page = await get('/about');
  const error = await get('/missing');

  assert.equal(page.headers.get('cache-control'), null);
  assert.equal(error.headers.get('cache-control'), null);
});

test('overPlainHttp drops upgrade-insecure-requests and keeps every other directive', () => {
  const policy = "default-src 'self'; script-src 'self'; upgrade-insecure-requests";
  assert.equal(overPlainHttp('Content-Security-Policy', policy), "default-src 'self'; script-src 'self'");
});

test('overPlainHttp leaves a policy without the directive byte-identical', () => {
  const policy = "default-src 'self'; img-src 'self' data:";
  assert.equal(overPlainHttp('Content-Security-Policy', policy), policy);
});

test('overPlainHttp never edits a header that is not the policy', () => {
  assert.equal(overPlainHttp('X-Robots-Tag', 'upgrade-insecure-requests'), 'upgrade-insecure-requests');
});

test('overPlainHttp drops the directive when it is written first or alone', () => {
  assert.equal(
    overPlainHttp('Content-Security-Policy', "upgrade-insecure-requests; default-src 'self'"),
    "default-src 'self'"
  );
  assert.equal(overPlainHttp('Content-Security-Policy', 'upgrade-insecure-requests'), '');
});

test('overPlainHttp does not match a directive that merely starts with the same words', () => {
  const policy = "default-src 'self'; upgrade-insecure-requests-later";
  assert.equal(overPlainHttp('Content-Security-Policy', policy), policy);
});

test('the served policy carries no upgrade-insecure-requests', async () => {
  const response = await fetch(`${origin}/`);
  const policy = response.headers.get('content-security-policy');
  assert.ok(policy, 'the fixture serves a policy');
  assert.ok(!policy.includes('upgrade-insecure-requests'), policy);
  assert.ok(policy.includes("default-src 'self'"), policy);
});
