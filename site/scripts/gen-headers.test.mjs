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

  assert.match(policy, /script-src 'self' 'sha256-aaa' 'sha256-bbb';/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
});

test('no analytics host is allowed while no analytics is configured', () => {
  const policy = renderHeaders(['sha256-aaa']);

  assert.doesNotMatch(policy, /plausible\.io/);
  assert.doesNotMatch(policy, /cloudflareinsights\.com/);
});

test('the beacon host is allowed only when the build actually ships it', () => {
  const policy = renderHeaders(['sha256-aaa'], [], { analyticsBeacon: true });

  assert.match(policy, /script-src 'self' https:\/\/static\.cloudflareinsights\.com 'sha256-aaa';/);
  assert.match(policy, /connect-src 'self' https:\/\/cloudflareinsights\.com;/);
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
    '/llms/*',
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
  assert.match(header, /script-src 'self' 'sha256-script'/);
  assert.ok(!/style-src[^;]*unsafe-inline/.test(header));
});

test('with no inline styles the policy stays exactly self', () => {
  assert.match(renderHeaders([], []), /style-src 'self';/);
});

test('pages.dev hosts carry X-Robots-Tag: noindex, versioned and plain', () => {
  const header = renderHeaders([]);

  for (const rule of ['https://:project.pages.dev/*', 'https://:version.:project.pages.dev/*']) {
    assert.ok(header.includes(`${rule}\n  X-Robots-Tag: noindex`), `${rule} misses X-Robots-Tag`);
  }
});

const sectionFor = (policy, route) => policy.split('\n\n').find((block) => block.split('\n')[0] === route);
const LINK_VALUE = /^<(\/[^>\s]*)>; rel="([a-z-]+)"(?:; type="[^"\s]+")?$/;
const linkLinesOf = (section) =>
  section
    .split('\n')
    .slice(1)
    .filter((line) => line.trimStart().startsWith('Link:'))
    .map((line) => line.trim().slice('Link:'.length).trim());

test('the home page has its own rule carrying the discovery Link headers', () => {
  const section = sectionFor(renderHeaders([]), '/');

  assert.ok(section, 'no rule for exactly /');
  const relations = Object.fromEntries(
    linkLinesOf(section).map((value) => {
      const [, target, relation] = value.match(LINK_VALUE);
      return [relation, target];
    })
  );
  assert.deepEqual(relations, {
    'api-catalog': '/.well-known/api-catalog',
    'service-desc': '/openapi.json',
    describedby: '/llms.txt',
  });
});

test('every Link value is an angle-bracketed URI reference with a quoted rel', () => {
  const section = sectionFor(renderHeaders([]), '/');
  const values = linkLinesOf(section);

  assert.equal(values.length, 3);
  for (const value of values) {
    assert.match(value, LINK_VALUE, `malformed Link value: ${value}`);
  }
});

test('Link headers never leak onto every route', () => {
  const policy = renderHeaders([]);
  const starBlock = sectionFor(policy, '/*');

  assert.ok(starBlock, 'no global block');
  assert.ok(!starBlock.includes('Link:'));
  for (const block of policy.split('\n\n')) {
    if (block.includes('Link:')) {
      assert.equal(block.split('\n')[0], '/');
    }
  }
});

test('the extensionless api-catalog is served as a linkset', () => {
  const section = sectionFor(renderHeaders([]), '/.well-known/api-catalog');

  assert.ok(section, 'no rule for the api catalog');
  assert.ok(section.includes('  Content-Type: application/linkset+json'));
});

test('adding the discovery rules leaves the CSP, HSTS and caching rules intact', () => {
  const policy = renderHeaders(['sha256-abc='], ['sha256-def=']);
  const starBlock = sectionFor(policy, '/*');

  assert.ok(starBlock.includes("script-src 'self' 'sha256-abc=';"));
  assert.ok(starBlock.includes("style-src 'self' 'sha256-def=';"));
  assert.ok(starBlock.includes('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload'));
  assert.ok(policy.includes('/_astro/*\n  Cache-Control: public, max-age=31536000, immutable'));
  assert.ok(policy.includes('/og/*\n  Cache-Control: public, max-age=604800'));
  assert.ok(policy.includes('/*.html\n  Cache-Control: public, max-age=0, must-revalidate'));
});
