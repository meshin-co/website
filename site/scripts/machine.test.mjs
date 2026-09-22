import { access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  llmsRouteGaps,
  publicCollections,
  missingFromGenerator,
  sidecarCandidateRoutes,
  sidecarGaps,
  sidecarContentGaps,
  hubFeedLinkGaps,
  feedCoverageFailures,
  indexableCoverageGaps,
  sizeGuardFailure,
  lastmodCoverageGaps,
  COLLECTION_BASES,
  humansTxtFindings,
} from './machine.mjs';

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

test('a page whose markdown sidecar was not built is reported', () => {
  const gaps = sidecarGaps(['/blog/a-post', '/glossary/evals', '/about'], { '/blog/a-post': '# A post\n\nbody' });

  assert.deepEqual(gaps, ['/glossary/evals.md', '/about.md']);
});

test('sidecarGaps also requires a sidecar for a collection hub page, not only its leaves', () => {
  const gaps = sidecarGaps(['/blog', '/blog/a-post'], { '/blog/a-post': '# A post\n\nbody' });

  assert.deepEqual(gaps, ['/blog.md']);
});

test('sidecarCandidateRoutes never asks for a sidecar on a noindex-only helper route like /blog/tags reserved slugs', () => {
  const candidates = sidecarCandidateRoutes(['/blog/tag/governance', '/blog/category/governance', '/blog/a-post']);
  assert.deepEqual(candidates, ['/blog/a-post']);
});

const SIDECAR = (overrides = {}) =>
  [
    `# ${overrides.title ?? 'About Dmitri Meshin'}`,
    '',
    '> A description.',
    '',
    `Source: ${overrides.source ?? 'https://meshin.co/about'}`,
    `Updated: ${overrides.updated ?? '2026-09-05'}`,
    '',
    '---',
    '',
    overrides.body ?? 'Real body prose about the page.',
  ].join('\n');

test('sidecarContentGaps reports nothing for a sidecar carrying a title, matching canonical, a dated line and real prose', () => {
  const gaps = sidecarContentGaps(['/about'], { '/about': SIDECAR() }, { site: 'https://meshin.co' });
  assert.deepEqual(gaps, []);
});

test('sidecarContentGaps reports a sidecar whose body is empty even though the file exists', () => {
  const gaps = sidecarContentGaps(['/about'], { '/about': SIDECAR({ body: '' }) }, { site: 'https://meshin.co' });
  assert.deepEqual(gaps, ['sidecar for /about body is empty']);
});

test('sidecarContentGaps reports a sidecar whose canonical does not match its own route', () => {
  const gaps = sidecarContentGaps(
    ['/about'],
    { '/about': SIDECAR({ source: 'https://meshin.co/wrong-page' }) },
    { site: 'https://meshin.co' }
  );
  assert.deepEqual(gaps, [
    'sidecar for /about canonical is https://meshin.co/wrong-page, expected https://meshin.co/about',
  ]);
});

test('sidecarContentGaps reports a sidecar with no parseable Updated date', () => {
  const gaps = sidecarContentGaps(
    ['/about'],
    { '/about': SIDECAR({ updated: 'not-a-date' }) },
    { site: 'https://meshin.co' }
  );
  assert.deepEqual(gaps, ['sidecar for /about carries no updated date']);
});

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
  assert.deepEqual(sizeGuardFailure('llms-full.txt', 1000, 2_000_000), []);
});

test('sizeGuardFailure reports the exact byte count and guard once a file grows past it, so growth cannot go unnoticed', () => {
  assert.deepEqual(sizeGuardFailure('llms-full.txt', 2_000_001, 2_000_000), [
    'llms-full.txt is 2000001 bytes, over the 2000000 byte guard',
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

const feedItem = (url) => `<item><guid isPermaLink="true">${url}</guid></item>`;
const buildFeed = (urls) => `<rss><channel>${urls.map(feedItem).join('')}</channel></rss>`;
const ORIGIN = 'https://meshin.co';

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
    perCollectionFeeds: { case: buildFeed([`${ORIGIN}/case-studies/only-help`]) },
    mergedFeed: buildFeed([`${ORIGIN}/case-studies/only-help`]),
    jsonFeedItems: [`${ORIGIN}/case-studies/only-help`],
    liveRoutesByKind: { case: ['/case-studies/only-help'] },
  };

  assert.deepEqual(feedCoverageFailures(['case'], single), []);
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
