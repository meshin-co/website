import assert from 'node:assert/strict';
import { test } from 'node:test';

import { acceptsGzip, contentTypeFor, headerRulesFor, resolveFile } from './gate-server.mjs';

test('an html route resolves to its index file', () => {
  assert.equal(resolveFile('/blog/'), 'blog/index.html');
  assert.equal(resolveFile('/blog'), 'blog/index.html');
  assert.equal(resolveFile('/'), 'index.html');
});

test('a file path with an extension resolves to itself', () => {
  assert.equal(resolveFile('/404.html'), '404.html');
  assert.equal(resolveFile('/llms.txt'), 'llms.txt');
  assert.equal(resolveFile('/_astro/app.css'), '_astro/app.css');
});

test('a query string never becomes part of the file path', () => {
  assert.equal(resolveFile('/blog/?page=2'), 'blog/index.html');
});

test('traversal outside the root is refused', () => {
  assert.equal(resolveFile('/../secrets.env'), null);
  assert.equal(resolveFile('/%2e%2e/secrets.env'), null);
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

test('a header block matches by prefix like Cloudflare does', () => {
  const rules = headerRulesFor(['/*', '  A: 1', '/_astro/*', '  B: 2'].join('\n'));
  const applied = (path) => rules.filter((rule) => new RegExp(`^${rule.pattern.replace('*', '.*')}$`).test(path));
  assert.equal(applied('/_astro/app.css').length, 2);
  assert.equal(applied('/blog/').length, 1);
});
