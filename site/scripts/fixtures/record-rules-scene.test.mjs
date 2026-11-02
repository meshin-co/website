import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { claimTableProblems, factualSentences } from '../claim-sources.mjs';
import { wordCount } from '../entry-prose.mjs';
import { validateRecord } from '../generation-record.mjs';
import { bandProblems, loadCorpus, measureCorpus, readBandRecord, recordProblems } from '../sentence-band.mjs';
import {
  ELEVEN_WORD_SENTENCE,
  ENTRY_PATH,
  FACT,
  entryText,
  proseOf,
  bandSceneFiles,
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

const REPO = resolve(import.meta.dirname, '../../..');
const BAND_PATH = 'audits/sentence-band.json';
const THRESHOLD = 12;
const LONG_SENTENCE = `${Array(20).fill('word').join(' ')}.`;

function inScene(files, check) {
  const root = mkdtempSync(join(tmpdir(), 'band-scene-'));
  try {
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), body);
    }
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const problemRules = (root) =>
  recordProblems(readBandRecord(root), measureCorpus(loadCorpus(root), { threshold: THRESHOLD })).map(
    ({ rule }) => rule
  );

test('the band scene holds a record and both collections of a corpus', () => {
  const paths = Object.keys(bandSceneFiles());
  assert.ok(paths.includes(BAND_PATH));
  assert.ok(paths.some((path) => path.startsWith('site/src/data/post/')));
  assert.ok(paths.some((path) => path.startsWith('site/src/data/glossary/')));
});

test('the band scene record agrees with the corpus the scene plants, as the product measures it', () =>
  inScene(bandSceneFiles(), (root) => assert.deepEqual(problemRules(root), [])));

test('the band scene copies nothing from the repository, so no entry added there can move it', () => {
  const planted = Object.keys(bandSceneFiles()).filter((path) => path.startsWith('site/src/data/'));
  assert.ok(planted.length > 0);
  for (const path of planted) assert.equal(existsSync(join(REPO, path)), false, path);
});

test('a corpus entry planted in the band scene after its record was written makes the corpus and distribution rules fire', () => {
  const files = {
    ...bandSceneFiles(),
    'site/src/data/post/zz-late-entry.md': entryText({ sentences: Array(9).fill(LONG_SENTENCE) }),
  };
  inScene(files, (root) => {
    const rules = problemRules(root);
    assert.ok(rules.includes('record-corpus-stale'), rules.join());
    assert.ok(rules.includes('record-distribution-stale'), rules.join());
  });
});
