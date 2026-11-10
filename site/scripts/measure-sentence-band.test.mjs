import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DUPLICATE_MINIMUM_WORDS } from './content-gate.mjs';
import { filedAt } from './fixtures/record-depths.mjs';
import { generatedSlugs, run } from './measure-sentence-band.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';
import {
  BAND_FILE,
  bandFor,
  bandProblems,
  bandRecord,
  bandSummary,
  deriveBands,
  loadCorpus,
  measureCorpus,
  readBandRecord,
  recordProblems,
} from './sentence-band.mjs';

const SCRIPT = fileURLToPath(new URL('./measure-sentence-band.mjs', import.meta.url));
const TODAY = '2026-11-02';
const FILED = '2026-11-02T07:00:00.000Z';
const DATA = 'site/src/data';
const FORMATS = ['article', 'term'];
const GENERATIONS = recordDirectory('generation');

const sentence = (words) =>
  Array.from({ length: words }, (_, index) => (index === words - 1 ? 'end.' : `w${index}`)).join(' ');
const repeat = (length, count) => Array(count).fill(length);
const entryFile = (field, lengths) => `---\n${field}: |\n  ${lengths.map(sentence).join(' ')}\n---\n`;
const termFiles = (count, length, sentences = 9) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `${DATA}/glossary/term-${index}.md`,
      entryFile('definition', repeat(length, sentences)),
    ])
  );

const STEADY = {
  ...termFiles(10, 14),
  [`${DATA}/glossary/brief.md`]: entryFile('definition', [5, 20, 13]),
  [`${DATA}/post/guide.md`]: entryFile('fullAnswer', repeat(14, 8)),
  [`${DATA}/post/guide-two.md`]: entryFile('fullAnswer', repeat(14, 8)),
};

const repoWith = (t, files) => {
  const root = mkdtempSync(join(tmpdir(), 'sentence-band-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

const runIn = (repoRoot, { write = false } = {}) => {
  const lines = { out: [], err: [] };
  const status = run({
    write,
    repoRoot,
    today: TODAY,
    out: (line) => lines.out.push(line),
    err: (line) => lines.err.push(line),
  });
  return { status, ...lines };
};

const recordOf = (root) => JSON.parse(readFileSync(join(root, BAND_FILE), 'utf8'));
const same = (value) => ({
  p5: value,
  p25: value,
  p50: value,
  p75: value,
  p90: value,
  p95: value,
  p99: value,
  max: value,
});

const byId = (a, b) => a.id.localeCompare(b.id);

test('loadCorpus reads the post and glossary collections, with parsed front matter and body', (t) => {
  const root = repoWith(t, {
    [`${DATA}/glossary/b-term.md`]: '---\nterm: B\n---\nBody B.\n',
    [`${DATA}/glossary/a-term.md`]: '---\nterm: A\n---\n',
    [`${DATA}/glossary/notes.txt`]: 'ignored',
    [`${DATA}/post/p.md`]: '---\ntitle: P\n---\n',
    [`${DATA}/faq/q.md`]: '---\nquestion: Q\n---\n',
    [`${DATA}/service/s.md`]: '---\ntitle: S\n---\n',
  });
  assert.deepEqual(loadCorpus(root, { exclude: [] }).sort(byId), [
    { id: 'glossary/a-term', collection: 'glossary', frontmatter: { term: 'A' }, body: '' },
    { id: 'glossary/b-term', collection: 'glossary', frontmatter: { term: 'B' }, body: 'Body B.\n' },
    { id: 'post/p', collection: 'post', frontmatter: { title: 'P' }, body: '' },
  ]);
});

test('loadCorpus leaves out the slugs it is told to exclude, given as an array or a set', (t) => {
  const root = repoWith(t, {
    [`${DATA}/glossary/a.md`]: '---\nterm: A\n---\n',
    [`${DATA}/glossary/b.md`]: '---\nterm: B\n---\n',
    [`${DATA}/post/d.md`]: '---\ntitle: D\n---\n',
  });
  assert.deepEqual(
    loadCorpus(root, { exclude: ['b'] }).map(({ id }) => id),
    ['glossary/a', 'post/d']
  );
  assert.deepEqual(
    loadCorpus(root, { exclude: new Set(['a', 'd']) }).map(({ id }) => id),
    ['glossary/b']
  );
});

test('loadCorpus names the entry whose front matter it cannot read', (t) => {
  const root = repoWith(t, {
    [`${DATA}/glossary/ok.md`]: '---\nterm: A\n---\n',
    [`${DATA}/post/broken.md`]: 'no front matter',
  });
  assert.throws(() => loadCorpus(root, { exclude: [] }), /post\/broken: .*front matter/);
});

const memoryEntry = (id, collection, field, length) => ({
  id,
  collection,
  frontmatter: { [field]: repeat(length, 8).map(sentence).join(' ') },
  body: '',
});

const memory = (lengths) =>
  measureCorpus(
    lengths.flatMap((length, index) => [
      memoryEntry(`post/p${index}`, 'post', 'fullAnswer', length),
      memoryEntry(`glossary/t${index}`, 'glossary', 'definition', length),
    ]),
    { threshold: 12 }
  );

const FRESH = memory([14, 15, 16, 17]);
const RECORD = bandRecord({ measure: FRESH, bands: deriveBands(FRESH), measuredOn: TODAY });

test('the record holds the schema, the date, the threshold, the minimum, the counts, the distribution and the bands', () => {
  assert.deepEqual(Object.keys(RECORD), [
    'schema',
    'measuredOn',
    'threshold',
    'minimumSentences',
    'corpus',
    'distribution',
    'bands',
  ]);
  assert.deepEqual(
    { schema: RECORD.schema, measuredOn: RECORD.measuredOn, threshold: RECORD.threshold },
    { schema: 1, measuredOn: TODAY, threshold: 12 }
  );
  assert.deepEqual(Object.keys(RECORD.bands), FORMATS);
  assert.deepEqual(RECORD.bands, deriveBands(FRESH));
  assert.deepEqual(bandSummary(RECORD, 'article'), { measuredOn: TODAY, threshold: 12, band: RECORD.bands.article });
});

test('readBandRecord returns the parsed record of a repository, or null when it has none', (t) => {
  const root = repoWith(t, STEADY);
  assert.equal(readBandRecord(root), null);
  runIn(root, { write: true });
  const record = readBandRecord(root);
  assert.equal(record.measuredOn, TODAY);
  assert.equal(bandFor(record, 'term').medianFloor, 14);
});

test('a record that matches a fresh measurement is current, whatever date it carries', () => {
  assert.deepEqual(recordProblems(RECORD, FRESH), []);
  assert.deepEqual(recordProblems({ ...RECORD, measuredOn: '2025-01-01' }, FRESH), []);
});

test('a corpus that grew, a moved threshold, an edited band and a changed distribution each make the record stale', () => {
  const rulesFor = (record, fresh) => recordProblems(record, fresh).map(({ rule }) => rule);
  assert.deepEqual(rulesFor(RECORD, memory([14, 15, 16, 17, 18])), [
    'record-corpus-stale',
    'record-distribution-stale',
    'record-bands-stale',
  ]);
  const editedBand = { ...RECORD.bands.term, medianFloor: 9 };
  assert.deepEqual(rulesFor({ ...RECORD, bands: { ...RECORD.bands, term: editedBand } }, FRESH), [
    'record-bands-stale',
  ]);
  assert.deepEqual(rulesFor({ ...RECORD, threshold: 13 }, FRESH), ['record-threshold-stale']);
  assert.deepEqual(rulesFor({ ...RECORD, minimumSentences: 5 }, FRESH), ['record-minimum-sentences-stale']);
  assert.deepEqual(rulesFor({ ...RECORD, schema: 2 }, FRESH), ['record-schema-stale']);
  const pooled = { ...RECORD.distribution.term.pooled, shareOneBelow: 0.5 };
  const shifted = { ...RECORD.distribution, term: { ...RECORD.distribution.term, pooled } };
  assert.deepEqual(rulesFor({ ...RECORD, distribution: shifted }, FRESH), ['record-distribution-stale']);
});

test('a stale record says how the corpus moved, and a missing record is reported by file name', () => {
  const [corpus] = recordProblems(RECORD, memory([14, 15, 16, 17, 18]));
  assert.match(
    corpus.detail,
    /the record measured 4 article entries with 32 sentences, 4 term entries with 32 sentences;/
  );
  assert.match(
    corpus.detail,
    /the corpus now has 5 article entries with 40 sentences, 5 term entries with 40 sentences$/
  );
  assert.deepEqual(recordProblems(null, FRESH), [{ rule: 'record-missing', detail: `${BAND_FILE} does not exist` }]);
});

const BAND_NUMBERS = {
  threshold: 12,
  justBelowFrom: 8,
  minimumSentences: 8,
  medianFloor: 14,
  medianCeiling: 14,
  belowThresholdCap: 0,
  justBelowCap: 0,
};

test('--write measures each format, prints the distributions and the bands, and writes the record', (t) => {
  const root = repoWith(t, STEADY);
  const { status, out, err } = runIn(root, { write: true });
  assert.deepEqual([status, err], [0, []]);
  assert.deepEqual(recordOf(root), {
    schema: 1,
    measuredOn: TODAY,
    threshold: 12,
    minimumSentences: 8,
    corpus: {
      article: { entries: 2, measured: 2, sentences: 16 },
      term: { entries: 11, measured: 10, sentences: 93 },
    },
    distribution: {
      article: {
        pooled: { sentenceWords: same(14), shareBelowThreshold: 0, shareJustBelow: 0, shareOneBelow: 0 },
        perEntry: { sentences: same(8), median: same(14), shareBelowThreshold: same(0), shareJustBelow: same(0) },
      },
      term: {
        pooled: {
          sentenceWords: { ...same(14), p99: 20, max: 20 },
          shareBelowThreshold: 0.0108,
          shareJustBelow: 0,
          shareOneBelow: 0,
        },
        perEntry: { sentences: same(9), median: same(14), shareBelowThreshold: same(0), shareJustBelow: same(0) },
      },
    },
    bands: {
      article: { format: 'article', ...BAND_NUMBERS },
      term: { format: 'term', ...BAND_NUMBERS },
    },
  });
  const printed = out.join('\n');
  assert.ok(printed.includes('term: 11 entries, 10 of them with 8 sentences or more, 93 sentences'), printed);
  assert.ok(
    printed.includes('  pooled sentence words: p5 14, p25 14, p50 14, p75 14, p90 14, p95 14, p99 20, max 20'),
    printed
  );
  assert.ok(printed.includes(`  band: ${JSON.stringify({ format: 'term', ...BAND_NUMBERS })}`), printed);
  assert.ok(printed.includes(`  band: ${JSON.stringify({ format: 'article', ...BAND_NUMBERS })}`), printed);
});

test('without --write it confirms a current record and leaves the file alone', (t) => {
  const root = repoWith(t, STEADY);
  runIn(root, { write: true });
  const before = readFileSync(join(root, BAND_FILE), 'utf8');
  const { status, err } = runIn(root);
  assert.deepEqual([status, err], [0, []]);
  assert.equal(readFileSync(join(root, BAND_FILE), 'utf8'), before);
});

test('a record the corpus has moved past fails, names the rule and says how to re-measure', (t) => {
  const root = repoWith(t, STEADY);
  runIn(root, { write: true });
  writeFileSync(join(root, DATA, 'glossary/term-10.md'), entryFile('definition', repeat(15, 9)));
  const { status, err } = runIn(root);
  assert.equal(status, 1);
  assert.ok(
    err.some((line) => line.includes('record-corpus-stale')),
    err.join('\n')
  );
  assert.ok(
    err.some((line) => line.includes('node scripts/measure-sentence-band.mjs --write')),
    err.join('\n')
  );
});

test('a missing record fails by name', (t) => {
  const { status, err } = runIn(repoWith(t, STEADY));
  assert.equal(status, 1);
  assert.ok(
    err.some((line) => line.includes('record-missing')),
    err.join('\n')
  );
});

test('a corpus that cannot bind eleven-word entries fails and writes nothing', (t) => {
  const root = repoWith(t, {
    ...termFiles(10, 11, 8),
    [`${DATA}/post/guide.md`]: entryFile('fullAnswer', repeat(11, 8)),
    [`${DATA}/post/guide-two.md`]: entryFile('fullAnswer', repeat(11, 8)),
  });
  const { status, err } = runIn(root, { write: true });
  assert.equal(status, 1);
  assert.ok(
    err.some((line) => line.includes('admits an entry made only of 11-word sentences')),
    err.join('\n')
  );
  assert.equal(existsSync(join(root, BAND_FILE)), false);
});

test('a corpus of one entry per format fails by name and writes nothing', (t) => {
  const root = repoWith(t, {
    ...termFiles(1, 14, 8),
    [`${DATA}/post/guide.md`]: entryFile('fullAnswer', repeat(14, 8)),
  });
  const { status, err } = runIn(root, { write: true });
  assert.equal(status, 1);
  assert.ok(
    err.some((line) => line.includes('band would have no width')),
    err.join('\n')
  );
  assert.equal(existsSync(join(root, BAND_FILE)), false);
});

test('entries that carry a generation record are left out of the measurement', (t) => {
  const root = repoWith(t, {
    ...STEADY,
    [`${DATA}/glossary/machine-written.md`]: entryFile('definition', repeat(11, 6)),
    [recordPath('generation', 'machine-written', FILED)]: '{}',
    [`${GENERATIONS}/2026/11/notes.txt`]: 'not a record',
  });
  assert.equal(runIn(root, { write: true }).status, 0);
  assert.equal(recordOf(root).corpus.term.entries, 11);
});

const MACHINE_WRITTEN = ['flat-made', 'month-made', 'deep-made'];
const recordsAt = filedAt(FILED);
const GENERATION_RECORDS = {
  [recordsAt.flat('generation', 'flat-made')]: '{}',
  [recordsAt.month('generation', 'month-made')]: '{}',
  [recordsAt.deeper('generation', 'deep-made')]: '{}',
};
const machineWrittenEntries = Object.fromEntries(
  MACHINE_WRITTEN.map((slug) => [`${DATA}/glossary/${slug}.md`, entryFile('definition', repeat(11, 6))])
);

test('generatedSlugs finds a generation record whether it lies flat, in its month or below it, and counts all three', (t) => {
  const slugs = generatedSlugs(repoWith(t, GENERATION_RECORDS));

  assert.equal(slugs.length, 3);
  assert.deepEqual([...slugs].sort(), ['deep-made', 'flat-made', 'month-made']);
});

test('generatedSlugs finds nothing, and does not fail, where the repository holds no generation record', (t) => {
  assert.deepEqual(generatedSlugs(repoWith(t, STEADY)), []);
});

test('generatedSlugs reads generation records only: a ledger, a claim and a text file are not one', (t) => {
  const root = repoWith(t, {
    [recordPath('ledger', 'only-ledger', FILED)]: '{}',
    [recordPath('claim', 'only-claim', FILED)]: '{}',
    [`${GENERATIONS}/2026/11/only-text.txt`]: 'not a record',
    [recordPath('generation', 'real-record', FILED)]: '{}',
  });

  assert.deepEqual(generatedSlugs(root), ['real-record']);
});

test('the entries of generation records that lie flat, in their month and below it are all left out of the measurement', (t) => {
  const measured = (files) => {
    const root = repoWith(t, { ...STEADY, ...machineWrittenEntries, ...files });
    const { status, out } = runIn(root, { write: true });
    assert.equal(status, 0);
    return { entries: recordOf(root).corpus.term.entries, printed: out.join('\n') };
  };

  assert.equal(measured({}).entries, 14);
  const { entries, printed } = measured(GENERATION_RECORDS);
  assert.equal(entries, 11);
  assert.ok(printed.includes('term: 11 entries, 10 of them with 8 sentences or more, 93 sentences'), printed);
});

test('the command line writes, confirms, then reports a corpus that moved on', (t) => {
  const root = repoWith(t, STEADY);
  const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, root], { encoding: 'utf8' });
  assert.equal(cli('--write').status, 0);
  assert.equal(cli().status, 0);
  writeFileSync(join(root, DATA, 'glossary/term-10.md'), entryFile('definition', repeat(15, 9)));
  const stale = cli();
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /record-corpus-stale/);
});

test('the command line refuses an unknown flag and an extra argument', () => {
  for (const args of [['--wite'], ['..', 'extra']]) {
    const refused = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    assert.equal(refused.status, 2, args.join(' '));
    assert.match(refused.stderr, /usage: node scripts\/measure-sentence-band\.mjs \[--write\]/);
  }
});

test('the command line measures the parent of its working directory when it is given no root', (t) => {
  const root = repoWith(t, { ...STEADY, 'site/src/config.yaml': 'site:\n  name: example.test\n' });
  const cli = (...args) =>
    spawnSync(process.execPath, [SCRIPT, ...args], { cwd: join(root, 'site'), encoding: 'utf8' });
  assert.equal(cli('--write').status, 0);
  assert.equal(recordOf(root).corpus.term.entries, 11);
  assert.equal(cli().status, 0);
});

test('a failure that is not a band failure is thrown, not reported as one', (t) => {
  const root = repoWith(t, { 'site/readme.txt': 'no data directories here' });
  assert.throws(() => runIn(root), { code: 'ENOENT' });
});

const LOW_MEDIAN = [11, 11, 11, 11, 11, 30, 30, 30];
const LOOSE_LENGTHS = [...Array(2).fill(LOW_MEDIAN), ...Array(18).fill(repeat(20, 8))];
const looseFiles = (collection, field) =>
  Object.fromEntries(
    LOOSE_LENGTHS.map((lengths, index) => [`${DATA}/${collection}/entry-${index}.md`, entryFile(field, lengths)])
  );
const LOOSE = { ...looseFiles('glossary', 'definition'), ...looseFiles('post', 'fullAnswer') };

const writtenRecord = (t) => {
  const root = repoWith(t, LOOSE);
  assert.equal(runIn(root, { write: true }).status, 0);
  return readBandRecord(root);
};

test('the record the script writes was measured against the threshold the content gate enforces now', (t) => {
  const record = writtenRecord(t);
  assert.equal(record.threshold, DUPLICATE_MINIMUM_WORDS);
  for (const format of FORMATS) assert.equal(bandFor(record, format).threshold, DUPLICATE_MINIMUM_WORDS);
});

test('each band the script writes is the one its own recorded distribution derives, so a hand edit shows', (t) => {
  const record = writtenRecord(t);
  assert.equal(record.schema, 1);
  assert.match(record.measuredOn, /^\d{4}-\d{2}-\d{2}$/);
  const { threshold, minimumSentences, corpus, distribution } = record;
  assert.deepEqual(deriveBands({ threshold, minimumSentences, corpus, distribution }), record.bands);
  assert.deepEqual(bandSummary(record, 'term'), { measuredOn: record.measuredOn, threshold, band: record.bands.term });
});

test('an entry of eleven-word sentences fails the band the script writes for either format, at every size', (t) => {
  const record = writtenRecord(t);
  for (const format of FORMATS) {
    const band = bandFor(record, format);
    for (let size = 1; size <= 40; size += 1) {
      const sentences = repeat(band.threshold - 1, size).map(sentence);
      assert.notDeepEqual(bandProblems({ sentences, band }), [], `${format}, ${size} sentences`);
    }
  }
});
