import assert from 'node:assert/strict';
import { test } from 'node:test';

import { claimTableProblems, factualSentences } from '../claim-sources.mjs';
import { wordCount } from '../entry-prose.mjs';
import { validateRecord } from '../generation-record.mjs';
import { bandProblems } from '../sentence-band.mjs';
import {
  ELEVEN_WORD_SENTENCE,
  ENTRY_PATH,
  FACT,
  entryText,
  proseOf,
  realBandFiles,
  recordWith,
} from './record-rules-scene.mjs';

test('the scene record is a valid generation record that points at the scratch entry', () => {
  const record = recordWith();
  assert.deepEqual(validateRecord(record), []);
  assert.equal(record.entry.path, ENTRY_PATH);
  assert.ok(record.files.includes(ENTRY_PATH));
});

test('the scene entry holds one factual sentence, and the scene table and band accept it', () => {
  const sentences = proseOf(entryText());
  assert.deepEqual(factualSentences(sentences), [FACT]);
  const record = recordWith();
  const claims = record.claimTable.map((row) => ({ ...row, sourceId: row.source?.id ?? null }));
  const sources = [{ id: 'S1', title: 'NIST AI RMF', url: record.claimTable[0].source.url }];
  assert.deepEqual(claimTableProblems({ claims, sources, sentences }), []);
  assert.deepEqual(bandProblems({ sentences, band: record.band.limits }), []);
});

test('eleven-word sentences are eleven words long and fall below the scene band', () => {
  assert.equal(wordCount(ELEVEN_WORD_SENTENCE), 11);
  const sentences = proseOf(entryText({ sentences: Array(10).fill(ELEVEN_WORD_SENTENCE) }));
  assert.deepEqual(
    bandProblems({ sentences, band: recordWith().band.limits }).map(({ rule }) => rule),
    ['below-threshold-share', 'just-below-threshold-cluster']
  );
});

test('the real band files hold both measured records and both collections of the corpus', () => {
  const paths = Object.keys(realBandFiles());
  assert.ok(paths.includes('audits/sentence-band.json'));
  assert.ok(paths.includes('audits/entry-length.json'));
  assert.ok(paths.some((path) => path.startsWith('site/src/data/post/')));
  assert.ok(paths.some((path) => path.startsWith('site/src/data/glossary/')));
});
