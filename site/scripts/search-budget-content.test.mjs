import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAXIMUM_WORD_LENGTH } from '../public/search/index-model.mjs';
import { INDEX_LIMITS, ROW_LIMITS, buildSearchIndex } from '../src/utils/search-index.mjs';
import {
  CHUNKS,
  GREEN,
  LAST_KEY,
  ROW_SHAPE,
  change,
  chunk,
  entriesOf,
  padded,
  page,
  problemsOf,
  quoted,
  rowsOf,
  sharedTermIndex,
  withEntries,
  withFirstEntry,
  withLastKeyRenamed,
  withManifest,
  withRows,
} from './fixtures/search-budget-world.mjs';

const LAST_CHUNK = chunk(CHUNKS - 1);

test('a chunk of exactly the chunk size passes and one byte more is refused with its size', () => {
  const text = GREEN.files.get(chunk(2));

  assert.deepEqual(problemsOf(change(GREEN.files, chunk(2), padded(text, INDEX_LIMITS.chunkBytes))), []);
  assert.deepEqual(problemsOf(change(GREEN.files, chunk(2), padded(text, INDEX_LIMITS.chunkBytes + 1))), [
    `search-index: ${chunk(2)} is ${INDEX_LIMITS.chunkBytes + 1} bytes raw (over ${INDEX_LIMITS.chunkBytes})`,
  ]);
});

test('a chunk that holds one key may pass the chunk size, because one list cannot be split, and a chunk of two keys may not', () => {
  const entryOf = (title) => ({ href: `/${title}`, title, description: '', kind: 'Writing', text: '' });
  const oneKey = buildSearchIndex([entryOf('alpha')]);
  const twoKeys = buildSearchIndex([entryOf('alpha beta')]);
  const [oneKeyPath] = [...oneKey.files.keys()].filter((path) => path.includes('/t/'));
  const [twoKeysPath] = [...twoKeys.files.keys()].filter((path) => path.includes('/t/'));
  const bytes = INDEX_LIMITS.chunkBytes + 500;

  assert.deepEqual(problemsOf(change(oneKey.files, oneKeyPath, padded(oneKey.files.get(oneKeyPath), bytes))), []);
  assert.deepEqual(problemsOf(change(twoKeys.files, twoKeysPath, padded(twoKeys.files.get(twoKeysPath), bytes))), [
    `search-index: ${twoKeysPath} is ${bytes} bytes raw (over ${INDEX_LIMITS.chunkBytes})`,
  ]);
});

const UNDECODABLE_CHUNKS = [
  ['text that is not JSON', '[,'],
  ['an object', '{"a":1}'],
  ['a number', '7'],
  ['an empty list', '[]'],
  ['a key that is not text', '[7,1,0,1]'],
  ['a count that is not a whole number', '["ab",1.5,0,1]'],
  ['a count of zero', '["ab",0]'],
  ['a list that stops before its weights', '["ab",2,0,1,5]'],
  ['a count with nothing after it', '["ab",1]'],
  ['an id step in text', '["ab",1,"0",1]'],
  ['a weight in text', '["ab",1,0,"1"]'],
  ['a second key cut short', '["ab",1,0,1,"cd"]'],
];

for (const [name, text] of UNDECODABLE_CHUNKS) {
  test(`a chunk holding ${name} does not decode, and the chunks around it are not blamed`, () => {
    assert.deepEqual(problemsOf(change(GREEN.files, chunk(2), text)), [`search-index: ${chunk(2)} does not decode`]);
  });
}

test('a list marked as truncated by a negative count decodes', () => {
  assert.deepEqual(problemsOf(withFirstEntry(GREEN.files, 2, { truncated: true })), []);
});

test('keys must ascend strictly: a swap inside a chunk, a repeated key and a first key that does not pass the previous chunk are refused', () => {
  const entries = entriesOf(GREEN.files, 2);
  assert.ok(entries.length > 2);
  const line = (key, after) => `search-index: ${chunk(2)} key ${quoted(key)} does not ascend after ${quoted(after)}`;

  assert.deepEqual(problemsOf(withEntries(GREEN.files, 2, [entries[1], entries[0], ...entries.slice(2)])), [
    line(entries[0].key, entries[1].key),
  ]);
  assert.deepEqual(problemsOf(withEntries(GREEN.files, 2, [entries[0], entries[0], ...entries.slice(2)])), [
    line(entries[0].key, entries[0].key),
  ]);
  const previousLastKey = GREEN.manifest.lastKeys[1];
  assert.deepEqual(problemsOf(withFirstEntry(GREEN.files, 2, { key: previousLastKey })), [
    line(previousLastKey, previousLastKey),
  ]);
});

test('the last key of a chunk must be the one the manifest names', () => {
  const named = `${LAST_KEY}x`;
  const lastKeys = [...GREEN.manifest.lastKeys.slice(0, -1), named];

  assert.deepEqual(problemsOf(withManifest(GREEN.files, { lastKeys })), [
    `search-index: ${LAST_CHUNK} last key is ${quoted(LAST_KEY)}, the manifest says ${quoted(named)}`,
  ]);
});

test('a key of 33 characters is refused and one of exactly 32 passes', () => {
  const key = (length) => LAST_KEY.padEnd(length, 'z');

  assert.deepEqual(problemsOf(withLastKeyRenamed(key(MAXIMUM_WORD_LENGTH))), []);
  assert.deepEqual(problemsOf(withLastKeyRenamed(key(MAXIMUM_WORD_LENGTH + 1))), [
    `search-index: ${LAST_CHUNK} key ${quoted(key(MAXIMUM_WORD_LENGTH + 1))} is longer than ${MAXIMUM_WORD_LENGTH} characters`,
  ]);
});

test('a key that is not lowercase letters and digits is refused, and a lowercase letter beyond ASCII or a digit passes', () => {
  for (const suffix of ['-', 'A', ' x', '_']) {
    assert.deepEqual(problemsOf(withLastKeyRenamed(`${LAST_KEY}${suffix}`)), [
      `search-index: ${LAST_CHUNK} key ${quoted(`${LAST_KEY}${suffix}`)} is not lowercase letters and digits`,
    ]);
  }
  for (const suffix of ['é', '9']) assert.deepEqual(problemsOf(withLastKeyRenamed(`${LAST_KEY}${suffix}`)), [], suffix);
});

test('a list of exactly the list cap passes, and one posting more is refused, while the builder truncates a longer list instead', () => {
  const cap = INDEX_LIMITS.listCap;
  const looser = sharedTermIndex(cap + 1, { ...INDEX_LIMITS, listCap: cap + 1 });
  const [looserChunk] = [...looser.files.keys()].filter((path) => path.includes('/t/'));

  assert.deepEqual(problemsOf(sharedTermIndex(cap).files), []);
  assert.deepEqual(problemsOf(sharedTermIndex(cap + 1).files), []);
  assert.deepEqual(problemsOf(looser.files), [
    `search-index: ${looserChunk} key "sharedterm" has ${cap + 1} postings (over ${cap})`,
  ]);
});

test('ids must strictly ascend from zero and stay below the document count', () => {
  const key = entriesOf(GREEN.files, 2)[0].key;
  const documents = GREEN.manifest.documents;
  const withIds = (ids) => withFirstEntry(GREEN.files, 2, { ids, weights: ids.map(() => 1) });
  const line = (rule) => `search-index: ${chunk(2)} key ${quoted(key)} ${rule}`;
  const unordered = line('has ids that are not strictly ascending whole numbers from 0');

  for (const ids of [[4, 2], [3, 3], [-1], [1.5]]) assert.deepEqual(problemsOf(withIds(ids)), [unordered], String(ids));
  assert.deepEqual(problemsOf(withIds([documents - 2, documents])), [
    line(`has an id not below the ${documents} documents`),
  ]);
  assert.deepEqual(problemsOf(withIds([0])), []);
  assert.deepEqual(problemsOf(withIds([documents - 2, documents - 1])), []);
});

test('a weight must be a positive whole number', () => {
  const key = entriesOf(GREEN.files, 2)[0].key;
  const withWeight = (weight) => withFirstEntry(GREEN.files, 2, { ids: [0], weights: [weight] });
  const line = `search-index: ${chunk(2)} key ${quoted(key)} has a weight that is not a positive whole number`;

  for (const weight of [0, -3, 1.5]) assert.deepEqual(problemsOf(withWeight(weight)), [line], String(weight));
  assert.deepEqual(problemsOf(withWeight(1)), []);
});

test('a page of exactly the page size passes, and one row more is refused', () => {
  const rows = rowsOf(GREEN.files, 0);
  assert.equal(rows.length, GREEN.manifest.pageSize);

  assert.deepEqual(problemsOf(GREEN.files), []);
  assert.deepEqual(problemsOf(withRows(GREEN.files, 0, [...rows, rows[0]])), [
    `search-index: ${page(0)} holds ${rows.length + 1} rows (over ${GREEN.manifest.pageSize})`,
  ]);
});

test('a page that is not JSON or not a list is refused', () => {
  for (const text of ['[{', '{"rows":[]}', '"rows"', 'null']) {
    assert.deepEqual(problemsOf(change(GREEN.files, page(0), text)), [
      `search-index: ${page(0)} is not a list of rows`,
    ]);
  }
});

test('a row that is not exactly [href, title, description] strings is refused, which is how body text shows up', () => {
  const [row, ...others] = rowsOf(GREEN.files, 0);
  const shapes = {
    'a fourth element carrying body text': [...row, 'the whole body text of the article'],
    'two elements': row.slice(0, 2),
    'an object': { href: row[0], title: row[1], description: row[2], text: 'body' },
    'a number for the title': [row[0], 7, row[2]],
    text: 'just text',
  };

  for (const [name, shape] of Object.entries(shapes)) {
    assert.deepEqual(
      problemsOf(withRows(GREEN.files, 0, [shape, ...others])),
      [`search-index: ${page(0)} row 0 is not ${ROW_SHAPE}`],
      name
    );
  }
});

test('each row field passes at its limit and is refused one character over it', () => {
  const [row, ...others] = rowsOf(GREEN.files, 0);

  ['href', 'title', 'description'].forEach((field, at) => {
    const rows = (length) => [row.map((value, index) => (index === at ? 'x'.repeat(length) : value)), ...others];
    assert.deepEqual(problemsOf(withRows(GREEN.files, 0, rows(ROW_LIMITS[field]))), [], field);
    assert.deepEqual(
      problemsOf(withRows(GREEN.files, 0, rows(ROW_LIMITS[field] + 1))),
      [`search-index: ${page(0)} row 0 is not ${ROW_SHAPE}`],
      field
    );
  });
});
