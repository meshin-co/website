import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LLMS_COLLECTIONS,
  latestUpdated,
  llmsFeedPointers,
  llmsFullTextPointers,
  llmsCollectionFiles,
  llmsCollectionPointers,
  LLMS_SHARD_MAX_ENTRIES,
  LLMS_SHARD_FRAME_BYTES,
  LLMS_FILE_MAX_BYTES,
  LLMS_FULL_MAX_BYTES,
  LARGEST_MEASURED_ENTRY_BYTES,
  orderEntries,
  toLlmsEntry,
} from './llms-collections.mjs';
import { FEED_WINDOW, MERGED_FEED_WINDOW } from './feeds.mjs';
import { entryCount, renderLlmsCollection } from './machine-text.mjs';

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

test('llmsFeedPointers says the merged feed holds the newest MERGED_FEED_WINDOW entries with at least five of each collection', () => {
  const [merged] = llmsFeedPointers();
  assert.ok(merged.description.includes(`${MERGED_FEED_WINDOW} newest entries`));
  assert.match(merged.description, /at least five of each collection/);
  assert.doesNotMatch(merged.description, /every live entry/);
});

test('llmsFeedPointers says each collection feed holds the newest FEED_WINDOW entries of that collection', () => {
  const collectionFeeds = llmsFeedPointers().filter((pointer) => pointer.name);
  assert.equal(collectionFeeds.length, LLMS_COLLECTIONS.length);
  for (const pointer of collectionFeeds) {
    const { title } = LLMS_COLLECTIONS.find(({ name }) => name === pointer.name);
    assert.ok(pointer.description.includes(`${FEED_WINDOW} newest entries`), pointer.name);
    assert.ok(pointer.description.includes(title.toLowerCase()), pointer.name);
    assert.doesNotMatch(pointer.description, /every live entry/, pointer.name);
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

test('llmsFullTextPointers describes the llms-full.txt line as the index of the collection files', () => {
  assert.deepEqual(llmsFullTextPointers({})[0], {
    url: '/llms-full.txt',
    title: 'Full text index',
    description: 'The collection files that hold the full body text of every live entry, one line each.',
  });
});

test('llmsCollectionPointers gives the line llms.txt carries for each non-empty collection and no llms-full.txt line', () => {
  const counts = { service: 3, post: 8, resource: 1, glossary: 0, case: 0, faq: 2 };
  const pointers = llmsCollectionPointers(counts);
  assert.deepEqual(
    pointers.map((pointer) => pointer.url),
    ['/llms/service.txt', '/llms/post.txt', '/llms/resource.txt', '/llms/faq.txt']
  );
  assert.equal(
    pointers.find((pointer) => pointer.url === '/llms/post.txt').description,
    '8 entries, full body text of each.'
  );
  assert.deepEqual(llmsFullTextPointers(counts).slice(1), pointers);
});

const stamp = (index) => new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();

const twoADay = (index) => new Date(Date.UTC(2026, 0, 1 + Math.floor(index / 2))).toISOString();

const POST = LLMS_COLLECTIONS.find((collection) => collection.name === 'post');

const makeEntry = (index, { base = '/blog', published = stamp, body = `Body ${index}.` } = {}) => {
  const id = `entry-${String(index).padStart(4, '0')}`;
  return {
    id,
    title: `Entry ${index}`,
    url: `https://meshin.co${base}/${id}`,
    summary: `Summary ${index}.`,
    body,
    published: published(index),
    updated: published(index),
    draft: false,
    noindex: false,
  };
};

const makeEntries = (count, options) => Array.from({ length: count }, (_, index) => makeEntry(index, options));

const filesOf = (entries, { collection = POST, max } = {}) =>
  llmsCollectionFiles({
    site: 'meshin.co',
    origin: 'https://meshin.co',
    name: collection.name,
    title: collection.title,
    entries,
    max,
  });
const entryUrlsIn = (text) => [...text.matchAll(/^\[(https:\/\/meshin\.co\/[^\]]+)\]\(\1\)$/gm)].map(([, url]) => url);
const textOf = (files, param) => files.find((file) => file.param === param)?.text;
const bytesOf = (text) => Buffer.byteLength(text, 'utf8');

const tiedEntries = () => makeEntries(4 * LLMS_SHARD_MAX_ENTRIES.post + 1, { published: twoADay });

const boundaryCases = () =>
  LLMS_COLLECTIONS.flatMap((collection) => {
    const cap = LLMS_SHARD_MAX_ENTRIES[collection.name];
    return [cap, cap + 1, 2 * cap, 2 * cap + 1].map((count) => ({
      collection,
      cap,
      count,
      label: `${collection.name} with ${count} entries`,
      entries: makeEntries(count, { base: collection.base }),
    }));
  });
const casesAtCap = () => boundaryCases().filter(({ cap, count }) => count === cap);
const casesAboveCap = () => boundaryCases().filter(({ cap, count }) => count > cap);

const rangesOf = (count, cap) =>
  Array.from({ length: Math.ceil(count / cap) }, (_, index) => ({
    shard: index + 1,
    from: index * cap + 1,
    to: Math.min((index + 1) * cap, count),
  }));

const largestEntryBytes = ({ name }) =>
  LARGEST_MEASURED_ENTRY_BYTES[name] ?? Math.max(...Object.values(LARGEST_MEASURED_ENTRY_BYTES));

const entryAndSeparatorBytes = (collection, entry) =>
  bytesOf(renderLlmsCollection({ site: 'meshin.co', title: collection.title, entries: [entry, entry] })) -
  bytesOf(renderLlmsCollection({ site: 'meshin.co', title: collection.title, entries: [entry] }));

const entryOfBytes = (collection, index, bytes) => {
  const probe = makeEntry(index, { base: collection.base, published: twoADay, body: 'x' });
  const entry = { ...probe, body: 'x'.repeat(1 + bytes - entryAndSeparatorBytes(collection, probe)) };
  assert.equal(entryAndSeparatorBytes(collection, entry), bytes);
  return entry;
};

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

test('the entry caps are service 48, post 3, resource 7, glossary 33, faq 118 and case 3', () => {
  assert.deepEqual(LLMS_SHARD_MAX_ENTRIES, { service: 48, post: 3, resource: 7, glossary: 33, faq: 118, case: 3 });
});

test("every cap keeps its collection's largest measured entry inside the file budget", () => {
  for (const collection of LLMS_COLLECTIONS) {
    const cap = LLMS_SHARD_MAX_ENTRIES[collection.name];
    const largest = largestEntryBytes(collection);
    assert.ok(cap >= 1, `${collection.name} holds at least one entry`);
    assert.ok(
      cap * largest + LLMS_SHARD_FRAME_BYTES <= LLMS_FILE_MAX_BYTES,
      `${collection.name}: ${cap} entries of ${largest} bytes`
    );
  }
});

test('the byte guards are 100000 for a file under /llms/, 1024 for its frame and 4096 for llms-full.txt', () => {
  assert.equal(LLMS_FILE_MAX_BYTES, 100_000);
  assert.equal(LLMS_SHARD_FRAME_BYTES, 1_024);
  assert.equal(LLMS_FULL_MAX_BYTES, 4_096);
});

test('a collection at exactly its cap is one file with no index', () => {
  for (const { collection, count, label, entries } of casesAtCap()) {
    const files = filesOf(entries, { collection });
    assert.deepEqual(
      files.map((file) => file.param),
      [collection.name],
      label
    );
    assert.equal(entryUrlsIn(files[0].text).length, count, label);
  }
});

test('one entry over the cap makes an index and two shards named post-1 and post-2', () => {
  const files = filesOf(makeEntries(4));
  assert.deepEqual(
    files.map((file) => file.param),
    ['post', 'post-1', 'post-2']
  );
  assert.equal(entryUrlsIn(textOf(files, 'post-1')).length, 3);
  assert.equal(entryUrlsIn(textOf(files, 'post-2')).length, 1);
});

test('above its cap every collection is an index plus ceil(count / cap) shards', () => {
  for (const { collection, cap, count, label, entries } of casesAboveCap()) {
    const shards = rangesOf(count, cap).map(({ shard }) => `${collection.name}-${shard}`);
    assert.deepEqual(
      filesOf(entries, { collection }).map((file) => file.param),
      [collection.name, ...shards],
      label
    );
  }
});

test('the index lists every shard with its range and count and carries no entry', () => {
  for (const { collection, cap, count, label, entries } of casesAboveCap()) {
    const index = textOf(filesOf(entries, { collection }), collection.name);
    assert.deepEqual(entryUrlsIn(index), [], label);
    for (const { shard, from, to } of rangesOf(count, cap)) {
      const line = `- [Entries ${from}-${to}](https://meshin.co/llms/${collection.name}-${shard}.txt): ${entryCount(to - from + 1)}\n`;
      assert.ok(index.includes(line), `${label}: shard ${shard}`);
    }
  }
});

test('walking next links from shard 1 reaches every entry exactly once, whatever the size', () => {
  for (const { collection, count, label, entries } of casesAboveCap()) {
    const files = filesOf(entries, { collection });
    const seen = [];
    let param = `${collection.name}-1`;
    while (param) {
      const text = textOf(files, param);
      seen.push(...entryUrlsIn(text));
      const next = /^Next part: \[https:\/\/meshin\.co\/llms\/([^\]]+)\.txt\]/m.exec(text)?.[1];
      assert.equal(next === undefined, /^This is the last part\.$/m.test(text), `${label}/${param} ends one way`);
      param = next;
    }
    assert.equal(seen.length, count, `${label}: entries reached`);
    assert.equal(new Set(seen).size, count, `${label}: entries are all distinct`);
    assert.deepEqual(
      seen,
      orderEntries(entries).map((entry) => entry.url),
      `${label}: entries arrive in order`
    );
  }
});

test('each shard declares the range it holds and none holds more than its cap', () => {
  for (const { collection, cap, count, label, entries } of casesAboveCap()) {
    const files = filesOf(entries, { collection });
    for (const { shard, from, to } of rangesOf(count, cap)) {
      const text = textOf(files, `${collection.name}-${shard}`);
      const held = entryUrlsIn(text).length;
      assert.ok(
        text.includes(`## ${collection.title}, entries ${from}-${to}\n`),
        `${label}: shard ${shard} says ${from}-${to}`
      );
      assert.equal(held, to - from + 1, `${label}: shard ${shard} holds its range`);
      assert.ok(held <= cap, `${label}: shard ${shard} is within the cap of ${cap}`);
    }
  }
});

test('a draft or noindex entry never counts toward the cap', () => {
  const entries = makeEntries(LLMS_SHARD_MAX_ENTRIES.post + 2);
  entries[0].draft = true;
  entries[1].noindex = true;
  assert.deepEqual(
    filesOf(entries).map((file) => file.param),
    ['post']
  );
});

test('an explicit max replaces the cap of the collection', () => {
  const files = filesOf(makeEntries(5), { max: 2 });
  assert.deepEqual(
    files.map((file) => file.param),
    ['post', 'post-1', 'post-2', 'post-3']
  );
  assert.deepEqual(
    ['post-1', 'post-2', 'post-3'].map((param) => entryUrlsIn(textOf(files, param)).length),
    [2, 2, 1]
  );
});

test('every collection at 3 caps and one entry of its largest measured size stays inside the file budget in every file', () => {
  for (const collection of LLMS_COLLECTIONS) {
    const cap = LLMS_SHARD_MAX_ENTRIES[collection.name];
    const largest = largestEntryBytes(collection);
    const entries = Array.from({ length: 3 * cap + 1 }, (_, index) => entryOfBytes(collection, index, largest));
    const sizes = filesOf(entries, { collection }).map((file) => bytesOf(file.text));
    assert.ok(
      Math.max(...sizes) >= cap * largest,
      `${collection.name} fills a shard with ${cap} entries of ${largest} bytes`
    );
    assert.ok(
      Math.max(...sizes) <= LLMS_FILE_MAX_BYTES,
      `${collection.name} stays within ${LLMS_FILE_MAX_BYTES} bytes`
    );
  }
});

test('a year of two posts a day stays inside the file budget in every file', () => {
  const measuredBytes = [7128, 8270, 8791, 10073, 10205, 10813, 16523, 20951, 26578, 28454];
  const entries = Array.from({ length: 740 }, (_, index) =>
    entryOfBytes(POST, index, measuredBytes[index % measuredBytes.length])
  );
  const files = filesOf(entries);
  const shards = rangesOf(entries.length, LLMS_SHARD_MAX_ENTRIES.post);
  assert.equal(files.length, 1 + shards.length);
  for (const file of files) {
    assert.ok(bytesOf(file.text) <= LLMS_FILE_MAX_BYTES, `${file.param} is ${bytesOf(file.text)} bytes`);
  }
  const index = textOf(files, 'post');
  for (const { shard } of shards) {
    assert.ok(index.includes(`(https://meshin.co/llms/post-${shard}.txt)`), `the index lists post-${shard}`);
  }
});

test('a newer entry lands at the end, so earlier shards stay byte for byte unchanged and only the old last shard and the index move', () => {
  const cap = LLMS_SHARD_MAX_ENTRIES.post;
  const before = filesOf(makeEntries(2 * cap + 1));
  const after = filesOf(makeEntries(2 * cap + 2));
  assert.equal(textOf(after, 'post-1'), textOf(before, 'post-1'));
  assert.equal(textOf(after, 'post-2'), textOf(before, 'post-2'));
  assert.notEqual(textOf(after, 'post-3'), textOf(before, 'post-3'));
  assert.notEqual(textOf(after, 'post'), textOf(before, 'post'));
});

test('an entry back-dated into the middle shifts every later shard, which is the cost of ordering by publish date', () => {
  const entries = makeEntries(4 * LLMS_SHARD_MAX_ENTRIES.post);
  const backdated = [
    { ...makeEntry(0), id: 'entry-late', url: 'https://meshin.co/blog/entry-late', published: stamp(1) },
    ...entries,
  ];
  const before = filesOf(entries);
  const after = filesOf(backdated);
  for (const { param, text } of before.filter(({ param }) => param !== 'post')) {
    assert.notEqual(textOf(after, param), text, param);
  }
});

test('generating twice from one fixture is byte-identical for every file, in any input order', () => {
  const entries = tiedEntries();
  const first = filesOf(entries);
  const second = filesOf(entries);
  const shuffled = filesOf([...entries].reverse());
  assert.deepEqual(second, first);
  assert.deepEqual(shuffled, first);
});

test('without the id tie-break two entries of one date swap when the input order reverses', () => {
  const byPublishDateOnly = (entries) =>
    [...entries].sort((a, b) => (a.published < b.published ? -1 : a.published > b.published ? 1 : 0));
  const idsOf = (entries) => entries.map((entry) => entry.id);
  const entries = tiedEntries();
  assert.notDeepEqual(idsOf(byPublishDateOnly(entries)), idsOf(byPublishDateOnly([...entries].reverse())));
  assert.deepEqual(idsOf(orderEntries(entries)), idsOf(orderEntries([...entries].reverse())));
});

test('the generator reads no clock: a second run a day later is byte-identical', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 1) });
  const entries = tiedEntries();
  const first = filesOf(entries);
  context.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.deepEqual(filesOf(entries), first);
});

test('a generator that appends the time differs between runs a day apart and not between runs inside one millisecond', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 1) });
  const entries = tiedEntries();
  const run = () =>
    filesOf(entries).map(({ param, text }) => ({ param, text: `${text}${new Date().toISOString()}\n` }));
  const first = run();
  assert.deepEqual(run(), first);
  context.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.notDeepEqual(run(), first);
});
