import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  collectBodyLinks,
  collectInboundLinks,
  discoverPages,
  EXEMPT_ROUTES,
  extractHrefs,
  findChromeOnly,
  findOrphans,
  NAVIGATIONAL_ROUTES,
} from './orphan-gate.mjs';

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

const SITE_DIR = fileURLToPath(new URL('..', import.meta.url));

const HUB_JSON_LD =
  '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":"Hub"}]}</script>';
const NOINDEX = '<meta name="robots" content="noindex, follow">';

const doc = ({ head = '', header = '', main = '', footer = '' } = {}) =>
  `<!doctype html><html><head><title>t</title>${head}</head><body><header>${header}</header><main>${main}</main><footer>${footer}</footer></body></html>`;

const link = (href, text = 'link') => `<a href="${href}">${text}</a>`;

const pageOf = (route, links = {}) => ({
  route,
  hrefs: (links.all ?? []).map((href) => ({ href })),
  bodyHrefs: (links.body ?? []).map((href) => ({ href })),
  collection: links.collection ?? false,
  indexable: links.indexable ?? true,
});

const graphOf = (pages) => ({ inbound: collectInboundLinks(pages), bodyInbound: collectBodyLinks(pages) });

const chromeOnly = (pages, exempt = ['/']) => findChromeOnly({ pages, ...graphOf(pages), exempt: new Set(exempt) });

test('a page body link is read apart from header, footer and breadcrumb links', async () => {
  await withFlatDist(
    {
      'index.html': doc({
        header: link('/pricing'),
        main: `<nav aria-label="Breadcrumb">${link('/blog')}</nav><p>See ${link('/about')}.</p>`,
        footer: link('/contact'),
      }),
      'about.html': doc(),
    },
    async (dist) => {
      const home = (await discoverPages(dist)).find((page) => page.route === '/');

      assert.deepEqual(
        home.bodyHrefs.map((entry) => entry.href),
        ['/about']
      );
      assert.deepEqual(home.hrefs.map((entry) => entry.href).sort(), ['/about', '/blog', '/contact', '/pricing']);
    }
  );
});

test('a page that declares itself a collection is an index, and a robots noindex page is not indexable', async () => {
  await withFlatDist(
    {
      'faq.html': doc({ head: HUB_JSON_LD }),
      'search.html': doc({ head: NOINDEX }),
      'about.html': doc(),
    },
    async (dist) => {
      const pages = await discoverPages(dist);
      const byRoute = Object.fromEntries(pages.map((page) => [page.route, page]));

      assert.equal(byRoute['/faq'].collection, true);
      assert.equal(byRoute['/faq'].indexable, true);
      assert.equal(byRoute['/search'].indexable, false);
      assert.equal(byRoute['/about'].collection, false);
      assert.equal(byRoute['/about'].indexable, true);
    }
  );
});

test('a json-ld block that does not parse stops the gate and names the route', async () => {
  const broken = '<script type="application/ld+json">{not json</script>';
  await withFlatDist({ 'faq.html': doc({ head: broken }) }, async (dist) => {
    await assert.rejects(discoverPages(dist), /\/faq carries an ld\+json block that does not parse/);
  });
});

test('a hub listing, a noindex page, a nofollow link and a self link never count as a body link', () => {
  const pages = [
    pageOf('/faq', { body: ['/faq/a'], collection: true }),
    pageOf('/styleguide', { body: ['/faq/b'], indexable: false }),
    pageOf('/blog/post', { body: ['/faq/c', '/blog/post'] }),
  ];
  pages[2].bodyHrefs.push({ href: '/faq/d', rel: 'nofollow' });

  assert.deepEqual([...collectBodyLinks(pages).keys()], ['/faq/c']);
});

test('a body link is normalised like any other link: fragment, query and trailing slash fall away', () => {
  const pages = [pageOf('/', { body: ['/pricing/#fees', '/about?ref=home'] })];

  assert.deepEqual([...collectBodyLinks(pages).keys()].sort(), ['/about', '/pricing']);
});

test('a route linked only from its own hub index is named, with the hub that lists it', () => {
  const pages = [
    pageOf('/', { all: ['/faq'], body: [] }),
    pageOf('/faq', { all: ['/faq/only-listed'], body: ['/faq/only-listed'], collection: true }),
    pageOf('/faq/only-listed'),
  ];
  const found = chromeOnly(pages);

  assert.deepEqual(
    found.map((entry) => entry.route),
    ['/faq/only-listed']
  );
  assert.equal(found[0].via, 'hub listing /faq');
});

test('a contextual link from another page clears the route, and the link is the one a reader would follow', () => {
  const pages = [
    pageOf('/', { all: ['/faq', '/blog/post'], body: ['/blog/post'] }),
    pageOf('/faq', { all: ['/faq/only-listed'], body: ['/faq/only-listed'], collection: true }),
    pageOf('/faq/only-listed'),
    pageOf('/blog/post', { all: ['/faq/only-listed'], body: ['/faq/only-listed'] }),
  ];

  assert.deepEqual(chromeOnly(pages), []);
});

test('a route reached only through the header and footer of other pages is named with how many pages carry them', () => {
  const pages = [
    pageOf('/', { all: ['/a', '/b'], body: ['/a', '/b'] }),
    pageOf('/a', { all: ['/pricing'] }),
    pageOf('/b', { all: ['/pricing'] }),
    pageOf('/pricing'),
  ];
  const found = chromeOnly(pages);

  assert.deepEqual(
    found.map((entry) => entry.route),
    ['/pricing']
  );
  assert.equal(found[0].via, 'the header, footer or breadcrumb of 2 pages');
});

test('a route reached from a hub and from chrome names both, and a single page says page not pages', () => {
  const pages = [
    pageOf('/', { all: ['/faq', '/a', '/x'], body: ['/a'] }),
    pageOf('/faq', { all: ['/x'], body: ['/x'], collection: true }),
    pageOf('/a', { all: ['/x'] }),
    pageOf('/x'),
  ];

  assert.equal(chromeOnly(pages)[0].via, 'hub listing /faq; the header, footer or breadcrumb of 2 pages');
  assert.equal(
    chromeOnly([pageOf('/', { all: ['/x'] }), pageOf('/x')], [])[0].via,
    'the header, footer or breadcrumb of 1 page'
  );
});

test('the header and footer of a hub page are chrome, so a route they link is not blamed on a hub listing', () => {
  const pages = [
    pageOf('/', { all: ['/faq'], body: [] }),
    pageOf('/faq', { all: ['/pricing'], body: [], collection: true }),
    pageOf('/pricing'),
  ];

  assert.equal(chromeOnly(pages)[0].via, 'the header, footer or breadcrumb of 1 page');
});

test('a body link from a noindex page is named as such, never mistaken for a hub or for chrome', () => {
  const pages = [
    pageOf('/', { all: ['/styleguide'], body: [] }),
    pageOf('/styleguide', { all: ['/x'], body: ['/x'], indexable: false }),
    pageOf('/x'),
  ];

  assert.equal(chromeOnly(pages)[0].via, '/styleguide (noindex)');
});

test('a link in a related block on another page counts, because only an index page lists everything it holds', () => {
  const pages = [
    pageOf('/', { all: ['/faq/a'], body: ['/faq/a'] }),
    pageOf('/faq/a', { all: ['/faq/b'], body: ['/faq/b'] }),
    pageOf('/faq/b'),
  ];

  assert.deepEqual(chromeOnly(pages), []);
});

test('a route with no inbound link at all is an orphan and is not reported a second time as chrome-only', () => {
  const pages = [pageOf('/'), pageOf('/lonely')];

  assert.deepEqual(chromeOnly(pages), []);
  assert.deepEqual(
    findOrphans({ routes: ['/', '/lonely'], inbound: collectInboundLinks(pages), exempt: new Set(['/']) }),
    ['/lonely']
  );
});

test('an exempt route, a collection page and a noindex page are never required to earn a body link', () => {
  const pages = [
    pageOf('/', { all: ['/privacy', '/blog', '/search'], body: [] }),
    pageOf('/privacy'),
    pageOf('/blog', { collection: true }),
    pageOf('/search', { indexable: false }),
  ];

  assert.deepEqual(chromeOnly(pages, ['/', '/privacy']), []);
});

test('the legal notices are the only routes excused by their nature, each with a stated reason', () => {
  assert.deepEqual(
    NAVIGATIONAL_ROUTES.map((entry) => entry.route),
    ['/imprint', '/privacy', '/terms']
  );
  for (const entry of NAVIGATIONAL_ROUTES) assert.ok(entry.reason.length > 0, `${entry.route} must carry a reason`);
  assert.deepEqual(
    NAVIGATIONAL_ROUTES.filter((entry) => EXEMPT_ROUTES.some((home) => home.route === entry.route)),
    []
  );
});

const runGate = async (files) => {
  let run;
  await withFlatDist(files, async (dist) => {
    run = spawnSync('node', ['scripts/orphan-gate.mjs', dist], { cwd: SITE_DIR, encoding: 'utf8' });
  });
  return run;
};

const SITE = {
  'index.html': doc({ main: `<p>${link('/faq')} and ${link('/a')}.</p>` }),
  'faq.html': doc({ head: HUB_JSON_LD, main: `<ul><li>${link('/faq/x')}</li></ul>` }),
  'faq/x.html': doc({ main: '<p>An answer.</p>' }),
  'a.html': doc({ main: '<p>A page.</p>' }),
};

test('the gate run names a route whose only inbound link is its hub listing, exits non-zero and keeps the orphan line', async () => {
  const run = await runGate(SITE);

  assert.equal(run.status, 1);
  assert.match(run.stdout, /orphans: 0 of 4 routes have zero inbound links/);
  assert.match(run.stdout, /chrome-only: 1 of 2 routes that must earn a body link/);
  assert.match(run.stdout, /\/faq\/x is linked only from hub listing \/faq/);
});

test('the gate run passes once another page links the route from its body', async () => {
  const run = await runGate({ ...SITE, 'a.html': doc({ main: `<p>Read ${link('/faq/x')} first.</p>` }) });

  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /chrome-only: 0 of 2 routes that must earn a body link/);
});
