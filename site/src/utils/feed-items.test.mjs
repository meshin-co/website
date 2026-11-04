import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collectionFeedItems, lastBuildDate, mergedFeedItems } from './feed-items.mjs';
import { FEED_WINDOW, MERGED_FEED_WINDOW } from './feeds.mjs';

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

const datedEntries = (count, extra = () => ({})) =>
  Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    return {
      id: `entry-${String(i).padStart(2, '0')}`,
      body: `Body ${i}.`,
      data: {
        title: `Title ${i}`,
        description: `Description ${i}.`,
        publishDate: new Date(`${day}T00:00:00Z`),
        updatedDate: new Date(`${day}T00:00:00Z`),
        ...extra(i),
      },
    };
  });

const urlsOf = (items) => items.map((item) => item.url);

const newestFirstUrls = (count, take) =>
  Array.from({ length: count }, (_, i) => `${ORIGIN}/blog/entry-${String(i).padStart(2, '0')}`)
    .reverse()
    .slice(0, take);

for (const count of [14, 15, 16, 31]) {
  test(`collectionFeedItems with ${count} live entries keeps exactly the newest ${Math.min(count, FEED_WINDOW)}, newest first`, async () => {
    const items = await collectionFeedItems(datedEntries(count), ORIGIN, 'post', 'blog');

    assert.deepEqual(urlsOf(items), newestFirstUrls(count, FEED_WINDOW));
  });
}

test('collectionFeedItems returns byte-identical items whatever the input order', async () => {
  const entries = datedEntries(31);
  const forward = await collectionFeedItems(entries, ORIGIN, 'post', 'blog');
  const reversed = await collectionFeedItems([...entries].reverse(), ORIGIN, 'post', 'blog');

  assert.equal(JSON.stringify(reversed), JSON.stringify(forward));
});

test('collectionFeedItems orders entries with one date_modified by url and cuts the window the same way for any input order', async () => {
  const sameDay = datedEntries(20, () => ({
    publishDate: new Date('2026-03-01T00:00:00Z'),
    updatedDate: new Date('2026-03-01T00:00:00Z'),
  }));
  const forward = await collectionFeedItems(sameDay, ORIGIN, 'post', 'blog');
  const reversed = await collectionFeedItems([...sameDay].reverse(), ORIGIN, 'post', 'blog');

  const expected = sameDay.slice(0, FEED_WINDOW).map((one) => `${ORIGIN}/blog/${one.id}`);
  assert.deepEqual(urlsOf(forward), expected);
  assert.deepEqual(urlsOf(reversed), expected);
});

test('collectionFeedItems never gives a draft or noindex entry a slot in the window', async () => {
  const draftNewest = datedEntries(16, (i) => (i === 15 ? { draft: true } : {}));
  const draftItems = await collectionFeedItems(draftNewest, ORIGIN, 'post', 'blog');
  assert.equal(draftItems.length, FEED_WINDOW);
  assert.ok(!urlsOf(draftItems).includes(`${ORIGIN}/blog/entry-15`));
  assert.deepEqual(urlsOf(draftItems), newestFirstUrls(15, FEED_WINDOW));

  const hiddenNewest = datedEntries(16, (i) => (i === 15 ? { noindex: true } : {}));
  const hiddenItems = await collectionFeedItems(hiddenNewest, ORIGIN, 'post', 'blog');
  assert.equal(hiddenItems.length, FEED_WINDOW);
  assert.ok(!urlsOf(hiddenItems).includes(`${ORIGIN}/blog/entry-15`));
});

test('mergedFeedItems cuts at the merged window and still carries the floor of every kind', async () => {
  const load = async (kind) => (kind === 'post' ? datedEntries(80) : kind === 'faq' ? datedEntries(8) : []);
  const items = await mergedFeedItems(load, ORIGIN);

  assert.ok(items.length <= MERGED_FEED_WINDOW);
  assert.ok(items.filter((item) => item.kind === 'faq').length >= 5);
  assert.ok(items.filter((item) => item.kind === 'post').length >= 5);
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
