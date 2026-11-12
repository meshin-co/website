import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import {
  COLLECTION_BASES,
  collectionHubRoutes,
  feedCoverageFailures,
  isTaxonomyRoute,
  liveRoutesByKind,
  llmsInlinedRoutes,
  sidecarCandidateRoutes,
  sidecarGaps,
} from './machine.mjs';

const ORIGIN = 'https://meshin.co';
const SERIES_PAGE = '/spec/evals-baseline';
const VERSION_PAGE = '/spec/evals-baseline/1.0';
const NEXT_VERSION_PAGE = '/spec/evals-baseline/1.1';
const INDEXABLE_PAGE = '<html><head></head></html>';
const NOINDEX_PAGE = '<html><head><meta name="robots" content="noindex, follow"></head></html>';

const feedItem = (route) => `<item><guid isPermaLink="true">${ORIGIN}${route}</guid></item>`;
const feedOf = (...routes) => `<rss><channel>${routes.map(feedItem).join('')}</channel></rss>`;

async function distHolding(pages) {
  const dist = await mkdtemp(join(tmpdir(), 'machine-series-'));
  for (const [route, html] of Object.entries(pages)) {
    const file = join(dist, `${route.slice(1)}.html`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  }
  return dist;
}

test('a series collection is asked for a sidecar on its series page and on each version page', () => {
  const candidates = sidecarCandidateRoutes([
    SERIES_PAGE,
    VERSION_PAGE,
    `${VERSION_PAGE}/extra`,
    '/blog/a-post',
    '/blog/series/one',
  ]);

  assert.deepEqual(candidates, [SERIES_PAGE, VERSION_PAGE, '/blog/a-post']);
});

test('the sidecar a series page and a version page are owed is the .md file the build writes for the route', () => {
  assert.deepEqual(sidecarGaps([SERIES_PAGE, VERSION_PAGE], {}), [
    '/spec/evals-baseline.md',
    '/spec/evals-baseline/1.0.md',
  ]);
});

test('a version page of a series collection is a live entry, its series page and a noindex version are not', async () => {
  const pages = {
    '/blog/a-post': INDEXABLE_PAGE,
    '/blog/tags': INDEXABLE_PAGE,
    [SERIES_PAGE]: INDEXABLE_PAGE,
    [VERSION_PAGE]: INDEXABLE_PAGE,
    [NEXT_VERSION_PAGE]: NOINDEX_PAGE,
  };
  const dist = await distHolding(pages);
  try {
    const live = await liveRoutesByKind(dist, ['post', 'spec'], Object.keys(pages));

    assert.deepEqual(live, { post: ['/blog/a-post'], spec: [VERSION_PAGE] });
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});

test('a series collection has no hub, so no hub is owed a feed link for it', () => {
  assert.equal(COLLECTION_BASES.spec, 'spec');
  assert.deepEqual(collectionHubRoutes([]).sort(), [
    '/blog',
    '/case-studies',
    '/faq',
    '/glossary',
    '/resources',
    '/services',
  ]);
  assert.deepEqual(collectionHubRoutes(['/blog', '/faq']).sort(), [
    '/case-studies',
    '/glossary',
    '/resources',
    '/services',
  ]);
});

const covered = {
  perCollectionFeeds: { spec: feedOf(VERSION_PAGE) },
  mergedFeed: feedOf(VERSION_PAGE),
  jsonFeedItems: [`${ORIGIN}${VERSION_PAGE}`],
  liveRoutesByKind: { spec: [VERSION_PAGE] },
  lastmods: new Map([[VERSION_PAGE, '2026-10-31T00:00:00.000Z']]),
};

test('a version page is held to its collection feed, the merged feed floor and the json mirror like any entry', () => {
  const unlisted = { ...covered, perCollectionFeeds: { spec: feedOf() } };
  const unmerged = { ...covered, mergedFeed: feedOf(), jsonFeedItems: [] };

  assert.deepEqual(feedCoverageFailures(['spec'], covered), []);
  assert.deepEqual(feedCoverageFailures(['spec'], unlisted), [`/spec/rss.xml omits ${VERSION_PAGE}`]);
  assert.deepEqual(feedCoverageFailures(['spec'], unmerged), ['merged rss.xml carries 0 spec entries, floor is 1']);
});

test('a version page listed in llms.txt is an inlined entry of its unbounded collection, its series page is not', () => {
  const llms = `- [Specifications](${ORIGIN}${SERIES_PAGE})\n- [Version 1.0](${ORIGIN}${VERSION_PAGE})\n`;

  assert.deepEqual(llmsInlinedRoutes(llms, { spec: [VERSION_PAGE] }, ['service']), [VERSION_PAGE]);
});

test('neither a series page nor a version page is a taxonomy route, so llms coverage is owed for both', () => {
  for (const route of [SERIES_PAGE, VERSION_PAGE]) assert.equal(isTaxonomyRoute(route), false, route);
});

test('the second segment of a series page is a name, so a series named like a taxonomy slug is still owed its llms line', () => {
  for (const name of ['tags', 'tag', 'page', 'category']) {
    for (const route of [`/spec/${name}`, `/spec/${name}/1.0`]) assert.equal(isTaxonomyRoute(route), false, route);
  }
  for (const route of ['/blog/tags', '/blog/tag/ai', '/blog/category/governance', '/blog/page/2']) {
    assert.equal(isTaxonomyRoute(route), true, route);
  }
});
