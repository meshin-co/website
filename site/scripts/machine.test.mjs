import { access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  publicCollections,
  missingFromGenerator,
  sidecarGaps,
  feedCoverageFailures,
  COLLECTION_BASES,
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
  const gaps = sidecarGaps(['/blog/a-post', '/glossary/evals', '/about'], ['blog/a-post.md']);

  assert.deepEqual(gaps, ['/glossary/evals.md']);
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
