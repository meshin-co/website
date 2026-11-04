import { access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COLLECTION_FEED_MAX_BYTES,
  FEED_WINDOW,
  MERGED_FEED_MAX_BYTES,
  MERGED_FEED_WINDOW,
} from '../src/utils/feeds.mjs';
import { chunkPath, manifestPath, pagePath } from '../src/utils/search-index.mjs';
import {
  llmsRouteGaps,
  publicCollections,
  missingFromGenerator,
  populatedCollections,
  emptyCollections,
  entryCoverageFailures,
  feedBaseGaps,
  sidecarCandidateRoutes,
  sidecarGaps,
  sidecarContentGaps,
  hubFeedLinkGaps,
  feedCoverageFailures,
  feedWindowRoutes,
  feedSizeFindings,
  indexableCoverageGaps,
  sizeGuardFailure,
  lastmodCoverageGaps,
  sitemapNoindexLeaks,
  sitemapLastmods,
  COLLECTION_BASES,
  humansTxtFindings,
  canonicalGaps,
  machineHeaderGaps,
  lastmodExpectationGaps,
  llmsInlinedRoutes,
  isTaxonomyRoute,
  LLMS_TXT_MAX_BYTES,
  unreferencedMachineFiles,
  HEADER_GUARDED_MACHINE_FILE,
} from './machine.mjs';
import { renderHeaders } from './gen-headers.mjs';
import { PLANTED_DATED_PAGE, withCatalogPages } from './fixtures/catalog-pages.mjs';

const CONFIG = `
const postCollection = defineCollection({ loader: glob({ pattern: ['*.md'], base: 'src/data/post' }) });
export const collections = {
  post: postCollection,
  service: serviceCollection,
  resource: resourceCollection,
  glossary: glossaryCollection,
  case: caseCollection,
  faq: faqCollection,
  author: authorCollection,
  speaking: speakingCollection,
};
`;

test('a body link cannot mask an entry whose own url line is missing', () => {
  const file = [
    '# Glossary',
    '',
    'See also [the other term](https://meshin.co/glossary/other) for details.',
    '[https://meshin.co/glossary/present](https://meshin.co/glossary/present)',
  ].join('\n');

  assert.deepEqual(llmsRouteGaps(file, ['/glossary/other', '/glossary/present', '/glossary/missing']), [
    '/glossary/other',
    '/glossary/missing',
  ]);
});

test('the public collection list comes from the content config, faq included, speaking and author out', () => {
  assert.deepEqual(publicCollections(CONFIG), ['post', 'service', 'resource', 'glossary', 'case', 'faq']);
});

test('feedBaseGaps reports a collection missing from FEED_BASES instead of the caller crashing on join(distDir, undefined)', () => {
  assert.deepEqual(feedBaseGaps(['post', 'service']), []);
  assert.deepEqual(feedBaseGaps(['post', 'speaking']), ['speaking']);
  assert.equal(COLLECTION_BASES.speaking, undefined);
});

test('a speaking collection reappearing in the config stays out of the machine surfaces', () => {
  const withSpeaking = CONFIG.replace(
    '  author: authorCollection,',
    '  author: authorCollection,\n  speaking: speakingCollection,'
  );
  assert.deepEqual(publicCollections(withSpeaking), ['post', 'service', 'resource', 'glossary', 'case', 'faq']);
});

test('a generator that omits one public collection is reported', () => {
  const text = 'https://meshin.co/blog/a-post\nhttps://meshin.co/services/x\nhttps://meshin.co/resources/y';

  assert.deepEqual(missingFromGenerator(text, ['post', 'service', 'resource', 'glossary']), ['glossary']);
});

test('a generator covering every public collection including faq reports nothing', () => {
  const text = '/blog/a /services/b /resources/c /glossary/d /case-studies/e /faq/f';

  assert.deepEqual(missingFromGenerator(text, ['post', 'service', 'resource', 'glossary', 'case', 'faq']), []);
});

const LIVE = { post: ['/blog/a-post'], glossary: ['/glossary/evals'], case: [] };
const COLLECTIONS = ['post', 'glossary', 'case'];
const generators = (overrides = {}) => ({
  'feed.json': '/blog/a-post /glossary/evals',
  sitemap: '/blog/a-post /glossary/evals',
  ...overrides,
});

test('a collection with no live entry has nothing to cover, a populated one does not escape', () => {
  assert.deepEqual(populatedCollections(COLLECTIONS, LIVE), ['post', 'glossary']);
  assert.deepEqual(emptyCollections(COLLECTIONS, LIVE), ['case']);
  assert.deepEqual(populatedCollections(['post', 'faq'], { post: ['/blog/a-post'] }), ['post']);
  assert.deepEqual(emptyCollections(['post', 'faq'], { post: ['/blog/a-post'] }), ['faq']);
});

test('an emptied collection needs no entry in any generator', () => {
  assert.deepEqual(entryCoverageFailures(COLLECTIONS, LIVE, generators()), []);
});

test('a populated collection missing from one generator is still reported, with an empty collection beside it', () => {
  const failures = entryCoverageFailures(
    COLLECTIONS,
    LIVE,
    generators({ 'feed.json': '/blog/a-post', sitemap: '/glossary/evals' })
  );

  assert.deepEqual(failures, ['feed.json covers no glossary entry', 'sitemap covers no post entry']);
});

test('every populated collection is reported by every generator that omits it, and the empty one is never named', () => {
  const omitted = generators({ 'feed.json': '', sitemap: '' });

  assert.deepEqual(entryCoverageFailures(COLLECTIONS, LIVE, omitted), [
    'feed.json covers no post entry',
    'feed.json covers no glossary entry',
    'sitemap covers no post entry',
    'sitemap covers no glossary entry',
  ]);
});

test('when no collection has a live entry the gate says it checked nothing, it does not pass', () => {
  const none = { post: [], glossary: [], case: [] };

  assert.deepEqual(entryCoverageFailures(COLLECTIONS, none, generators()), [
    'no public collection has a live entry, so generator coverage was not checked',
  ]);
});

const PAGE = PLANTED_DATED_PAGE.path;
const onPlantedPage = (run) => withCatalogPages([PLANTED_DATED_PAGE], run);

test('a page whose markdown sidecar was not built is reported', () =>
  onPlantedPage(() => {
    const gaps = sidecarGaps(['/blog/a-post', '/glossary/evals', PAGE], { '/blog/a-post': '# A post\n\nbody' });

    assert.deepEqual(gaps, ['/glossary/evals.md', `${PAGE}.md`]);
  }));

test('sidecarGaps also requires a sidecar for a collection hub page, not only its leaves', () => {
  const gaps = sidecarGaps(['/blog', '/blog/a-post'], { '/blog/a-post': '# A post\n\nbody' });

  assert.deepEqual(gaps, ['/blog.md']);
});

test('sidecarCandidateRoutes never asks for a sidecar on a noindex-only helper route like /blog/tags reserved slugs', () => {
  const candidates = sidecarCandidateRoutes(['/blog/tag/governance', '/blog/category/governance', '/blog/a-post']);
  assert.deepEqual(candidates, ['/blog/a-post']);
});

const SITE = { site: 'https://meshin.co' };

const SIDECAR = (overrides = {}) =>
  [
    `# ${overrides.title ?? PLANTED_DATED_PAGE.title}`,
    '',
    '> A description.',
    '',
    `Source: ${overrides.source ?? `${SITE.site}${PAGE}`}`,
    `Updated: ${overrides.updated ?? '2026-09-05'}`,
    '',
    '---',
    '',
    overrides.body ?? 'Real body prose about the page.',
  ].join('\n');

test('sidecarContentGaps reports nothing for a sidecar carrying a title, matching canonical, a dated line and real prose', () =>
  onPlantedPage(() => {
    assert.deepEqual(sidecarContentGaps([PAGE], { [PAGE]: SIDECAR() }, SITE), []);
  }));

test('sidecarContentGaps reports a sidecar whose body is empty even though the file exists', () =>
  onPlantedPage(() => {
    const gaps = sidecarContentGaps([PAGE], { [PAGE]: SIDECAR({ body: '' }) }, SITE);
    assert.deepEqual(gaps, [`sidecar for ${PAGE} body is empty`]);
  }));

test('sidecarContentGaps reports a sidecar whose canonical does not match its own route', () =>
  onPlantedPage(() => {
    const gaps = sidecarContentGaps([PAGE], { [PAGE]: SIDECAR({ source: `${SITE.site}/wrong-page` }) }, SITE);
    assert.deepEqual(gaps, [`sidecar for ${PAGE} canonical is ${SITE.site}/wrong-page, expected ${SITE.site}${PAGE}`]);
  }));

test('sidecarContentGaps reports a sidecar with no parseable Updated date', () =>
  onPlantedPage(() => {
    const gaps = sidecarContentGaps([PAGE], { [PAGE]: SIDECAR({ updated: 'not-a-date' }) }, SITE);
    assert.deepEqual(gaps, [`sidecar for ${PAGE} carries no updated date`]);
  }));

test('hubFeedLinkGaps reports nothing when a hub head carries its own collection feed link', () => {
  const html = '<head><link rel="alternate" type="application/rss+xml" title="x" href="/blog/rss.xml"></head>';
  assert.deepEqual(hubFeedLinkGaps(['/blog'], { '/blog': html }), []);
});

test('hubFeedLinkGaps reports a hub whose head only advertises the merged feed, not its own collection feed', () => {
  const html = '<head><link rel="alternate" type="application/rss+xml" title="x" href="/rss.xml"></head>';
  assert.deepEqual(hubFeedLinkGaps(['/blog'], { '/blog': html }), ['/blog']);
});

test('hubFeedLinkGaps ignores a plain href match that never carries rel="alternate"', () => {
  const html = '<a href="/blog/rss.xml">feed</a>';
  assert.deepEqual(hubFeedLinkGaps(['/blog'], { '/blog': html }), ['/blog']);
});

const head = (canonical, ogUrl) =>
  `<head><link rel="canonical" href="${canonical}"><meta property="og:url" content="${ogUrl}"></head>`;

test('canonicalGaps reports nothing when every page names its own bare URL, the home page naming the origin', () => {
  const pages = {
    '/': head('https://meshin.co', 'https://meshin.co'),
    '/about': head('https://meshin.co/about', 'https://meshin.co/about'),
    '/blog/page/2': head('https://meshin.co/blog/page/2', 'https://meshin.co/blog/page/2'),
  };
  assert.deepEqual(canonicalGaps(pages, SITE), []);
});

test('canonicalGaps reports a canonical that names the built file instead of the route', () => {
  const pages = { '/about': head('https://meshin.co/about.html', 'https://meshin.co/about') };
  assert.deepEqual(canonicalGaps(pages, SITE), [
    '/about canonical is https://meshin.co/about.html, expected https://meshin.co/about',
  ]);
});

test('canonicalGaps reports the home page canonical when it names index.html or carries a trailing slash', () => {
  const named = { '/': head('https://meshin.co/index.html', 'https://meshin.co') };
  const slashed = { '/': head('https://meshin.co/', 'https://meshin.co') };
  assert.deepEqual(canonicalGaps(named, SITE), [
    '/ canonical is https://meshin.co/index.html, expected https://meshin.co',
  ]);
  assert.deepEqual(canonicalGaps(slashed, SITE), ['/ canonical is https://meshin.co/, expected https://meshin.co']);
});

test('canonicalGaps reports a canonical with a trailing slash on a non-root route', () => {
  const pages = { '/about': head('https://meshin.co/about/', 'https://meshin.co/about') };
  assert.deepEqual(canonicalGaps(pages, SITE), [
    '/about canonical is https://meshin.co/about/, expected https://meshin.co/about',
  ]);
});

test('canonicalGaps reports an og:url that drifts from the route even when the canonical is right', () => {
  const pages = { '/about': head('https://meshin.co/about', 'https://meshin.co/about.html') };
  assert.deepEqual(canonicalGaps(pages, SITE), [
    '/about og:url is https://meshin.co/about.html, expected https://meshin.co/about',
  ]);
});

test('canonicalGaps reports a page that carries no canonical link and no og:url', () => {
  assert.deepEqual(canonicalGaps({ '/about': '<head><title>x</title></head>' }, SITE), [
    '/about canonical is (missing), expected https://meshin.co/about',
    '/about og:url is (missing), expected https://meshin.co/about',
  ]);
});

test('canonicalGaps reads both tags whatever order their attributes come in, and ignores every other link and meta', () => {
  const html =
    '<head><link rel="alternate" type="text/markdown" href="https://meshin.co/about.html">' +
    '<meta property="og:image" content="https://meshin.co/og/about.html">' +
    '<link href="https://meshin.co/about" rel="canonical"><meta content="https://meshin.co/about" property="og:url"></head>';
  assert.deepEqual(canonicalGaps({ '/about': html }, SITE), []);
});

test('an indexable dist route missing from llms.txt is reported as a coverage gap', () => {
  const routes = ['/blog', '/blog/a-post', '/search'];
  const gaps = indexableCoverageGaps({
    routes,
    listed: ['/blog/a-post'],
    noindexRoutes: ['/search'],
  });
  assert.deepEqual(gaps, ['/blog']);
});

test('a noindex route missing from llms.txt is never reported, it is meant to stay off it', () => {
  const gaps = indexableCoverageGaps({
    routes: ['/styleguide'],
    listed: [],
    noindexRoutes: new Set(['/styleguide']),
  });
  assert.deepEqual(gaps, []);
});

test('a route already listed in llms.txt is never reported twice, even when it would also be indexable', () => {
  const gaps = indexableCoverageGaps({
    routes: ['/glossary/evals'],
    listed: new Set(['/glossary/evals']),
    noindexRoutes: [],
  });
  assert.deepEqual(gaps, []);
});

test('sizeGuardFailure reports nothing while a file stays under its byte guard', () => {
  assert.deepEqual(sizeGuardFailure('llms-full.txt', 1000, 4096), []);
  assert.deepEqual(sizeGuardFailure('llms-full.txt', 4096, 4096), []);
});

test('sizeGuardFailure reports the exact byte count and guard once a file grows past it, so growth cannot go unnoticed', () => {
  assert.deepEqual(sizeGuardFailure('llms-full.txt', 5000, 4096), [
    'llms-full.txt is 5000 bytes, over the 4096 byte guard',
  ]);
  assert.deepEqual(sizeGuardFailure('llms/post-1.txt', 100_001, 100_000), [
    'llms/post-1.txt is 100001 bytes, over the 100000 byte guard',
  ]);
});

const sitemapFixture = (urls) =>
  `<urlset>${urls.map(({ loc, dated }) => `<url><loc>${loc}</loc>${dated ? '<lastmod>2026-09-08T00:00:00.000Z</lastmod>' : ''}</url>`).join('')}</urlset>`;

test('lastmodCoverageGaps reports a route present in the sitemap without a lastmod element', () => {
  const sitemap = sitemapFixture([
    { loc: 'https://meshin.co/blog', dated: true },
    { loc: 'https://meshin.co/faq', dated: false },
  ]);

  assert.deepEqual(lastmodCoverageGaps(sitemap, ['/blog', '/faq']), ['/faq']);
});

test('lastmodCoverageGaps reports a route missing from the sitemap entirely, not just an undated one', () => {
  const sitemap = sitemapFixture([{ loc: 'https://meshin.co/blog', dated: true }]);

  assert.deepEqual(lastmodCoverageGaps(sitemap, ['/blog', '/about']), ['/about']);
});

test('sitemapLastmods reads each route lastmod as written and null for a route listed without one', () => {
  const sitemap = sitemapFixture([
    { loc: 'https://meshin.co', dated: true },
    { loc: 'https://meshin.co/blog', dated: true },
    { loc: 'https://meshin.co/faq', dated: false },
  ]);

  assert.deepEqual(
    [...sitemapLastmods(sitemap)],
    [
      ['/', '2026-09-08T00:00:00.000Z'],
      ['/blog', '2026-09-08T00:00:00.000Z'],
      ['/faq', null],
    ]
  );
});

test('sitemapNoindexLeaks reports a route that is both noindex and still listed in the sitemap, never a live route', () => {
  const sitemap = sitemapFixture([
    { loc: 'https://meshin.co/blog/category/executive', dated: true },
    { loc: 'https://meshin.co/blog/live-post', dated: true },
  ]);

  assert.deepEqual(sitemapNoindexLeaks(sitemap, new Set(['/blog/category/executive', '/blog/category/governance'])), [
    '/blog/category/executive',
  ]);
  assert.deepEqual(sitemapNoindexLeaks(sitemap, new Set(['/blog/category/governance'])), []);
});

const feedItem = (url) => `<item><guid isPermaLink="true">${url}</guid></item>`;
const buildFeed = (urls) => `<rss><channel>${urls.map(feedItem).join('')}</channel></rss>`;
const ORIGIN = 'https://meshin.co';

const stampOf = (daysAgo) => new Date(Date.UTC(2026, 9, 31) - daysAgo * 86_400_000).toISOString();
const newestFirst = (routes) => new Map(routes.map((route, index) => [route, stampOf(index)]));

const coverageInput = {
  perCollectionFeeds: {
    faq: buildFeed([`${ORIGIN}/faq/how-do-you-charge`, `${ORIGIN}/faq/what-is-an-assessment`]),
    post: buildFeed([
      `${ORIGIN}/blog/newest`,
      `${ORIGIN}/blog/second`,
      `${ORIGIN}/blog/third`,
      `${ORIGIN}/blog/fourth`,
      `${ORIGIN}/blog/fifth`,
    ]),
  },
  mergedFeed: buildFeed([
    `${ORIGIN}/blog/newest`,
    `${ORIGIN}/blog/second`,
    `${ORIGIN}/blog/third`,
    `${ORIGIN}/blog/fourth`,
    `${ORIGIN}/blog/fifth`,
    `${ORIGIN}/faq/how-do-you-charge`,
    `${ORIGIN}/faq/what-is-an-assessment`,
  ]),
  jsonFeedItems: [
    `${ORIGIN}/blog/newest`,
    `${ORIGIN}/blog/second`,
    `${ORIGIN}/blog/third`,
    `${ORIGIN}/blog/fourth`,
    `${ORIGIN}/blog/fifth`,
    `${ORIGIN}/faq/how-do-you-charge`,
    `${ORIGIN}/faq/what-is-an-assessment`,
  ],
  liveRoutesByKind: {
    faq: ['/faq/how-do-you-charge', '/faq/what-is-an-assessment'],
    post: ['/blog/newest', '/blog/second', '/blog/third', '/blog/fourth', '/blog/fifth'],
  },
  lastmods: newestFirst([
    '/blog/newest',
    '/blog/second',
    '/blog/third',
    '/blog/fourth',
    '/blog/fifth',
    '/faq/how-do-you-charge',
    '/faq/what-is-an-assessment',
  ]),
};

test('a per-collection feed carrying every live entry, the merged floor and the json mirror reports nothing', () => {
  assert.deepEqual(feedCoverageFailures(['faq', 'post'], coverageInput), []);
});

test('a per-collection feed that omits a live entry is reported with the missing route', () => {
  const input = {
    ...coverageInput,
    perCollectionFeeds: { ...coverageInput.perCollectionFeeds, faq: buildFeed([`${ORIGIN}/faq/how-do-you-charge`]) },
  };

  assert.deepEqual(feedCoverageFailures(['faq', 'post'], input), ['/faq/rss.xml omits /faq/what-is-an-assessment']);
});

test('a merged feed that lets a kind fall under its floor of five is reported', () => {
  const input = {
    ...coverageInput,
    mergedFeed: buildFeed([
      `${ORIGIN}/blog/newest`,
      `${ORIGIN}/blog/second`,
      `${ORIGIN}/faq/how-do-you-charge`,
      `${ORIGIN}/faq/what-is-an-assessment`,
    ]),
    jsonFeedItems: [
      `${ORIGIN}/blog/newest`,
      `${ORIGIN}/blog/second`,
      `${ORIGIN}/faq/how-do-you-charge`,
      `${ORIGIN}/faq/what-is-an-assessment`,
    ],
  };

  assert.deepEqual(feedCoverageFailures(['faq', 'post'], input), ['merged rss.xml carries 2 post entries, floor is 5']);
});

test('a feed.json whose items drift from the merged feed in order or count is reported', () => {
  const reordered = {
    ...coverageInput,
    jsonFeedItems: [...coverageInput.jsonFeedItems.slice(1), coverageInput.jsonFeedItems[0]],
  };
  const shortened = { ...coverageInput, jsonFeedItems: coverageInput.jsonFeedItems.slice(0, -1) };

  assert.deepEqual(feedCoverageFailures(['faq', 'post'], reordered), [
    'feed.json does not mirror rss.xml item-for-item',
  ]);
  assert.deepEqual(feedCoverageFailures(['faq', 'post'], shortened), [
    'feed.json does not mirror rss.xml item-for-item',
  ]);
});

test('a kind with fewer live entries than the floor is held to its full live count, not to five', () => {
  const single = {
    perCollectionFeeds: { case: buildFeed([`${ORIGIN}/case-studies/example-case`]) },
    mergedFeed: buildFeed([`${ORIGIN}/case-studies/example-case`]),
    jsonFeedItems: [`${ORIGIN}/case-studies/example-case`],
    liveRoutesByKind: { case: ['/case-studies/example-case'] },
    lastmods: newestFirst(['/case-studies/example-case']),
  };

  assert.deepEqual(feedCoverageFailures(['case'], single), []);
});

const urlsOf = (routes) => routes.map((route) => `${ORIGIN}${route}`);
const postRoutes = (count) =>
  Array.from({ length: count }, (_, index) => `/blog/post-${String(index).padStart(2, '0')}`);

const windowWorld = ({ live = 17, feed = FEED_WINDOW, merged = 5 } = {}) => {
  const routes = postRoutes(live);
  const mergedUrls = urlsOf(routes.slice(0, merged));
  return {
    perCollectionFeeds: { post: buildFeed(urlsOf(routes.slice(0, feed))) },
    mergedFeed: buildFeed(mergedUrls),
    jsonFeedItems: mergedUrls,
    liveRoutesByKind: { post: routes },
    lastmods: newestFirst(routes),
  };
};

test('a collection with more live entries than its window owes its feed the newest 15 and no older entry', () => {
  assert.deepEqual(feedCoverageFailures(['post'], windowWorld({ live: 17, feed: 15 })), []);
});

test('a feed missing entries inside its window is reported, one line for each, and the older entries owe nothing', () => {
  const world = { ...windowWorld({ live: 17 }), perCollectionFeeds: { post: buildFeed(urlsOf(postRoutes(13))) } };
  assert.deepEqual(feedCoverageFailures(['post'], world), [
    '/blog/rss.xml omits /blog/post-13',
    '/blog/rss.xml omits /blog/post-14',
  ]);
});

test('a feed that carries one item more than its window is reported with the count and the window', () => {
  assert.deepEqual(feedCoverageFailures(['post'], windowWorld({ live: 17, feed: 16 })), [
    '/blog/rss.xml carries 16 items, window is 15',
  ]);
});

test('a feed that lacks a window entry and carries too many items reports the omission, then the count', () => {
  const items = [...postRoutes(15).slice(1), '/blog/post-15', '/blog/post-16'];
  const world = { ...windowWorld({ live: 17 }), perCollectionFeeds: { post: buildFeed(urlsOf(items)) } };
  assert.deepEqual(feedCoverageFailures(['post'], world), [
    '/blog/rss.xml omits /blog/post-00',
    '/blog/rss.xml carries 16 items, window is 15',
  ]);
});

test('the merged feed is held to its window of 50 items, and exactly 50 is clean', () => {
  const merged = (count) => windowWorld({ live: count, merged: count });

  assert.deepEqual(feedCoverageFailures(['post'], merged(MERGED_FEED_WINDOW)), []);
  assert.deepEqual(feedCoverageFailures(['post'], merged(MERGED_FEED_WINDOW + 1)), [
    'merged rss.xml carries 51 items, window is 50',
  ]);
});

test('the window follows the lastmod the sitemap states for each route, so a re-dated entry joins it', () => {
  const routes = postRoutes(17);
  const stated = sitemapLastmods(
    `<urlset>${[...newestFirst(routes)].map(([route, stamp]) => `<url><loc>${ORIGIN}${route}</loc><lastmod>${stamp}</lastmod></url>`).join('')}</urlset>`
  );
  const redated = new Map(stated).set('/blog/post-16', stampOf(-1));
  const world = windowWorld({ live: 17 });

  assert.deepEqual(feedCoverageFailures(['post'], { ...world, lastmods: stated }), []);
  assert.deepEqual(feedCoverageFailures(['post'], { ...world, lastmods: redated }), [
    '/blog/rss.xml omits /blog/post-16',
  ]);
});

test('the window is the newest entries by lastmod then route, whatever order the routes arrive in', () => {
  const routes = postRoutes(17);
  const handedIn = [...routes].reverse();
  const before = [...handedIn];

  assert.deepEqual(feedWindowRoutes(handedIn, newestFirst(routes)), routes.slice(0, FEED_WINDOW));
  assert.deepEqual(handedIn, before);
});

test('entries tied on lastmod are cut by route ascending, the way the feed generator cuts them', () => {
  const routes = postRoutes(16);
  const tied = new Map(routes.map((route) => [route, stampOf(0)]));
  assert.deepEqual(feedWindowRoutes([...routes].reverse(), tied), routes.slice(0, FEED_WINDOW));
});

test('an entry with no lastmod, or a null one, sorts oldest and falls outside a full window', () => {
  const routes = postRoutes(16);
  const lastmods = newestFirst(routes.slice(1));
  assert.deepEqual(feedWindowRoutes(routes, lastmods), routes.slice(1));
  assert.deepEqual(feedWindowRoutes(routes, lastmods.set(routes[0], null)), routes.slice(1));
});

test('a collection with fewer entries than its window owes the feed all of them, and one with none owes nothing', () => {
  const routes = postRoutes(3);
  assert.deepEqual(feedWindowRoutes([...routes].reverse(), newestFirst(routes)), routes);
  assert.deepEqual(feedWindowRoutes([], new Map()), []);
  assert.deepEqual(feedCoverageFailures(['post'], { ...windowWorld({ live: 0, feed: 0, merged: 0 }) }), []);
});

const OVER_COLLECTION = COLLECTION_FEED_MAX_BYTES + 1;
const OVER_MERGED = MERGED_FEED_MAX_BYTES + 1;
const feedFiles = (overrides = {}) => ({
  perCollectionFeeds: { post: 'x', faq: 'x' },
  mergedFeed: 'x',
  feedJson: 'x',
  ...overrides,
});

test('a collection feed is held to 432315 bytes, the merged feed and feed.json to 1441050', () => {
  const findings = feedSizeFindings(
    ['post', 'faq'],
    feedFiles({
      perCollectionFeeds: { post: 'x'.repeat(500_000), faq: 'x'.repeat(COLLECTION_FEED_MAX_BYTES) },
      mergedFeed: 'x'.repeat(OVER_MERGED),
      feedJson: 'x'.repeat(OVER_MERGED),
    })
  );

  assert.equal(COLLECTION_FEED_MAX_BYTES, 432_315);
  assert.equal(MERGED_FEED_MAX_BYTES, 1_441_050);
  assert.deepEqual(findings, [
    { text: 'blog/rss.xml is 500000 bytes, over the 432315 byte guard', subjects: ['/blog/rss.xml'] },
    { text: 'rss.xml is 1441051 bytes, over the 1441050 byte guard', subjects: ['/rss.xml'] },
    { text: 'feed.json is 1441051 bytes, over the 1441050 byte guard', subjects: ['/feed.json'] },
  ]);
});

test('feeds at their byte guards are clean, and the collection guard is not the merged guard', () => {
  const atGuards = feedFiles({
    perCollectionFeeds: { post: 'x'.repeat(COLLECTION_FEED_MAX_BYTES) },
    mergedFeed: 'x'.repeat(OVER_COLLECTION),
    feedJson: 'x'.repeat(MERGED_FEED_MAX_BYTES),
  });
  assert.deepEqual(feedSizeFindings(['post'], atGuards), []);
});

test('feed sizes are counted in bytes, so multi-byte text cannot hide under the character count', () => {
  const wide = 'é'.repeat(OVER_COLLECTION / 2);
  assert.ok(wide.length < COLLECTION_FEED_MAX_BYTES);
  assert.deepEqual(feedSizeFindings(['post'], feedFiles({ perCollectionFeeds: { post: wide } })), [
    { text: `blog/rss.xml is ${OVER_COLLECTION} bytes, over the 432315 byte guard`, subjects: ['/blog/rss.xml'] },
  ]);
});

test('a collection with no feed base has no feed file to measure, and an unread feed measures zero', () => {
  const ghost = feedFiles({ perCollectionFeeds: { ghost: 'x'.repeat(500_000) } });
  assert.deepEqual(feedSizeFindings(['ghost', 'post'], ghost), []);
});

const FEED_ENDPOINTS = [
  'src/pages/rss.xml.ts',
  'src/pages/blog/rss.xml.ts',
  'src/pages/glossary/rss.xml.ts',
  'src/pages/resources/rss.xml.ts',
  'src/pages/case-studies/rss.xml.ts',
  'src/pages/faq/rss.xml.ts',
  'src/pages/services/rss.xml.ts',
];

test('the merged feed and one endpoint per public collection exist, so the gate has something to check', async () => {
  await Promise.all(FEED_ENDPOINTS.map((endpoint) => access(endpoint)));
  assert.equal(FEED_ENDPOINTS.length, Object.keys(COLLECTION_BASES).length + 1);
});

test('a component named in humans.txt that the project does not depend on is a finding', () => {
  const findings = humansTxtFindings('Components: Astro, Tailwind CSS, Pagefind\n', {
    astro: '7.3.1',
    tailwindcss: '4.3.3',
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].detail, /Pagefind/);
});

test('every component backed by a dependency is clean, matched case- and space-insensitively', () => {
  assert.deepEqual(humansTxtFindings('Components: Astro, Tailwind CSS\n', { astro: '7', tailwindcss: '4' }), []);
});

test('a humans.txt with no components line is a finding, because the file claims to describe the stack', () => {
  assert.equal(humansTxtFindings('/* TEAM */\nSite: https://meshin.co\n', { astro: '7' }).length, 1);
});

const HEADERS = `/*
  X-Frame-Options: DENY

/rss.xml
  X-Robots-Tag: noindex

/*/rss.xml
  X-Robots-Tag: noindex

/llms.txt
  X-Robots-Tag: noindex

/llms/*
  X-Robots-Tag: noindex

https://:project.pages.dev/*
  X-Robots-Tag: noindex
`;

test('every machine file matched by a noindex rule is clean', () => {
  assert.deepEqual(
    machineHeaderGaps(HEADERS, ['/rss.xml', '/blog/rss.xml', '/llms.txt', '/llms/post.txt', '/llms/post-3.txt']),
    []
  );
});

test('a machine file no header rule matches is named, because it ships without the rule its siblings carry', () => {
  assert.deepEqual(machineHeaderGaps(HEADERS, ['/llms.txt', '/llms-full.txt']), [
    '/llms-full.txt carries no X-Robots-Tag rule, its siblings carry noindex',
  ]);
});

test('a machine file whose rule differs from noindex is named with the value it carries', () => {
  const headers = HEADERS.replace('/llms/*\n  X-Robots-Tag: noindex', '/llms/*\n  X-Robots-Tag: all');
  assert.deepEqual(machineHeaderGaps(headers, ['/llms.txt', '/llms/faq.txt', '/llms/post-3.txt']), [
    '/llms/faq.txt carries X-Robots-Tag "all", its siblings carry noindex',
    '/llms/post-3.txt carries X-Robots-Tag "all", its siblings carry noindex',
  ]);
});

test('the catch-all block and a preview-host rule never count as a machine file rule', () => {
  assert.deepEqual(machineHeaderGaps(HEADERS, ['/other.txt']), [
    '/other.txt carries no X-Robots-Tag rule, its siblings carry noindex',
  ]);
});

test('the header policy the build writes holds the llms index and every numbered shard to noindex', () => {
  const files = ['/llms.txt', '/llms-full.txt', '/llms/post.txt', '/llms/post-1.txt', '/llms/post-12.txt'];
  assert.deepEqual(machineHeaderGaps(renderHeaders([]), files), []);
});

const SEARCH_INDEX_VERSION = '0123456789';
const SEARCH_INDEX_FILES = [
  manifestPath,
  chunkPath(SEARCH_INDEX_VERSION, 0),
  chunkPath(SEARCH_INDEX_VERSION, 12),
  pagePath(SEARCH_INDEX_VERSION, 0),
];
const guardedAmong = (shipped) => shipped.filter((file) => HEADER_GUARDED_MACHINE_FILE.test(file));

test('the search index manifest, its term chunks and its document pages are held to the noindex header, beside markdown sidecars', () => {
  const shipped = ['/about.html', '/about.md', '/robots.txt', ...SEARCH_INDEX_FILES, '/og/blog/a.png'];

  assert.deepEqual(guardedAmong(shipped), ['/about.md', ...SEARCH_INDEX_FILES]);
});

test('a missing noindex header on the search index manifest is reported', () => {
  assert.deepEqual(machineHeaderGaps(HEADERS, guardedAmong(['/about.html', manifestPath])), [
    '/search-index/manifest.json carries no X-Robots-Tag rule, its siblings carry noindex',
  ]);
});

test('the header policy the build writes holds every file of the search index to noindex', () => {
  const guarded = guardedAmong(SEARCH_INDEX_FILES);

  assert.deepEqual(guarded, SEARCH_INDEX_FILES);
  assert.deepEqual(machineHeaderGaps(renderHeaders([]), guarded), []);
});

test('a machine file named by a page, another machine file or nothing at all', () => {
  const files = ['/llms.txt', '/llms-full.txt', '/rss.xml', '/blog/rss.xml'];
  const referencing = {
    '/index.html': '<link href="/llms.txt" rel="alternate"><link href="/rss.xml" rel="alternate">',
    '/llms.txt': '- [Writing feed](https://meshin.co/blog/rss.xml)',
  };
  assert.deepEqual(unreferencedMachineFiles(files, referencing), ['/llms-full.txt']);
});

test('a file that names only itself is still unreferenced', () => {
  assert.deepEqual(unreferencedMachineFiles(['/llms.txt'], { '/llms.txt': 'see https://meshin.co/llms.txt' }), [
    '/llms.txt',
  ]);
});

test('/rss.xml is not credited by a reference to /blog/rss.xml', () => {
  assert.deepEqual(unreferencedMachineFiles(['/rss.xml'], { '/index.html': '<a href="/blog/rss.xml">' }), ['/rss.xml']);
});

const INLINE_LIVE = {
  service: ['/services/sprint'],
  post: ['/blog/a-post', '/blog/b-post'],
  glossary: ['/glossary/evals'],
};

test('a bounded collection may list its entries inline, an unbounded one may not', () => {
  const llms = '- [Sprint](https://meshin.co/services/sprint)\n- [A post](https://meshin.co/blog/a-post)\n';
  assert.deepEqual(llmsInlinedRoutes(llms, INLINE_LIVE, ['service']), ['/blog/a-post']);
});

test('a collection pointed at by its /llms file and nothing else has no inlined entry', () => {
  const llms = '- [Writing](https://meshin.co/llms/post.txt): 2 entries\n- [Hub](https://meshin.co/blog)\n';
  assert.deepEqual(llmsInlinedRoutes(llms, INLINE_LIVE, ['service']), []);
});

test('llms-full.txt owes no collection an inline listing, so a bounded collection is inlined there too', () => {
  const llms = '- [Sprint](https://meshin.co/services/sprint)\n- [A post](https://meshin.co/blog/a-post)\n';
  assert.deepEqual(llmsInlinedRoutes(llms, INLINE_LIVE, []), ['/services/sprint', '/blog/a-post']);
});

test('a pointer to a collection file in llms-full.txt is not an inlined entry', () => {
  const llms = '- [Writing](https://meshin.co/llms/post.txt): 10 entries, full body text of each.\n';
  assert.deepEqual(llmsInlinedRoutes(llms, INLINE_LIVE, []), []);
});

test('every inlined entry of every unbounded collection is named, in collection order', () => {
  const llms = 'https://meshin.co/glossary/evals\nhttps://meshin.co/blog/b-post\n';
  assert.deepEqual(llmsInlinedRoutes(llms, INLINE_LIVE, ['service']), ['/blog/b-post', '/glossary/evals']);
});

test('taxonomy routes under a collection are not listed by design, hubs and leaves are', () => {
  for (const route of ['/blog/tag/ai-pilots', '/blog/category/governance', '/blog/tags', '/blog/page/2']) {
    assert.equal(isTaxonomyRoute(route), true, route);
  }
  for (const route of ['/blog', '/blog/a-post', '/about', '/']) assert.equal(isTaxonomyRoute(route), false, route);
});

test('the llms.txt byte budget is a whole-KiB figure of at most 32 KiB', () => {
  assert.equal(LLMS_TXT_MAX_BYTES % 1024, 0);
  assert.ok(LLMS_TXT_MAX_BYTES <= 32 * 1024);
});

test('a file referenced only by another machine file is reached when that file is itself referenced', () => {
  const files = ['/llms.txt', '/llms/post.txt', '/llms/post-1.txt'];
  const referencing = {
    '/index.html': '<link href="/llms.txt" rel="alternate">',
    '/llms.txt': '- [Writing](https://meshin.co/llms/post.txt): 250 entries',
    '/llms/post.txt': '- [Entries 1-100](https://meshin.co/llms/post-1.txt): 100 entries',
  };
  assert.deepEqual(unreferencedMachineFiles(files, referencing), []);
});

test('two machine files that name only each other are both unreferenced', () => {
  const files = ['/llms/post-1.txt', '/llms/post-2.txt'];
  const referencing = {
    '/llms/post-1.txt': 'Next part: [https://meshin.co/llms/post-2.txt](https://meshin.co/llms/post-2.txt)',
    '/llms/post-2.txt': 'Entries: [https://meshin.co/llms/post-1.txt](https://meshin.co/llms/post-1.txt)',
  };
  assert.deepEqual(unreferencedMachineFiles(files, referencing), ['/llms/post-1.txt', '/llms/post-2.txt']);
});

test('a numbered shard its index does not name is unreferenced, beside shards that are named', () => {
  const files = ['/llms.txt', '/llms/post.txt', '/llms/post-1.txt', '/llms/post-3.txt'];
  const referencing = {
    '/index.html': '<link href="/llms.txt" rel="alternate">',
    '/llms.txt': '- [Writing](https://meshin.co/llms/post.txt): 4 entries',
    '/llms/post.txt': '- [Entries 1-3](https://meshin.co/llms/post-1.txt): 3 entries',
  };
  assert.deepEqual(unreferencedMachineFiles(files, referencing), ['/llms/post-3.txt']);
});

test('a sitemap lastmod check that would walk an empty list says so instead of passing', () => {
  assert.deepEqual(lastmodExpectationGaps(3), []);
  assert.deepEqual(lastmodExpectationGaps(0), [
    'the build derives no expected sitemap lastmod, so no sitemap entry was checked for one',
  ]);
});
