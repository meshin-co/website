import assert from 'node:assert/strict';
import test from 'node:test';

import { linkArgs, siteOrigin, skippedHosts, THIRD_PARTY_HOSTS } from './links-gate.mjs';

test('the crawl covers the build recursively and rewrites extensionless local URLs', () => {
  const args = linkArgs({ origin: 'https://example.test' });
  assert.equal(args[0], 'dist');
  assert.ok(args.includes('--recurse'));
  assert.ok(args.includes('--url-rewrite-replace'));
});

test('a host that bot-blocks or needs a session is skipped by name, and the list is pinned', () => {
  assert.deepEqual(THIRD_PARTY_HOSTS, [
    'static.cloudflareinsights.com',
    'linkedin.com',
    'cal.com',
    'github.com/meshin-co',
    'apps.apple.com',
  ]);
  const skip = linkArgs({ origin: 'https://example.test' })[
    linkArgs({ origin: 'https://example.test' }).indexOf('--skip') + 1
  ];
  for (const host of THIRD_PARTY_HOSTS) assert.ok(skip.includes(host));
});

test('the absolute form of this site is skipped, read from the config rather than typed', () => {
  assert.deepEqual(skippedHosts('https://example.test').at(-1), '^https://example.test');
  assert.equal(siteOrigin('src/config.yaml').startsWith('https://'), true);
  assert.throws(() => siteOrigin('package.json'), /no site.site/);
});

test('a transient error is retried rather than reported as a broken link', () => {
  const args = linkArgs({ origin: 'https://example.test' });
  assert.ok(args.includes('--retry-errors'));
  assert.equal(args[args.indexOf('--retry-errors-count') + 1], '3');
});

test('the hermetic run skips every host outside the build, so a third party cannot redden it', () => {
  const skip = linkArgs({ skipExternal: true, origin: 'https://example.test' })[
    linkArgs({ skipExternal: true, origin: 'https://example.test' }).indexOf('--skip') + 1
  ];
  const pattern = new RegExp(skip);
  assert.ok(pattern.test('https://maxius.nl/wet-op-de-ondernemingsraden/artikel27'));
  assert.ok(pattern.test('https://research.google/pubs/'));
  assert.equal(pattern.test('http://localhost:4330/about'), false);
  assert.equal(pattern.test('http://127.0.0.1:4330/blog/'), false);
});

test('the live run does not skip an outbound host it has no reason to skip', () => {
  const skip = linkArgs({ origin: 'https://example.test' })[
    linkArgs({ origin: 'https://example.test' }).indexOf('--skip') + 1
  ];
  assert.equal(new RegExp(skip).test('https://maxius.nl/wet-op-de-ondernemingsraden/artikel27'), false);
});
