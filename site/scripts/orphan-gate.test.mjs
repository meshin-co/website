import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collectInboundLinks, findOrphans, extractHrefs, EXEMPT_ROUTES } from './orphan-gate.mjs';

test('a route with zero inbound links is reported by findOrphans', () => {
  const pages = [
    { route: '/', hrefs: [{ href: '/blog' }] },
    { route: '/blog', hrefs: [{ href: '/' }] },
    { route: '/orphaned', hrefs: [] },
  ];
  const inbound = collectInboundLinks(pages);
  const orphans = findOrphans({ routes: pages.map((page) => page.route), inbound, exempt: new Set() });

  assert.deepEqual(orphans, ['/orphaned']);
});

test('a fragment or mailto link never counts as an inbound link, so the target stays an orphan', () => {
  const pages = [
    { route: '/', hrefs: [{ href: '#top' }, { href: 'mailto:hello@meshin.co' }, { href: 'tel:+15555550100' }] },
    { route: '/search', hrefs: [] },
  ];
  const inbound = collectInboundLinks(pages);
  const orphans = findOrphans({ routes: pages.map((page) => page.route), inbound, exempt: new Set() });

  assert.ok(orphans.includes('/search'));
});

test('a real inbound link from another page clears the orphan finding', () => {
  const pages = [
    { route: '/', hrefs: [{ href: '/search' }] },
    { route: '/search', hrefs: [] },
  ];
  const inbound = collectInboundLinks(pages);
  const orphans = findOrphans({ routes: ['/search'], inbound, exempt: new Set() });

  assert.deepEqual(orphans, []);
});

test('a link carrying rel=nofollow is never counted as an inbound link', () => {
  const pages = [
    { route: '/', hrefs: [{ href: '/search', rel: 'nofollow' }] },
    { route: '/search', hrefs: [] },
  ];
  const inbound = collectInboundLinks(pages);
  const orphans = findOrphans({ routes: ['/search'], inbound, exempt: new Set() });

  assert.deepEqual(orphans, ['/search']);
});

test('a page linking to itself never counts as its own inbound link', () => {
  const pages = [{ route: '/styleguide', hrefs: [{ href: '/styleguide' }] }];
  const inbound = collectInboundLinks(pages);
  const orphans = findOrphans({ routes: pages.map((page) => page.route), inbound, exempt: new Set() });

  assert.deepEqual(orphans, ['/styleguide']);
});

test('an external absolute url never resolves to an internal route', () => {
  const pages = [
    { route: '/', hrefs: [{ href: 'https://cal.com/meshin' }] },
    { route: '/search', hrefs: [] },
  ];
  const inbound = collectInboundLinks(pages);
  const orphans = findOrphans({ routes: pages.map((page) => page.route), inbound, exempt: new Set() });

  assert.ok(orphans.includes('/search'));
});

test('a trailing slash on an href normalises to the same route key as the route without one', () => {
  const pages = [
    { route: '/', hrefs: [{ href: '/search/' }] },
    { route: '/search', hrefs: [] },
  ];
  const inbound = collectInboundLinks(pages);
  const orphans = findOrphans({ routes: ['/search'], inbound, exempt: new Set() });

  assert.deepEqual(orphans, []);
});

test('an exempt route is never reported even with zero inbound links', () => {
  const pages = [{ route: '/styleguide', hrefs: [] }];
  const inbound = collectInboundLinks(pages);
  const orphans = findOrphans({
    routes: pages.map((page) => page.route),
    inbound,
    exempt: new Set(['/styleguide']),
  });

  assert.deepEqual(orphans, []);
});

test('the closed exempt list only excuses home and the styleguide reference, each with a stated reason', () => {
  assert.deepEqual(
    EXEMPT_ROUTES.map((entry) => entry.route),
    ['/', '/styleguide']
  );
  for (const entry of EXEMPT_ROUTES) assert.ok(entry.reason.length > 0, `${entry.route} must carry a reason`);
});

test('extractHrefs reads href and rel off every anchor tag, ignoring non-anchor markup', () => {
  const html = '<p><a href="/services" rel="nofollow">Services</a></p><link rel="canonical" href="/services">';

  assert.deepEqual(extractHrefs(html), [{ href: '/services', rel: 'nofollow' }]);
});
