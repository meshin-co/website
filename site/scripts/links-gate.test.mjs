import assert from 'node:assert/strict';
import test from 'node:test';

import { linkArgs, siteOrigin, skippedHosts, THIRD_PARTY_HOSTS, linkFindings } from './links-gate.mjs';

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

test('a citation answering 404 is our defect and fails the gate', () => {
  const { dead, unreachable } = linkFindings([
    { url: 'https://example.com/gone', status: 404, state: 'BROKEN', parent: 'dist/blog/a.html' },
    { url: 'https://example.com/here', status: 200, state: 'OK', parent: 'dist/blog/a.html' },
  ]);

  assert.deepEqual(unreachable, []);
  assert.equal(dead.length, 1);
  assert.match(dead[0], /404/);
  assert.match(dead[0], /dist\/blog\/a\.html/);
});

test('a datacentre-blocked answer is the destination refusing a runner, not a dead citation', () => {
  const { dead, unreachable } = linkFindings([
    { url: 'https://wall.example/a', status: 403, state: 'BROKEN', parent: 'dist/a.html' },
    { url: 'https://wall.example/b', status: 429, state: 'BROKEN', parent: 'dist/a.html' },
    { url: 'https://wall.example/c', status: 451, state: 'BROKEN', parent: 'dist/a.html' },
  ]);

  assert.deepEqual(dead, []);
  assert.equal(unreachable.length, 3);
});

test('410 proves a page is gone, exactly as 404 does', () => {
  const { dead } = linkFindings([
    { url: 'https://example.com/x', status: 410, state: 'BROKEN', parent: 'dist/a.html' },
  ]);

  assert.equal(dead.length, 1);
});

test('a destination that is down is reported but does not fail the gate, because it is not our link', () => {
  const { dead, unreachable } = linkFindings([
    { url: 'https://down.example/page', status: 503, state: 'BROKEN', parent: 'dist/blog/a.html' },
    { url: 'https://slow.example/page', status: 0, state: 'BROKEN', parent: 'dist/blog/b.html' },
  ]);

  assert.deepEqual(dead, []);
  assert.equal(unreachable.length, 2);
  assert.match(unreachable[0], /503/);
  assert.match(unreachable[1], /no response/);
});

test('a local link is never excused: an unreachable build file is dead', () => {
  const { dead } = linkFindings([
    { url: 'http://localhost:4330/missing', status: 0, state: 'BROKEN', parent: 'dist/index.html' },
  ]);

  assert.equal(dead.length, 1);
});

test('a json run lists every link, so a count of zero can be read as a vacuous pass', () => {
  const args = linkArgs({ origin: 'https://meshin.co', json: true });

  assert.ok(args.includes('--format'));
  assert.equal(args[args.indexOf('--format') + 1], 'json');
  assert.ok(!args.includes('--silent'), 'silent mode reports only broken links, which hides the denominator');
});
