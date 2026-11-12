import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LLMS_COLLECTIONS,
  latestUpdated,
  llmsFeedPointers,
  llmsFullTextPointers,
  llmsCollectionFiles,
  llmsCollectionPointers,
  LLMS_FILE_MAX_BYTES,
  LLMS_FULL_MAX_BYTES,
  orderEntries,
  toLlmsEntry,
} from './llms-collections.mjs';
import { FEED_WINDOW, MERGED_FEED_WINDOW } from './feeds.mjs';
import { entryCount, renderLlmsCollection, renderLlmsShard } from './machine-text.mjs';

test('the llms surface covers exactly the seven public collections', () => {
  assert.deepEqual(
    LLMS_COLLECTIONS.map((collection) => collection.name),
    ['service', 'post', 'resource', 'glossary', 'case', 'faq', 'spec']
  );
});

test('the specification collection is listed under /spec with its own title and full-text file', () => {
  assert.deepEqual(
    LLMS_COLLECTIONS.find(({ name }) => name === 'spec'),
    { name: 'spec', base: '/spec', title: 'Specifications', file: '/llms/spec.txt' }
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
    '/spec/rss.xml',
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
  const counts = { service: 3, post: 8, resource: 1, glossary: 0, case: 0, faq: 2, spec: 1 };
  const pointers = llmsCollectionPointers(counts);
  assert.deepEqual(
    pointers.map((pointer) => pointer.url),
    ['/llms/service.txt', '/llms/post.txt', '/llms/resource.txt', '/llms/faq.txt', '/llms/spec.txt']
  );
  assert.equal(
    pointers.find((pointer) => pointer.url === '/llms/post.txt').description,
    '8 entries, full body text of each.'
  );
  assert.deepEqual(
    pointers.find((pointer) => pointer.url === '/llms/spec.txt'),
    { url: '/llms/spec.txt', title: 'Specifications', description: '1 entry, full body text of each.' }
  );
  assert.deepEqual(llmsFullTextPointers(counts).slice(1), pointers);
});

const twoADay = (index) => new Date(Date.UTC(2026, 0, 1 + Math.floor(index / 2))).toISOString();

const POST = LLMS_COLLECTIONS.find((collection) => collection.name === 'post');

const makeEntry = (index, { base, body }) => {
  const id = `entry-${String(index).padStart(4, '0')}`;
  return {
    id,
    title: `Entry ${index}`,
    url: `https://meshin.co${base}/${id}`,
    summary: `Summary ${index}.`,
    body,
    published: twoADay(index),
    updated: twoADay(index),
    draft: false,
    noindex: false,
  };
};

const filesOf = (entries, { collection = POST, maxBytes } = {}) =>
  llmsCollectionFiles({
    site: 'meshin.co',
    origin: 'https://meshin.co',
    name: collection.name,
    title: collection.title,
    entries,
    maxBytes,
  });
const entryUrlsIn = (text) => [...text.matchAll(/^\[(https:\/\/meshin\.co\/[^\]]+)\]\(\1\)$/gm)].map(([, url]) => url);
const textOf = (files, param) => files.find((file) => file.param === param)?.text;
const bytesOf = (text) => Buffer.byteLength(text, 'utf8');

const entryAndSeparatorBytes = (collection, entry) =>
  bytesOf(renderLlmsCollection({ site: 'meshin.co', title: collection.title, entries: [entry, entry] })) -
  bytesOf(renderLlmsCollection({ site: 'meshin.co', title: collection.title, entries: [entry] }));

const entryOfBytes = (collection, index, bytes) => {
  const probe = makeEntry(index, { base: collection.base, body: 'x' });
  const entry = { ...probe, body: 'x'.repeat(1 + bytes - entryAndSeparatorBytes(collection, probe)) };
  assert.equal(entryAndSeparatorBytes(collection, entry), bytes);
  return entry;
};

const HEAVY_BYTES = 30_000;

const MEASURED_POST_BYTES = [8791, 10205, 7128, 8270, 26578, 16523, 28454, 20951, 10073, 10819, 11626, 10901, 9874];

const measuredPosts = (count) =>
  Array.from({ length: count }, (_, index) =>
    entryOfBytes(POST, index, MEASURED_POST_BYTES[index % MEASURED_POST_BYTES.length])
  );

const shardUrl = (position) => `https://meshin.co/llms/post-${position}.txt`;

const renderedShard = (entries, { from, to, nextUrl }) =>
  renderLlmsShard({
    site: 'meshin.co',
    title: POST.title,
    entries: entries.slice(from - 1, to),
    from,
    to,
    nextUrl,
  });

const SHARDED_COUNT = 7;
const SHARD_RANGES = [
  { shard: 1, from: 1, to: 3 },
  { shard: 2, from: 4, to: 6 },
  { shard: 3, from: 7, to: 7 },
];

const heavyEntries = (collection, count) =>
  Array.from({ length: count }, (_, index) => entryOfBytes(collection, index, HEAVY_BYTES));

const tiedEntries = () => heavyEntries(POST, 9);

const shardedCases = () =>
  LLMS_COLLECTIONS.map((collection) => ({
    collection,
    label: `${collection.name} with ${SHARDED_COUNT} entries of ${HEAVY_BYTES} bytes`,
    entries: heavyEntries(collection, SHARDED_COUNT),
  }));

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

test('the byte guards are 100000 for a file under /llms/ and 4096 for llms-full.txt', () => {
  assert.equal(LLMS_FILE_MAX_BYTES, 100_000);
  assert.equal(LLMS_FULL_MAX_BYTES, 4_096);
});

test('a collection that fits the file budget is one file with no index, whichever collection it is', () => {
  for (const collection of LLMS_COLLECTIONS) {
    const files = filesOf(heavyEntries(collection, 3), { collection });
    assert.deepEqual(
      files.map((file) => file.param),
      [collection.name],
      collection.name
    );
    assert.equal(entryUrlsIn(files[0].text).length, 3, collection.name);
  }
});

test('a collection whose text is exactly the budget stays one file, and one byte less makes an index and two shards', () => {
  const entries = heavyEntries(POST, 3);
  const whole = bytesOf(renderLlmsCollection({ site: 'meshin.co', title: POST.title, entries }));
  assert.deepEqual(
    filesOf(entries, { maxBytes: whole }).map((file) => file.param),
    ['post']
  );
  const files = filesOf(entries, { maxBytes: whole - 1 });
  assert.deepEqual(
    files.map((file) => file.param),
    ['post', 'post-1', 'post-2']
  );
  assert.deepEqual(
    ['post-1', 'post-2'].map((param) => entryUrlsIn(textOf(files, param)).length),
    [2, 1]
  );
});

test('above the file budget every collection is an index plus the shards the budget needs', () => {
  for (const { collection, label, entries } of shardedCases()) {
    const shards = SHARD_RANGES.map(({ shard }) => `${collection.name}-${shard}`);
    assert.deepEqual(
      filesOf(entries, { collection }).map((file) => file.param),
      [collection.name, ...shards],
      label
    );
  }
});

test('the index lists every shard with its range and count and carries no entry', () => {
  for (const { collection, label, entries } of shardedCases()) {
    const index = textOf(filesOf(entries, { collection }), collection.name);
    assert.deepEqual(entryUrlsIn(index), [], label);
    for (const { shard, from, to } of SHARD_RANGES) {
      const line = `- [Entries ${from}-${to}](https://meshin.co/llms/${collection.name}-${shard}.txt): ${entryCount(to - from + 1)}\n`;
      assert.ok(index.includes(line), `${label}: shard ${shard}`);
    }
  }
});

test('walking next links from shard 1 reaches every entry exactly once, whatever the size', () => {
  for (const { collection, label, entries } of shardedCases()) {
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
    assert.equal(seen.length, SHARDED_COUNT, `${label}: entries reached`);
    assert.equal(new Set(seen).size, SHARDED_COUNT, `${label}: entries are all distinct`);
    assert.deepEqual(
      seen,
      orderEntries(entries).map((entry) => entry.url),
      `${label}: entries arrive in order`
    );
  }
});

test('each shard declares the range it holds and stays within the file budget', () => {
  for (const { collection, label, entries } of shardedCases()) {
    const files = filesOf(entries, { collection });
    for (const { shard, from, to } of SHARD_RANGES) {
      const text = textOf(files, `${collection.name}-${shard}`);
      assert.ok(
        text.includes(`## ${collection.title}, entries ${from}-${to}\n`),
        `${label}: shard ${shard} says ${from}-${to}`
      );
      assert.equal(entryUrlsIn(text).length, to - from + 1, `${label}: shard ${shard} holds its range`);
      assert.ok(bytesOf(text) <= LLMS_FILE_MAX_BYTES, `${label}: shard ${shard} is within the file budget`);
    }
  }
});

test('a draft or noindex entry never counts toward the budget', () => {
  const entries = heavyEntries(POST, 4);
  entries[0].draft = true;
  entries[1].noindex = true;
  assert.deepEqual(
    filesOf(entries).map((file) => file.param),
    ['post']
  );
});

test('an explicit maxBytes replaces the file budget', () => {
  const entries = Array.from({ length: 5 }, (_, index) => entryOfBytes(POST, index, 1_000));
  const files = filesOf(entries, { maxBytes: 2_500 });
  assert.deepEqual(
    files.map((file) => file.param),
    ['post', 'post-1', 'post-2', 'post-3']
  );
  assert.deepEqual(
    ['post-1', 'post-2', 'post-3'].map((param) => entryUrlsIn(textOf(files, param)).length),
    [2, 2, 1]
  );
});

test('an entry larger than the whole file budget gets a shard of its own and is never split', () => {
  const small = (index) => entryOfBytes(POST, index, 1_000);
  const huge = entryOfBytes(POST, 1, LLMS_FILE_MAX_BYTES + 20_000);
  const entries = [small(0), huge, small(2), small(3)];
  const files = filesOf(entries);
  assert.deepEqual(
    files.map((file) => file.param),
    ['post', 'post-1', 'post-2', 'post-3']
  );
  const [first, hugeShard, last] = ['post-1', 'post-2', 'post-3'].map((param) => textOf(files, param));
  assert.deepEqual(entryUrlsIn(first), [entries[0].url]);
  assert.deepEqual(entryUrlsIn(hugeShard), [entries[1].url]);
  assert.deepEqual(entryUrlsIn(last), [entries[2].url, entries[3].url]);
  assert.ok(bytesOf(hugeShard) > LLMS_FILE_MAX_BYTES, `the shard of the huge entry is ${bytesOf(hugeShard)} bytes`);
  assert.ok(bytesOf(first) <= LLMS_FILE_MAX_BYTES);
  assert.ok(bytesOf(last) <= LLMS_FILE_MAX_BYTES);
  assert.ok(hugeShard.includes(entries[1].body), 'the huge entry is whole in its shard');
  const index = textOf(files, 'post');
  for (const [shard, range] of [
    [1, '1-1'],
    [2, '2-2'],
    [3, '3-4'],
  ]) {
    assert.ok(
      index.includes(`- [Entries ${range}](https://meshin.co/llms/post-${shard}.txt)`),
      `the index lists shard ${shard}`
    );
  }
  assert.ok(first.includes('Next part: [https://meshin.co/llms/post-2.txt]'));
  assert.ok(hugeShard.includes('Next part: [https://meshin.co/llms/post-3.txt]'));
  assert.ok(last.endsWith('\n\n---\n\nThis is the last part.\n'));
});

test('the budget counts bytes, not characters: the same number of characters in two-byte letters needs more shards', () => {
  const maxBytes = 3_000;
  const entriesOf = (letter) =>
    Array.from({ length: 6 }, (_, index) => makeEntry(index, { base: POST.base, body: letter.repeat(1_000) }));
  const ascii = filesOf(entriesOf('e'), { maxBytes });
  const twoByte = filesOf(entriesOf('é'), { maxBytes });
  assert.deepEqual(
    ascii.slice(1).map((file) => entryUrlsIn(file.text).length),
    [2, 2, 2]
  );
  assert.deepEqual(
    twoByte.slice(1).map((file) => entryUrlsIn(file.text).length),
    [1, 1, 1, 1, 1, 1]
  );
  for (const file of twoByte.slice(1)) {
    assert.ok(bytesOf(file.text) <= maxBytes, `${file.param} is ${bytesOf(file.text)} bytes`);
  }
});

test('the frame is measured as rendered: a range that gains a digit leaves room for one entry fewer', () => {
  const entries = Array.from({ length: 14 }, (_, index) => entryOfBytes(POST, index, 2_000));
  const maxBytes = bytesOf(renderedShard(entries, { from: 1, to: 3, nextUrl: shardUrl(2) }));
  const shards = filesOf(entries, { maxBytes }).slice(1);
  assert.deepEqual(
    shards.map((file) => entryUrlsIn(file.text).length),
    [3, 3, 3, 2, 3]
  );
  assert.deepEqual(
    shards.map((file) => /entries (\d+-\d+)\n/.exec(file.text)[1]),
    ['1-3', '4-6', '7-9', '10-11', '12-14']
  );
  assert.equal(bytesOf(shards[0].text), maxBytes, 'the first shard is exactly the budget');
  assert.ok(
    bytesOf(renderedShard(entries, { from: 10, to: 12, nextUrl: shardUrl(5) })) > maxBytes,
    'three entries under the range 10-12 are over the budget'
  );
});

test('one byte under the rendered size of three entries, a shard holds two', () => {
  const entries = Array.from({ length: 14 }, (_, index) => entryOfBytes(POST, index, 2_000));
  const threeEntryShard = bytesOf(renderedShard(entries, { from: 1, to: 3, nextUrl: shardUrl(2) }));
  const shards = filesOf(entries, { maxBytes: threeEntryShard - 1 }).slice(1);
  assert.deepEqual(
    shards.map((file) => entryUrlsIn(file.text).length),
    [2, 2, 2, 2, 2, 2, 2]
  );
});

test('every shard but the last is full: the next entry would take it over the file budget', () => {
  const entries = measuredPosts(40);
  const shards = filesOf(entries).slice(1);
  assert.ok(shards.length > 2, 'the fixture makes several shards');
  shards.slice(0, -1).forEach(({ text }, position) => {
    const [, from, to] = /entries (\d+)-(\d+)\n/.exec(text).map(Number);
    const withNext = renderedShard(entries, {
      from,
      to: to + 1,
      nextUrl: to + 1 < entries.length ? shardUrl(position + 2) : null,
    });
    assert.ok(bytesOf(text) <= LLMS_FILE_MAX_BYTES, `shard ${position + 1} is within the budget`);
    assert.ok(
      bytesOf(withNext) > LLMS_FILE_MAX_BYTES,
      `shard ${position + 1} with entry ${to + 1} is ${bytesOf(withNext)} bytes, which still fits`
    );
  });
});

test('ten posts sized like the measured ones pack into the fewest shards their bytes allow, not three to a file', () => {
  const sizes = MEASURED_POST_BYTES.slice(0, 10);
  const fewestShards = Math.ceil(sizes.reduce((sum, bytes) => sum + bytes, 0) / LLMS_FILE_MAX_BYTES);
  const shards = filesOf(measuredPosts(10)).slice(1);
  assert.equal(shards.length, fewestShards);
  assert.deepEqual(
    shards.map((file) => entryUrlsIn(file.text).length),
    [6, 4]
  );
  for (const file of shards) {
    assert.ok(bytesOf(file.text) <= LLMS_FILE_MAX_BYTES, `${file.param} is ${bytesOf(file.text)} bytes`);
  }
});

test('a year of two posts a day stays inside the file budget in every file, and no two neighbouring shards fit in one', () => {
  const entries = measuredPosts(740);
  const files = filesOf(entries);
  const shards = files.filter((file) => file.param !== 'post');
  for (const file of files) {
    assert.ok(bytesOf(file.text) <= LLMS_FILE_MAX_BYTES, `${file.param} is ${bytesOf(file.text)} bytes`);
  }
  const index = textOf(files, 'post');
  for (const { param } of shards) {
    assert.ok(index.includes(`(https://meshin.co/llms/${param}.txt)`), `the index lists ${param}`);
  }
  shards.slice(1).forEach(({ param, text }, position) => {
    const together = bytesOf(shards[position].text) + bytesOf(text);
    assert.ok(together > LLMS_FILE_MAX_BYTES, `${shards[position].param} and ${param} are ${together} bytes together`);
  });
});

test('a newer entry lands at the end, so earlier shards stay byte for byte unchanged and only the old last shard and the index move', () => {
  const before = filesOf(heavyEntries(POST, SHARDED_COUNT));
  const after = filesOf(heavyEntries(POST, SHARDED_COUNT + 1));
  assert.equal(textOf(after, 'post-1'), textOf(before, 'post-1'));
  assert.equal(textOf(after, 'post-2'), textOf(before, 'post-2'));
  assert.notEqual(textOf(after, 'post-3'), textOf(before, 'post-3'));
  assert.notEqual(textOf(after, 'post'), textOf(before, 'post'));
});

test('an entry back-dated into the middle shifts every later shard, which is the cost of ordering by publish date', () => {
  const entries = heavyEntries(POST, 12);
  const backdated = [
    { ...entryOfBytes(POST, 1, HEAVY_BYTES), id: 'entry-0001-late', url: 'https://meshin.co/blog/entry-0001-late' },
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
