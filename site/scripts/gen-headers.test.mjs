import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { collectInlineScriptHashes, collectInlineStyleHashes, renderHeaders } from './gen-headers.mjs';

const sha256 = (source) => `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

test('hashes every inline script in the document', () => {
  const html = `<html><head><script>applyTheme("dark")</script><script src="/_astro/x.js"></script></head></html>`;

  assert.deepEqual(collectInlineScriptHashes(html), [sha256('applyTheme("dark")')]);
});

test('deduplicates identical inline scripts', () => {
  const body = 'applyTheme("dark")';

  assert.equal(collectInlineScriptHashes(`<script>${body}</script><script>${body}</script>`).length, 1);
});

test('ignores json-ld and other non-executable script types', () => {
  assert.deepEqual(collectInlineScriptHashes('<script type="application/ld+json">{"a":1}</script>'), []);
});

test('script-src carries every hash and never unsafe-inline', () => {
  const policy = renderHeaders(['sha256-aaa', 'sha256-bbb']);

  assert.match(policy, /script-src 'self' https:\/\/plausible\.io 'sha256-aaa' 'sha256-bbb';/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
});

test('style-src stays self-only', () => {
  assert.match(renderHeaders([]), /style-src 'self';/);
});

test('immutable caching for hashed assets and revalidation for html', () => {
  const policy = renderHeaders([]);

  assert.match(policy, /\/_astro\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
  assert.match(policy, /\/\*\.html\n {2}Cache-Control: public, max-age=0, must-revalidate/);
});

test('every response carries the transport and framing guards', () => {
  const policy = renderHeaders([]);

  for (const header of [
    'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy: same-origin',
    'X-Frame-Options: DENY',
  ]) {
    assert.ok(policy.includes(header), `missing ${header}`);
  }
});

test('machine surfaces carry X-Robots-Tag: noindex', () => {
  const policy = renderHeaders([]);

  for (const rule of [
    '/rss.xml',
    '/*/rss.xml',
    '/feed.json',
    '/llms.txt',
    '/llms-full.txt',
    '/search-index*',
    '/*.md',
  ]) {
    assert.ok(policy.includes(`${rule}\n  X-Robots-Tag: noindex`), `${rule} misses X-Robots-Tag`);
  }
});

test('html pages never receive X-Robots-Tag', () => {
  const starBlock = renderHeaders([])
    .split('\n\n')
    .find((block) => block.startsWith('/*\n'));

  assert.ok(starBlock, 'no global block');
  assert.ok(!starBlock.includes('X-Robots-Tag'));
});

test('an inline style block is hashed so the shipped CSP does not block it', () => {
  const hashes = collectInlineStyleHashes('<style>@font-face{font-family:x}</style>');
  assert.equal(hashes.length, 1);
  assert.match(hashes[0], /^sha256-/);
});

test('an external stylesheet link is never hashed', () => {
  assert.deepEqual(collectInlineStyleHashes('<link rel="stylesheet" href="/app.css">'), []);
});

test('identical inline styles across pages collapse to one hash', () => {
  const html = '<style>a{color:red}</style><style>a{color:red}</style>';
  assert.equal(collectInlineStyleHashes(html).length, 1);
});

test('style-src carries every collected style hash and nothing else', () => {
  const header = renderHeaders(['sha256-script'], ['sha256-style']);
  assert.match(header, /style-src 'self' 'sha256-style'/);
  assert.match(header, /script-src 'self' https:\/\/plausible\.io 'sha256-script'/);
  assert.ok(!/style-src[^;]*unsafe-inline/.test(header));
});

test('with no inline styles the policy stays exactly self', () => {
  assert.match(renderHeaders([], []), /style-src 'self';/);
});
