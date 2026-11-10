import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LENGTH_FILE,
  bodyProfile,
  deriveLimits,
  lengthFor,
  lengthProblems,
  readLengthRecord,
} from './entry-length.mjs';
import { generatedSlugs } from './measure-sentence-band.mjs';
import { loadCorpus } from './sentence-band.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

const committed = () => {
  const record = readLengthRecord(REPO);
  assert.notEqual(record, null, LENGTH_FILE + ' must exist: run node scripts/measure-entry-length.mjs --write');
  return record;
};

const handWritten = () => loadCorpus(REPO, { exclude: generatedSlugs(REPO) });

test('the committed limits are the ones the committed distribution derives, so a hand edit shows', () => {
  const record = committed();
  assert.equal(record.schema, 1);
  assert.match(record.measuredOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(record.limits, deriveLimits({ corpus: record.corpus, distribution: record.distribution }));
});

test('every hand-written entry of the real corpus clears the committed limits of its format', () => {
  const record = committed();
  for (const { id, collection, body } of handWritten()) {
    const format = collection === 'post' ? 'article' : 'term';
    assert.deepEqual(lengthProblems({ collection, body, limits: lengthFor(record, format) }), [], id);
  }
});

test('the committed floor is the length of the shortest hand-written entry of each format', () => {
  const record = committed();
  for (const [format, collection] of [
    ['article', 'post'],
    ['term', 'glossary'],
  ]) {
    const shortest = Math.min(
      ...handWritten()
        .filter((entry) => entry.collection === collection)
        .map((entry) => bodyProfile(entry).words)
    );
    assert.equal(lengthFor(record, format).wordsFloor, shortest, format);
  }
});
