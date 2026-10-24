import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dateAgreementFailures, jsonLdModified, sidecarUpdated } from './date-agreement.mjs';

const ORIGIN = 'https://meshin.co';
const NOW = Date.parse('2026-10-25T09:00:00.000Z');
const FURTHEST_AHEAD_MS = 14 * 60 * 60 * 1000;
const midnight = (day) => `${day}T00:00:00.000Z`;

const graphPage = (nodes) =>
  `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })}</script></head><body></body></html>`;

const pageNode = (route, dateModified, type = 'WebPage') => ({
  '@type': type,
  '@id': `${ORIGIN}${route === '/' ? '/' : route}#webpage`,
  ...(dateModified ? { dateModified } : {}),
});

const sidecar = (updated) => `# Title\n\nSource: ${ORIGIN}/x\nUpdated: ${updated}\n\n---\n\nBody.\n`;

const agreeing = (route = '/security', day = '2026-10-02') => ({
  route,
  lastmod: midnight(day),
  html: graphPage([pageNode(route, midnight(day))]),
  text: sidecar(day),
});

const run = (entries, { staticRoutes = entries.map((entry) => entry.route), now = NOW } = {}) =>
  dateAgreementFailures({
    lastmods: new Map(entries.map((entry) => [entry.route, entry.lastmod])),
    htmlByRoute: Object.fromEntries(entries.map((entry) => [entry.route, entry.html])),
    sidecarTextByRoute: Object.fromEntries(entries.map((entry) => [entry.route, entry.text])),
    staticRoutes,
    now,
  });

const check = (entry, options) => run([entry], options);

const besideStaticPage = (entry) => run([entry, agreeing('/about')], { staticRoutes: ['/about'] });

test('one editorial day stated the same way in the sitemap, the JSON-LD and the sidecar agrees', () => {
  assert.deepEqual(check(agreeing()), []);
});

test('a JSON-LD date that differs from the sitemap and the sidecar names the route and all three values', () => {
  const failures = check({ ...agreeing(), html: graphPage([pageNode('/security', midnight('2026-09-13'))]) });

  assert.deepEqual(failures, [
    '/security modified dates disagree: JSON-LD dateModified 2026-09-13T00:00:00.000Z (WebPage), sitemap lastmod 2026-10-02T00:00:00.000Z, sidecar Updated 2026-10-02',
  ]);
});

test('a sitemap lastmod that differs names the route and all three values', () => {
  const failures = check({ ...agreeing(), lastmod: midnight('2026-01-01') });

  assert.deepEqual(failures, [
    '/security modified dates disagree: JSON-LD dateModified 2026-10-02T00:00:00.000Z (WebPage), sitemap lastmod 2026-01-01T00:00:00.000Z, sidecar Updated 2026-10-02',
  ]);
});

test('a sidecar date that differs names the route and all three values', () => {
  const failures = check({ ...agreeing(), text: sidecar('2026-10-16') });

  assert.deepEqual(failures, [
    '/security modified dates disagree: JSON-LD dateModified 2026-10-02T00:00:00.000Z (WebPage), sitemap lastmod 2026-10-02T00:00:00.000Z, sidecar Updated 2026-10-16',
  ]);
});

test('two JSON-LD nodes of one page that disagree are both named even when the sitemap matches one', () => {
  const route = '/blog/post';
  const failures = besideStaticPage({
    route,
    lastmod: midnight('2026-10-07'),
    html: graphPage([
      { '@type': 'BlogPosting', '@id': `${ORIGIN}${route}#article`, dateModified: midnight('2026-10-07') },
      pageNode(route, midnight('2026-10-02')),
    ]),
    text: sidecar('2026-10-07'),
  });

  assert.equal(failures.length, 1);
  assert.match(failures[0], /^\/blog\/post modified dates disagree: /);
  assert.match(failures[0], /JSON-LD dateModified 2026-10-07T00:00:00\.000Z \(BlogPosting\)/);
  assert.match(failures[0], /JSON-LD dateModified 2026-10-02T00:00:00\.000Z \(WebPage\)/);
});

test('a static page whose JSON-LD states no date is named with the missing surface printed, not skipped', () => {
  const failures = check({
    ...agreeing('/contact', '2026-10-25'),
    html: graphPage([pageNode('/contact', null, 'ContactPage')]),
  });

  assert.deepEqual(failures, [
    '/contact has no modified date in its JSON-LD: JSON-LD dateModified MISSING, sitemap lastmod 2026-10-25T00:00:00.000Z, sidecar Updated 2026-10-25',
  ]);
});

test('a static page with no sidecar date or no sitemap lastmod is named with each missing surface', () => {
  const noSidecar = check({ ...agreeing(), text: null });
  const noLastmod = check({ ...agreeing(), lastmod: null });
  const noDateLine = check({ ...agreeing(), lastmod: null, text: '# Title\n\nBody.\n' });

  assert.match(noSidecar[0], /^\/security has no modified date in its sidecar: .*sidecar Updated MISSING$/);
  assert.match(noLastmod[0], /^\/security has no modified date in its sitemap entry: .*sitemap lastmod MISSING/);
  assert.match(noDateLine[0], /^\/security has no modified date in its sitemap entry and its sidecar: /);
});

test('a static page missing from every surface is named once with all three places', () => {
  const failures = check({ route: '/security', lastmod: null, html: graphPage([]), text: null });

  assert.deepEqual(failures, [
    '/security has no modified date in its JSON-LD, its sitemap entry and its sidecar: JSON-LD dateModified MISSING, sitemap lastmod MISSING, sidecar Updated MISSING',
  ]);
});

test('a static page that is not in the sitemap at all is named, because a missing entry is not an agreement', () => {
  const entry = agreeing();
  const failures = dateAgreementFailures({
    lastmods: new Map(),
    htmlByRoute: { [entry.route]: entry.html },
    sidecarTextByRoute: { [entry.route]: entry.text },
    staticRoutes: [entry.route],
    now: NOW,
  });

  assert.equal(failures.length, 1);
  assert.match(failures[0], /^\/security has no modified date in its sitemap entry: /);
});

test('a route that is not a static page and states its date in two places is compared on those two', () => {
  const failures = besideStaticPage({
    route: '/faq/answer',
    lastmod: midnight('2026-10-02'),
    html: graphPage([]),
    text: sidecar('2026-10-16'),
  });

  assert.deepEqual(failures, [
    '/faq/answer modified dates disagree: JSON-LD dateModified MISSING, sitemap lastmod 2026-10-02T00:00:00.000Z, sidecar Updated 2026-10-16',
  ]);
});

test('a route that is not a static page and states its date in one place has nothing to disagree with', () => {
  const failures = besideStaticPage({
    route: '/blog/tag/evals',
    lastmod: midnight('2026-10-02'),
    html: graphPage([]),
    text: null,
  });

  assert.deepEqual(failures, []);
});

test('a lastmod with a time of day is a build or commit time, and the sidecar day matching it does not save the route', () => {
  const clock = '2026-10-24T20:40:28.000Z';
  const failures = check({
    route: '/',
    lastmod: clock,
    html: graphPage([pageNode('/', clock)]),
    text: sidecar('2026-10-24'),
  });

  assert.deepEqual(failures, [
    '/ sitemap lastmod 2026-10-24T20:40:28.000Z is not an editorial date (midnight UTC) and JSON-LD dateModified 2026-10-24T20:40:28.000Z (WebPage) is not an editorial date (midnight UTC): JSON-LD dateModified 2026-10-24T20:40:28.000Z (WebPage), sitemap lastmod 2026-10-24T20:40:28.000Z, sidecar Updated 2026-10-24',
  ]);
});

test('one build instant stamped on every static page names every page, not only the first', () => {
  const routes = [
    '/',
    '/about',
    '/ai-policy',
    '/approach',
    '/contact',
    '/imprint',
    '/now',
    '/pricing',
    '/privacy',
    '/security',
    '/terms',
  ];
  const entries = routes.map((route) => ({
    route,
    lastmod: '2026-10-24T20:40:28.000Z',
    html: graphPage([pageNode(route, midnight('2026-10-02'))]),
    text: sidecar('2026-10-24'),
  }));
  const failures = run(entries);

  assert.equal(failures.length, routes.length);
  for (const route of routes)
    assert.ok(
      failures.some((failure) => failure.startsWith(`${route} `)),
      `${route} is not named`
    );
});

test('the same shape rule holds for a route that is not a static page, so no template can bring a clock back', () => {
  const failures = besideStaticPage({
    route: '/blog/post',
    lastmod: '2026-10-07T09:30:00.000Z',
    html: graphPage([]),
    text: sidecar('2026-10-07'),
  });

  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /^\/blog\/post sitemap lastmod 2026-10-07T09:30:00\.000Z is not an editorial date \(midnight UTC\): /
  );
});

test('a JSON-LD date with a time of day or in no readable form is named as not an editorial date', () => {
  const withClock = check({ ...agreeing(), html: graphPage([pageNode('/security', '2026-10-02T03:30:47.000Z')]) });
  const unreadable = check({ ...agreeing(), html: graphPage([pageNode('/security', 'last tuesday')]) });

  assert.match(
    withClock[0],
    /^\/security JSON-LD dateModified 2026-10-02T03:30:47\.000Z \(WebPage\) is not an editorial date \(midnight UTC\): /
  );
  assert.match(
    unreadable[0],
    /^\/security JSON-LD dateModified last tuesday \(WebPage\) is not an editorial date \(midnight UTC\): /
  );
});

test('a problem of two kinds on one route is one line naming both', () => {
  const failures = check({
    route: '/',
    lastmod: '2026-10-24T20:40:28.000Z',
    html: graphPage([pageNode('/', midnight('2026-10-02'))]),
    text: sidecar('2026-10-24'),
  });

  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /^\/ modified dates disagree and sitemap lastmod 2026-10-24T20:40:28\.000Z is not an editorial date \(midnight UTC\): /
  );
});

test('a lastmod a day past the furthest-ahead timezone is named as in the future', () => {
  const tomorrow = '2026-10-26';
  const failures = check({ ...agreeing('/security', tomorrow) });

  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /^\/security sitemap lastmod 2026-10-26T00:00:00\.000Z is in the future \(more than 14 hours ahead of the clock\): /
  );
});

test('a lastmod exactly the furthest-ahead timezone away is still today there and passes, a millisecond more does not', () => {
  const today = agreeing('/security', '2026-10-25');
  const exactlyAhead = Date.parse(today.lastmod) - FURTHEST_AHEAD_MS;

  assert.deepEqual(check(today, { now: exactlyAhead }), []);
  assert.equal(check(today, { now: exactlyAhead - 1 }).length, 1);
});

test('a node another route owns and a date nested inside a citation are not this page modified date', () => {
  const failures = check({
    ...agreeing(),
    html: graphPage([
      pageNode('/security', midnight('2026-10-02')),
      pageNode('/about', midnight('2020-01-01')),
      {
        '@type': 'Service',
        '@id': `${ORIGIN}/security#service`,
        citation: [{ '@type': 'CreativeWork', name: 'Source', dateModified: '2019-05-05' }],
      },
    ]),
  });

  assert.deepEqual(failures, []);
});

test('a JSON-LD block that does not parse is named, so its date is never skipped in silence', () => {
  const failures = check({ ...agreeing(), html: '<script type="application/ld+json">{not json</script>' });

  assert.deepEqual(failures, [
    '/security carries an ld+json block that does not parse, so its dateModified was not compared',
  ]);
});

test('a route outside the sitemap that is not a static page is not compared, because it is not published for freshness', () => {
  const about = agreeing('/about');
  const failures = dateAgreementFailures({
    lastmods: new Map([[about.route, about.lastmod]]),
    htmlByRoute: { [about.route]: about.html, '/search': graphPage([pageNode('/search', midnight('2020-01-01'))]) },
    sidecarTextByRoute: { [about.route]: about.text, '/search': sidecar('2026-10-16') },
    staticRoutes: [about.route],
    now: NOW,
  });

  assert.deepEqual(failures, []);
});

test('a catalog that dates no static page fails, because a gate that compared nothing passed on nothing', () => {
  const failures = dateAgreementFailures({
    lastmods: new Map(),
    htmlByRoute: {},
    sidecarTextByRoute: {},
    staticRoutes: [],
    now: NOW,
  });

  assert.deepEqual(failures, ['no static route carries an updatedDate, so no date was compared']);
});

test('the sidecar reader returns the Updated day and nothing for a sidecar without one', () => {
  assert.equal(sidecarUpdated(sidecar('2026-10-02')), '2026-10-02');
  assert.equal(sidecarUpdated('# Title\n\nBody.\n'), null);
  assert.equal(sidecarUpdated('# Title\n\nUpdated: October 2026\n'), null);
  assert.equal(sidecarUpdated(null), null);
});

test('the JSON-LD reader lists each owned node date with its type, in graph order', () => {
  const html = graphPage([
    { '@type': 'BlogPosting', '@id': `${ORIGIN}/blog/post#article`, dateModified: midnight('2026-10-07') },
    pageNode('/blog/post', midnight('2026-10-07')),
    { '@type': 'Person', '@id': `${ORIGIN}/about#person` },
  ]);

  assert.deepEqual(jsonLdModified('/blog/post', html), [
    { type: 'BlogPosting', value: '2026-10-07T00:00:00.000Z' },
    { type: 'WebPage', value: '2026-10-07T00:00:00.000Z' },
  ]);
});
