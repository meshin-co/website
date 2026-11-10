import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DUPLICATE_MINIMUM_WORDS } from './content-gate.mjs';
import { BAND_FILE, bandFor, bandProblems, bandSummary, deriveBands, readBandRecord } from './sentence-band.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const FORMATS = ['article', 'term'];

const sentence = (words) =>
  Array.from({ length: words }, (_, index) => (index === words - 1 ? 'end.' : `w${index}`)).join(' ');
const repeat = (length, count) => Array(count).fill(length);

const committed = () => {
  const record = readBandRecord(REPO);
  assert.notEqual(record, null, `${BAND_FILE} must exist: run node scripts/measure-sentence-band.mjs --write`);
  return record;
};

test('the committed record was measured against the threshold the content gate enforces now', () => {
  const record = committed();
  assert.equal(record.threshold, DUPLICATE_MINIMUM_WORDS);
  for (const format of FORMATS) assert.equal(bandFor(record, format).threshold, DUPLICATE_MINIMUM_WORDS);
});

test('each committed band is the one its own recorded distribution derives, so a hand edit shows', () => {
  const record = committed();
  assert.equal(record.schema, 1);
  assert.match(record.measuredOn, /^\d{4}-\d{2}-\d{2}$/);
  const { threshold, minimumSentences, corpus, distribution } = record;
  assert.deepEqual(deriveBands({ threshold, minimumSentences, corpus, distribution }), record.bands);
  assert.deepEqual(bandSummary(record, 'term'), { measuredOn: record.measuredOn, threshold, band: record.bands.term });
});

test('an entry of eleven-word sentences fails the committed band of either format, at every size', () => {
  const record = committed();
  for (const format of FORMATS) {
    const band = bandFor(record, format);
    for (let size = 1; size <= 40; size += 1) {
      const sentences = repeat(band.threshold - 1, size).map(sentence);
      assert.notDeepEqual(bandProblems({ sentences, band }), [], `${format}, ${size} sentences`);
    }
  }
});
