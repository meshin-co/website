import assert from 'node:assert/strict';
import test from 'node:test';

import {
  linkArgs,
  linkFindings,
  malformedFindings,
  siteOrigin,
  skippedHosts,
  THIRD_PARTY_HOSTS,
} from './links-gate.mjs';

const skipOf = (args) => args[args.indexOf('--skip') + 1];

test('the crawl covers the build recursively and rewrites extensionless local URLs', () => {
  const args = linkArgs({ origin: 'https://example.test' });
  assert.equal(args[0], 'dist');
  assert.ok(args.includes('--recurse'));
  assert.ok(args.includes('--url-rewrite-replace'));
});

test('the rewrite adds .html to a local page address, including one whose last segment is two numbers, and to nothing else', () => {
  const args = linkArgs({ origin: 'https://example.test' });
  const pattern = new RegExp(args[args.indexOf('--url-rewrite-search') + 1]);
  const replace = args[args.indexOf('--url-rewrite-replace') + 1];
  const rewrite = (url) => url.replace(pattern, replace);
  const host = 'http://127.0.0.1:4321';
  assert.equal(rewrite(`${host}/about`), `${host}/about.html`);
  assert.equal(rewrite(`${host}/spec/evals-baseline/1.0`), `${host}/spec/evals-baseline/1.0.html`);
  assert.equal(rewrite(`${host}/spec/evals-baseline/1.0?a=1`), `${host}/spec/evals-baseline/1.0.html?a=1`);
  assert.equal(rewrite(`${host}/spec/evals-baseline/1.0#cite`), `${host}/spec/evals-baseline/1.0.html#cite`);
  assert.equal(rewrite(`http://localhost:4321/spec/x/12.34`), `http://localhost:4321/spec/x/12.34.html`);
  for (const untouched of [
    '/x/1.0.md',
    '/x/1.0.html',
    '/llms.txt',
    '/rss.xml',
    '/_astro/app.css',
    '/x/v1.0',
    '/x/1.0.0',
    '/x/1.',
    '/x/.5',
  ]) {
    assert.equal(rewrite(`${host}${untouched}`), `${host}${untouched}`, untouched);
  }
});

test('a host that bot-blocks or needs a session is skipped by name, and the list is pinned', () => {
  assert.deepEqual(THIRD_PARTY_HOSTS, [
    'static.cloudflareinsights.com',
    'linkedin.com',
    'cal.com',
    'github.com/meshin-co',
    'apps.apple.com',
  ]);
  const skip = skipOf(linkArgs({ origin: 'https://example.test' }));
  for (const host of THIRD_PARTY_HOSTS) assert.ok(skip.includes(host));
});

test('the absolute form of this site is skipped, read from the config rather than typed', () => {
  assert.deepEqual(skippedHosts('https://example.test').at(-1), '^https://example.test');
  assert.equal(siteOrigin('src/config.yaml').startsWith('https://'), true);
  assert.throws(() => siteOrigin('package.json'), /no site.site/);
});

test('the crawl never fetches a host outside the build, so linkinator cannot judge an outbound address', () => {
  const pattern = new RegExp(skipOf(linkArgs({ origin: 'https://example.test' })));

  assert.ok(pattern.test('https://maxius.nl/wet-op-de-ondernemingsraden/artikel27'));
  assert.ok(pattern.test('https://research.google/pubs/'));
  assert.ok(pattern.test('https://doi.org/10.6028/NIST.AI.100-1'));
  assert.equal(pattern.test('http://localhost:4330/about'), false);
  assert.equal(pattern.test('http://127.0.0.1:4330/blog/'), false);
});

test('a link inside the build that got no response is retried, because a loaded runner can time out its own static server', () => {
  const args = linkArgs({ origin: 'https://example.test' });

  assert.ok(args.includes('--retry'));
  assert.ok(args.includes('--retry-errors'));
  assert.equal(args[args.indexOf('--retry-errors-count') + 1], '3');
  assert.equal(args[args.indexOf('--retry-errors-jitter') + 1], '500');
});

test('a json run lists every link, so a count of zero can be read as a vacuous pass', () => {
  const args = linkArgs({ origin: 'https://meshin.co', json: true });

  assert.ok(args.includes('--format'));
  assert.equal(args[args.indexOf('--format') + 1], 'json');
  assert.ok(!args.includes('--silent'), 'silent mode reports only broken links, which hides the denominator');
});

test('a link inside the build that does not answer is dead, whether it said 404 or nothing', () => {
  const dead = linkFindings([
    { url: 'http://localhost:4330/missing', status: 404, state: 'BROKEN', parent: 'dist/index.html' },
    { url: 'http://localhost:4330/silent', status: 0, state: 'BROKEN', parent: 'dist/index.html' },
    { url: 'http://localhost:4330/here', status: 200, state: 'OK', parent: 'dist/index.html' },
  ]);

  assert.deepEqual(dead, [
    'dist/index.html -> http://localhost:4330/missing (404)',
    'dist/index.html -> http://localhost:4330/silent (no response)',
  ]);
});

test('an address is malformed when it has whitespace, does not parse, or names a host that is no domain', () => {
  const outbound = new Map([
    ['https://exa mple.com/x', ['/a']],
    ['https://', ['/a', '/b']],
    ['https://intranet/page', ['/c']],
    ['https://localhost/page', ['/c']],
    ['https://ok.example/fine', ['/a']],
    ['http://[::1]:8080/fine', ['/a']],
    ['http://127.0.0.1:8080/fine', ['/a']],
    ['https://a.example/path with space', ['/a']],
  ]);

  assert.deepEqual(malformedFindings(outbound), [
    'https://exa mple.com/x (contains whitespace) on 1 page, e.g. /a',
    'https:// (does not parse as an address) on 2 pages, e.g. /a',
    'https://intranet/page (the host is not a domain name) on 1 page, e.g. /c',
    'https://localhost/page (the host is not a domain name) on 1 page, e.g. /c',
    'https://a.example/path with space (contains whitespace) on 1 page, e.g. /a',
  ]);
});

test('no outbound address, or only well-formed ones, is no finding', () => {
  assert.deepEqual(malformedFindings(new Map()), []);
  assert.deepEqual(malformedFindings(new Map([['https://ok.example/', ['/a']]])), []);
});
