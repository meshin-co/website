import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { collectInboundLinks, discoverPages, findOrphans, extractHrefs, EXEMPT_ROUTES } from './orphan-gate.mjs';

const withFlatDist = async (files, check) => {
  const dir = await mkdtemp(join(tmpdir(), 'orphan-gate-'));
  try {
    for (const [name, html] of Object.entries(files)) {
      await mkdir(dirname(join(dir, name)), { recursive: true });
      await writeFile(join(dir, name), html);
    }
    await check(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

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

test('discoverPages reads every flat page as a route and leaves the 404 page out', async () => {
  await withFlatDist(
    {
      'index.html': '<a href="/about">About</a>',
      'about.html': '',
      'blog.html': '',
      'blog/post.html': '',
      '404.html': '',
    },
    async (dist) => {
      const pages = await discoverPages(dist);

      assert.deepEqual(pages.map((page) => page.route).sort(), ['/', '/about', '/blog', '/blog/post']);
    }
  );
});

test('a page whose file name ends in index.html keeps its full route', async () => {
  await withFlatDist({ 'index.html': '', 'blog/reindex.html': '' }, async (dist) => {
    const pages = await discoverPages(dist);

    assert.deepEqual(pages.map((page) => page.route).sort(), ['/', '/blog/reindex']);
  });
});

test('a page nothing links to is reported as an orphan from a flat tree', async () => {
  await withFlatDist(
    {
      'index.html': '<a href="/about">About</a><a href="/blog">Blog</a>',
      'about.html': '<a href="/">Home</a>',
      'blog.html': '<a href="/blog/post">Post</a>',
      'blog/post.html': '<a href="/blog">Blog</a>',
      'lonely.html': '<a href="/">Home</a>',
      '404.html': '<a href="/">Home</a>',
    },
    async (dist) => {
      const pages = await discoverPages(dist);
      const orphans = findOrphans({
        routes: pages.map((page) => page.route),
        inbound: collectInboundLinks(pages),
        exempt: new Set(),
      });

      assert.deepEqual(orphans, ['/lonely']);
    }
  );
});
