import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LLMS_COLLECTIONS,
  latestUpdated,
  llmsFeedPointers,
  llmsFullTextPointers,
  llmsCollectionFiles,
  LLMS_SHARD_MAX_ENTRIES,
  orderEntries,
  toLlmsEntry,
} from './llms-collections.mjs';

test('the llms surface covers exactly the six public collections', () => {
  assert.deepEqual(
    LLMS_COLLECTIONS.map((collection) => collection.name),
    ['service', 'post', 'resource', 'glossary', 'case', 'faq']
  );
});

test('every collection points at its own per-collection full-text file', () => {
  for (const { name, file } of LLMS_COLLECTIONS) {
    assert.equal(file, `/llms/${name}.txt`);
  }
});

test('toLlmsEntry maps a titled entry with shortAnswer preferred over description', () => {
  const entry = {
    id: 'ai-readiness-scorecard',
    body: 'The scorecard body.',
    data: {
      title: 'AI readiness scorecard',
      description: 'Fallback description.',
      shortAnswer: 'Score yourself across five dimensions.',
      publishDate: new Date('2026-08-01T00:00:00Z'),
      updatedDate: new Date('2026-09-05T08:00:00Z'),
    },
  };
  assert.deepEqual(toLlmsEntry('/resources')(entry), {
    id: 'ai-readiness-scorecard',
    title: 'AI readiness scorecard',
    description: 'Score yourself across five dimensions.',
    body: 'The scorecard body.',
    updated: '2026-09-05T08:00:00.000Z',
    published: '2026-08-01T00:00:00.000Z',
    draft: false,
    noindex: false,
  });
});

test('toLlmsEntry preserves a truthy draft or noindex flag instead of dropping it', () => {
  const draftEntry = { id: 'x', body: 'b', data: { title: 'X', description: 'd', draft: true } };
  const noindexEntry = { id: 'y', body: 'b', data: { title: 'Y', description: 'd', noindex: true } };
  assert.equal(toLlmsEntry()(draftEntry).draft, true);
  assert.equal(toLlmsEntry()(noindexEntry).noindex, true);
});

test('toLlmsEntry maps a faq entry to question, teaser and full answer', () => {
  const entry = {
    id: 'what-does-a-fractional-caio-do',
    data: {
      question: 'What does a Fractional CAIO do?',
      answer:
        'Owns the AI outcome end to end. The rest of the answer elaborates on governance, shipping and evals in more detail.',
      publishDate: new Date('2026-08-01T00:00:00Z'),
      updatedDate: new Date('2026-08-01T00:00:00Z'),
    },
  };
  const mapped = toLlmsEntry('/faq')(entry);
  assert.equal(mapped.title, 'What does a Fractional CAIO do?');
  assert.equal(mapped.body, entry.data.answer);
  assert.equal(mapped.description, 'Owns the AI outcome end to end.');
  assert.equal(mapped.updated, '2026-08-01T00:00:00.000Z');
});

test('toLlmsEntry leaves an undated entry without a freshness signal', () => {
  const entry = { id: 'x', body: 'b', data: { title: 'X', description: 'd' } };
  assert.equal(toLlmsEntry('/services')(entry).updated, null);
});

test('latestUpdated returns the newest date across entries and null when none is dated', () => {
  const entries = [{ updated: '2026-08-01T00:00:00.000Z' }, { updated: null }, { updated: '2026-09-05T08:00:00.000Z' }];
  assert.equal(latestUpdated(entries), '2026-09-05T08:00:00.000Z');
  assert.equal(latestUpdated([{ updated: null }, {}]), null);
});

test('llmsFeedPointers lists the merged feed first and one feed per collection', () => {
  const pointers = llmsFeedPointers();
  const urls = pointers.map((pointer) => pointer.url);
  assert.equal(urls[0], '/rss.xml');
  assert.deepEqual(urls.slice(1), [
    '/services/rss.xml',
    '/blog/rss.xml',
    '/resources/rss.xml',
    '/glossary/rss.xml',
    '/case-studies/rss.xml',
    '/faq/rss.xml',
  ]);
  for (const pointer of pointers) {
    assert.ok(pointer.title.length > 0);
    assert.ok(pointer.description.length > 0);
  }
});

test('llmsFullTextPointers lists the single full-text file first, then one line per non-empty collection with its count', () => {
  const counts = { service: 3, post: 8, resource: 1, glossary: 0, case: 0, faq: 2 };
  const pointers = llmsFullTextPointers(counts);
  assert.deepEqual(
    pointers.map((pointer) => pointer.url),
    ['/llms-full.txt', '/llms/service.txt', '/llms/post.txt', '/llms/resource.txt', '/llms/faq.txt']
  );
  const post = pointers.find((pointer) => pointer.url === '/llms/post.txt');
  assert.equal(post.title, 'Writing');
  assert.match(post.description, /^8 entries\b/);
  assert.match(pointers.find((pointer) => pointer.url === '/llms/resource.txt').description, /^1 entry\b/);
});

test('llmsFullTextPointers names no collection that has no live entry', () => {
  const urls = llmsFullTextPointers({ service: 3, case: 0 }).map((pointer) => pointer.url);
  assert.ok(!urls.includes('/llms/case.txt'));
});

const stamp = (index) => new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();

const makeEntries = (count, published = stamp) =>
  Array.from({ length: count }, (_, index) => ({
    id: `entry-${String(index).padStart(4, '0')}`,
    title: `Entry ${index}`,
    url: `https://meshin.co/blog/entry-${String(index).padStart(4, '0')}`,
    summary: `Summary ${index}.`,
    body: `Body ${index}.`,
    published: published(index),
    updated: published(index),
    draft: false,
    noindex: false,
  }));

const filesOf = (entries, max) =>
  llmsCollectionFiles({ site: 'meshin.co', origin: 'https://meshin.co', name: 'post', title: 'Writing', entries, max });
const entryUrlsIn = (text) =>
  [...text.matchAll(/^\[(https:\/\/meshin\.co\/blog\/[^\]]+)\]\(\1\)$/gm)].map(([, url]) => url);
const textOf = (files, param) => files.find((file) => file.param === param)?.text;

test('orderEntries sorts by publish date then id, a total order that ignores input order', () => {
  const entries = [
    { id: 'b', published: '2026-02-01T00:00:00.000Z' },
    { id: 'a', published: '2026-02-01T00:00:00.000Z' },
    { id: 'z', published: '2026-01-01T00:00:00.000Z' },
  ];
  const expected = ['z', 'a', 'b'];
  assert.deepEqual(
    orderEntries(entries).map((entry) => entry.id),
    expected
  );
  assert.deepEqual(
    orderEntries([...entries].reverse()).map((entry) => entry.id),
    expected
  );
});

test('the shard cap is 100 entries', () => {
  assert.equal(LLMS_SHARD_MAX_ENTRIES, 100);
});

test('a collection at exactly the cap is one file with no index', () => {
  const files = filesOf(makeEntries(100));
  assert.deepEqual(
    files.map((file) => file.param),
    ['post']
  );
  assert.equal(entryUrlsIn(files[0].text).length, 100);
});

test('one entry over the cap makes an index and two shards named post-1 and post-2', () => {
  const files = filesOf(makeEntries(101));
  assert.deepEqual(
    files.map((file) => file.param),
    ['post', 'post-1', 'post-2']
  );
  assert.equal(entryUrlsIn(textOf(files, 'post-1')).length, 100);
  assert.equal(entryUrlsIn(textOf(files, 'post-2')).length, 1);
});

test('the index lists every shard with its range and count and carries no entry', () => {
  const index = textOf(filesOf(makeEntries(250)), 'post');
  assert.deepEqual(entryUrlsIn(index), []);
  assert.ok(index.includes('- [Entries 1-100](https://meshin.co/llms/post-1.txt): 100 entries'));
  assert.ok(index.includes('- [Entries 101-200](https://meshin.co/llms/post-2.txt): 100 entries'));
  assert.ok(index.includes('- [Entries 201-250](https://meshin.co/llms/post-3.txt): 50 entries'));
});

test('walking next links from shard 1 reaches every entry exactly once, whatever the size', () => {
  for (const count of [101, 199, 200, 201, 250, 301]) {
    const entries = makeEntries(count);
    const files = filesOf(entries);
    const seen = [];
    let param = 'post-1';
    while (param) {
      const text = textOf(files, param);
      seen.push(...entryUrlsIn(text));
      const next = /^Next part: \[https:\/\/meshin\.co\/llms\/([^\]]+)\.txt\]/m.exec(text)?.[1];
      assert.equal(next === undefined, /^This is the last part\.$/m.test(text), `${count}/${param} ends one way`);
      param = next;
    }
    assert.equal(seen.length, count, `${count} entries reached`);
    assert.equal(new Set(seen).size, count, `${count} entries are all distinct`);
    assert.deepEqual(
      seen,
      orderEntries(entries).map((entry) => entry.url),
      `${count} entries arrive in order`
    );
  }
});

test('each shard declares the range it holds', () => {
  const files = filesOf(makeEntries(250));
  for (const [param, range, size] of [
    ['post-1', '1-100', 100],
    ['post-2', '101-200', 100],
    ['post-3', '201-250', 50],
  ]) {
    const text = textOf(files, param);
    assert.ok(text.includes(`## Writing, entries ${range}`), param);
    assert.equal(entryUrlsIn(text).length, size, param);
  }
});

test('a draft or noindex entry never counts toward the cap', () => {
  const entries = makeEntries(101);
  entries[0].draft = true;
  assert.deepEqual(
    filesOf(entries).map((file) => file.param),
    ['post']
  );
});

test('a newer entry lands at the end, so earlier shards stay byte for byte unchanged and only the old last shard and the index move', () => {
  const before = filesOf(makeEntries(250));
  const after = filesOf(makeEntries(251));
  assert.equal(textOf(after, 'post-1'), textOf(before, 'post-1'));
  assert.equal(textOf(after, 'post-2'), textOf(before, 'post-2'));
  assert.notEqual(textOf(after, 'post-3'), textOf(before, 'post-3'));
});

test('an entry back-dated into the middle shifts every later shard, which is the cost of ordering by publish date', () => {
  const entries = makeEntries(250);
  const backdated = [
    { ...makeEntries(1)[0], id: 'entry-late', url: 'https://meshin.co/blog/entry-late', published: stamp(10) },
    ...entries,
  ];
  const before = filesOf(entries);
  const after = filesOf(backdated);
  assert.notEqual(textOf(after, 'post-1'), textOf(before, 'post-1'));
  assert.notEqual(textOf(after, 'post-2'), textOf(before, 'post-2'));
});

test('generating twice from one fixture is byte-identical for every file, in any input order', () => {
  const entries = makeEntries(250);
  const first = filesOf(entries);
  const second = filesOf(entries);
  const shuffled = filesOf([...entries].reverse());
  assert.deepEqual(second, first);
  assert.deepEqual(shuffled, first);
});

test('the generator reads no clock: a second run a day later is byte-identical', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 1) });
  const entries = makeEntries(250);
  const first = filesOf(entries);
  context.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.deepEqual(filesOf(entries), first);
});
