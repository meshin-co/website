import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { bandRecordFindings, generationReport } from './autowriter-record-rules.mjs';
import {
  BAND_RECORD,
  ELEVEN_WORD_SENTENCE,
  ENTRY_PATH,
  FACT,
  NIST_URL,
  RECORD_PATH,
  SENTENCES,
  SLUG,
  asJson,
  entryText,
  bandSceneFiles,
  recordWith,
} from './fixtures/record-rules-scene.mjs';
import { GENERATION_DIR } from './generation-record.mjs';
import { BAND_FILE, REMEASURE_COMMAND } from './sentence-band.mjs';

function repoWith(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'record-rules-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const recordsIn = (root) =>
  readdirSync(join(root, GENERATION_DIR))
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({
      path: GENERATION_DIR + '/' + name,
      text: readFileSync(join(root, GENERATION_DIR, name), 'utf8'),
    }));

const entryReader = (root) => (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null);

const findingsOf = (root, band = BAND_RECORD) =>
  generationReport({ records: recordsIn(root), readEntry: entryReader(root), band });

const sceneIn = (t, { record = recordWith(), entry = entryText(), recordPath = RECORD_PATH } = {}) =>
  repoWith(t, { [recordPath]: asJson(record), [ENTRY_PATH]: entry });

const rulesOf = (found) => found.map(({ rule }) => rule);

const withoutFactRow = () => recordWith({ claimTable: recordWith().claimTable.slice(1) });

test('a valid record beside its entry draws no finding', (t) => {
  assert.deepEqual(findingsOf(sceneIn(t)), []);
});

test('a record that is not JSON is one finding that names the file', (t) => {
  const root = repoWith(t, { [RECORD_PATH]: '{ not json' });
  const [found, ...more] = findingsOf(root);
  assert.equal(more.length, 0);
  assert.equal(found.rule, 'generation-unreadable');
  assert.equal(found.path, RECORD_PATH);
  assert.match(found.detail, /^not readable JSON: /);
});

test('a record with one corrupted field is one schema finding that says which field', (t) => {
  const record = { ...recordWith(), schema: 2 };
  assert.deepEqual(findingsOf(sceneIn(t, { record })), [
    { rule: 'generation-schema', path: RECORD_PATH, detail: 'schema must equal 1' },
  ]);
});

test('every schema problem of a record is its own finding', (t) => {
  const record = { ...recordWith(), schema: 2, note: 'hi' };
  assert.deepEqual(
    findingsOf(sceneIn(t, { record })).map(({ detail }) => detail),
    ['schema must equal 1', 'note has an unexpected key']
  );
});

test('a record filed under a name that is not its slug is a finding', (t) => {
  const recordPath = GENERATION_DIR + '/other-name.json';
  const found = findingsOf(sceneIn(t, { recordPath }));
  assert.deepEqual(found, [
    {
      rule: 'generation-name',
      path: recordPath,
      detail: 'slug ' + SLUG + ' does not match the file name other-name.json',
    },
  ]);
});

test('a record whose entry file is gone is a finding that names the entry', (t) => {
  const root = repoWith(t, { [RECORD_PATH]: asJson(recordWith()) });
  assert.deepEqual(findingsOf(root), [
    {
      rule: 'generation-entry-missing',
      path: RECORD_PATH,
      detail: 'the entry ' + ENTRY_PATH + ' the record describes does not exist',
    },
  ]);
});

test('an entry with no front matter is a finding, not a crash', (t) => {
  const [found, ...more] = findingsOf(sceneIn(t, { entry: 'no front matter here\n' }));
  assert.equal(more.length, 0);
  assert.equal(found.rule, 'generation-entry-unreadable');
  assert.match(found.detail, /^audits\/autowriter\/generations\/zz-specimen\.md cannot be read: .*front matter/);
});

test('deleting the row that binds a factual sentence leaves it unbound, named with its sentence and entry', (t) => {
  const [found, ...more] = findingsOf(sceneIn(t, { record: withoutFactRow() }));
  assert.equal(more.length, 0);
  assert.equal(found.rule, 'fact-unbound');
  assert.equal(found.path, RECORD_PATH);
  assert.ok(found.detail.startsWith(ENTRY_PATH + ', sentence "' + FACT + '": '), found.detail);
});

test('a row that cites a source the entry does not list is source-unresolved', (t) => {
  const stray = { id: 'S1', title: 'Elsewhere', url: 'https://www.nist.gov/other' };
  const rows = recordWith().claimTable.map((row) => (row.source ? { ...row, source: stray } : row));
  assert.deepEqual(rulesOf(findingsOf(sceneIn(t, { record: recordWith({ claimTable: rows }) }))), [
    'source-unresolved',
  ]);
});

test('the id the entry front matter carries is used when it has one', (t) => {
  const withId = (id) => entryText().replace('  - title: NIST AI RMF', '  - id: ' + id + '\n    title: NIST AI RMF');
  assert.deepEqual(findingsOf(sceneIn(t, { entry: withId('S1') })), []);
  assert.deepEqual(rulesOf(findingsOf(sceneIn(t, { entry: withId('S9') }))), ['source-unresolved']);
});

test('a sentence about a standard that rests on a source off the primary domains is refused', (t) => {
  const standard = 'The ISO standard for an AI management system asks for a documented scope and a named owner.';
  const rows = recordWith().claimTable.map((row) =>
    row.source ? { ...row, sentence: standard, source: { ...row.source, url: 'https://example.com/a-summary' } } : row
  );
  const entry = entryText({ sentences: [standard, ...SENTENCES.slice(1)] }).replace(
    NIST_URL,
    'https://example.com/a-summary'
  );
  const found = findingsOf(sceneIn(t, { record: recordWith({ claimTable: rows, entry }), entry }));
  assert.deepEqual(rulesOf(found), ['standard-without-primary-source']);
});

test('prose of eleven-word sentences leaves the band, and the finding carries the measured values', (t) => {
  const entry = entryText({ sentences: Array(10).fill(ELEVEN_WORD_SENTENCE) });
  const found = findingsOf(sceneIn(t, { entry, record: recordWith({ claimTable: [], entry }) }));
  assert.deepEqual(rulesOf(found), ['below-threshold-share', 'just-below-threshold-cluster']);
  assert.ok(found.every(({ path }) => path === RECORD_PATH));
  assert.match(
    found[0].detail,
    /^audits\/autowriter\/generations\/zz-specimen\.md: 10 of 10 sentences \(100%\) are under 12 words; the band allows 5; article band: median 10 to 15 words/
  );
});

test('an entry of fewer sentences than the band judges is a too-few-sentences finding', (t) => {
  const entry = entryText({ sentences: Array(4).fill(ELEVEN_WORD_SENTENCE) });
  const found = findingsOf(sceneIn(t, { entry, record: recordWith({ claimTable: [], entry }) }));
  assert.deepEqual(rulesOf(found), ['too-few-sentences']);
});

test('a record that carries no band is one schema finding that names the band', (t) => {
  const { band, ...record } = recordWith();
  assert.ok(band);
  assert.deepEqual(findingsOf(sceneIn(t, { record })), [
    { rule: 'generation-schema', path: RECORD_PATH, detail: 'band is required' },
  ]);
});

test('limits written into the record cannot widen the band the entry is judged against', (t) => {
  const entry = entryText({ sentences: Array(10).fill(ELEVEN_WORD_SENTENCE) });
  const record = recordWith({ claimTable: [], entry });
  record.band.limits = { ...record.band.limits, belowThresholdCap: 1, justBelowCap: 1 };
  const found = findingsOf(sceneIn(t, { entry, record }));
  assert.deepEqual(rulesOf(found), ['below-threshold-share', 'just-below-threshold-cluster']);
});

test('limits recorded under an older band are history, not a finding, while the entry sits inside the committed band', (t) => {
  const record = recordWith();
  record.band.limits = { ...record.band.limits, medianFloor: 9 };
  assert.deepEqual(findingsOf(sceneIn(t, { record })), []);
});

test('a record that drops the limits it was judged against is a schema finding that names them', (t) => {
  const record = recordWith();
  delete record.band.limits;
  assert.deepEqual(findingsOf(sceneIn(t, { record })), [
    { rule: 'generation-schema', path: RECORD_PATH, detail: 'band.limits is required' },
  ]);
});

test('a measurement the entry does not bear out is a finding that names the field and both values', (t) => {
  const record = recordWith();
  record.band.measured = { ...record.band.measured, median: 99 };
  const found = findingsOf(sceneIn(t, { record }));
  assert.deepEqual(rulesOf(found), ['band-measurement-differs']);
  assert.ok(found[0].detail.includes('median 99'), found[0].detail);
  assert.ok(found[0].detail.includes(ENTRY_PATH), found[0].detail);
});

test('a record that measures zero sentences does not read as a pass for an entry that has nine', (t) => {
  const record = recordWith();
  record.band.measured = {
    ...record.band.measured,
    sentences: 0,
    median: 0,
    shareBelowThreshold: 0,
    shareJustBelow: 0,
  };
  assert.deepEqual(rulesOf(findingsOf(sceneIn(t, { record }))), ['band-measurement-differs']);
});

test('with no band record to judge against, every record is unjudged and says so', (t) => {
  const root = sceneIn(t);
  const found = findingsOf(root, null);
  assert.deepEqual(rulesOf(found), ['generation-band-unjudged']);
  assert.equal(found[0].path, RECORD_PATH);
  assert.ok(found[0].detail.includes('audits/sentence-band.json'), found[0].detail);
});

test('a band record that holds no band for the format of the entry leaves the record unjudged', (t) => {
  const band = { ...BAND_RECORD, bands: { term: BAND_RECORD.bands.term } };
  const found = findingsOf(sceneIn(t), band);
  assert.deepEqual(rulesOf(found), ['generation-band-unjudged']);
  assert.ok(found[0].detail.includes('"article"'), found[0].detail);
});

test('the band record that matches a fresh measurement draws no finding', (t) => {
  assert.deepEqual(bandRecordFindings(repoWith(t, bandSceneFiles())), []);
});

test('a bumped limit in the band record is a stale finding on that file, with the command that repairs it', (t) => {
  const files = bandSceneFiles();
  const record = JSON.parse(files[BAND_FILE]);
  record.bands.article.medianFloor += 1;
  const found = bandRecordFindings(repoWith(t, { ...files, [BAND_FILE]: asJson(record) }));
  assert.deepEqual(rulesOf(found), ['record-bands-stale']);
  assert.equal(found[0].path, BAND_FILE);
  assert.ok(found[0].detail.endsWith('(re-measure with: ' + REMEASURE_COMMAND + ')'), found[0].detail);
});

test('a missing band record is a finding', (t) => {
  const { [BAND_FILE]: gone, ...files } = bandSceneFiles();
  assert.ok(gone);
  const found = bandRecordFindings(repoWith(t, files));
  assert.deepEqual(rulesOf(found), ['record-missing']);
});

test('a band record that is not JSON, or a repository with no corpus, is a finding and not a crash', (t) => {
  const unreadable = bandRecordFindings(repoWith(t, { ...bandSceneFiles(), [BAND_FILE]: '{ nope' }));
  assert.deepEqual(rulesOf(unreadable), ['band-record-unmeasurable']);
  const empty = bandRecordFindings(repoWith(t, { [BAND_FILE]: bandSceneFiles()[BAND_FILE] }));
  assert.deepEqual(rulesOf(empty), ['band-record-unmeasurable']);
});
