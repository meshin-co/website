import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collectionFeedItems, lastBuildDate, mergedFeedItems } from './feed-items.mjs';

const ORIGIN = 'https://meshin.co';

const entry = (id, day, extra = {}) => ({
  id,
  body: `Body of ${id}.`,
  data: {
    title: `Title ${id}`,
    description: `Description ${id}.`,
    publishDate: new Date(`2026-09-${day}T00:00:00Z`),
    updatedDate: new Date(`2026-09-${day}T00:00:00Z`),
    ...extra,
  },
});

const COLLECTIONS = { post: 8, faq: 2 };

async function loadCollection(kind) {
  const count = COLLECTIONS[kind] ?? 0;
  return Array.from({ length: count }, (_, i) => entry(`${kind}-${i}`, String(i + 1).padStart(2, '0')));
}

test('mergedFeedItems lists the merged window newest first with full text for every item', async () => {
  const items = await mergedFeedItems(loadCollection, ORIGIN);

  assert.ok(items.some((item) => item.url.startsWith(`${ORIGIN}/blog/`)));
  assert.ok(items.every((item) => typeof item.content_text === 'string' && item.content_text.length > 0));
  const dates = items.map((item) => item.date_published);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test('mergedFeedItems keeps the evergreen faq floor even when every post is strictly newer', async () => {
  const items = await mergedFeedItems(loadCollection, ORIGIN);

  assert.equal(items.filter((item) => item.kind === 'faq').length, 2);
  assert.ok(items.filter((item) => item.kind === 'post').length >= 5);
});

test('collectionFeedItems lists every live entry of one kind, newest first, dropping noindex entries', async () => {
  const items = await collectionFeedItems(
    [entry('old', '01'), entry('new', '02'), entry('hidden', '03', { noindex: true })],
    ORIGIN,
    'post',
    'blog'
  );

  assert.deepEqual(
    items.map((item) => item.url),
    [`${ORIGIN}/blog/new`, `${ORIGIN}/blog/old`]
  );
  assert.deepEqual(
    items.map((item) => item.kind),
    ['post', 'post']
  );
});

test('lastBuildDate carries the newest item date, or the build moment for an empty feed', () => {
  assert.equal(
    lastBuildDate([{ date_published: '2026-09-12T08:00:00.000Z' }]),
    '<lastBuildDate>Sat, 12 Sep 2026 08:00:00 GMT</lastBuildDate>'
  );
  assert.match(
    lastBuildDate([]),
    /^<lastBuildDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT<\/lastBuildDate>$/
  );
});
