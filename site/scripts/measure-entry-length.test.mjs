import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { DATA, STEADY, entryFile, repoWith, words } from './fixtures/length-corpus.mjs';
import { run } from './measure-entry-length.mjs';
import { generatedSlugs } from './measure-sentence-band.mjs';
import { loadCorpus } from './sentence-band.mjs';

const SCRIPT = fileURLToPath(new URL('./measure-entry-length.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const TODAY = '2026-11-02';

const runIn = (root, options = {}) => {
  const out = [];
  const err = [];
  const status = run({
    write: false,
    repoRoot: root,
    today: TODAY,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ...options,
  });
  return { status, out, err };
};

const recordOf = (root) => JSON.parse(readFileSync(join(root, LENGTH_FILE), 'utf8'));

test('--write measures each format, prints what it found and writes the record', (t) => {
  const root = repoWith(t, STEADY);
  const { status, out, err } = runIn(root, { write: true, exclude: [] });
  assert.deepEqual([status, err], [0, []]);
  const record = recordOf(root);
  assert.equal(record.schema, 1);
  assert.equal(record.measuredOn, TODAY);
  assert.deepEqual(record.corpus, { article: { entries: 3 }, term: { entries: 2 } });
  assert.deepEqual(record.limits.article, {
    format: 'article',
    wordsFloor: 520,
    targetFrom: 520,
    targetTo: 1600,
    sectionsFloor: 4,
    sectionWordsFloor: 100,
  });
  const printed = out.join('\n');
  assert.ok(printed.includes('article: 3 entries'), printed);
  assert.ok(printed.includes('  body words: min 520, p25 520, p50 860, p75 1600, max 1600'), printed);
  assert.ok(printed.includes('  shortest: post/short, 520 words, which sets the floor'), printed);
  assert.ok(printed.includes('  limits: ' + JSON.stringify(record.limits.article)), printed);
  assert.ok(printed.includes('term: 2 entries'), printed);
  assert.ok(printed.includes('wrote ' + LENGTH_FILE), printed);
});

test('without --write it confirms a current record and leaves the file alone', (t) => {
  const root = repoWith(t, STEADY);
  runIn(root, { write: true, exclude: [] });
  const before = readFileSync(join(root, LENGTH_FILE), 'utf8');
  const { status, out, err } = runIn(root, { today: '2030-01-01', exclude: [] });
  assert.deepEqual([status, err], [0, []]);
  assert.ok(out.join('\n').includes(LENGTH_FILE + ' matches a fresh measurement'));
  assert.equal(readFileSync(join(root, LENGTH_FILE), 'utf8'), before);
});

test('a record the corpus has moved past fails, names the rule and says how to re-measure', (t) => {
  const root = repoWith(t, STEADY);
  runIn(root, { write: true, exclude: [] });
  writeFileSync(join(root, DATA, 'post/new.md'), entryFile([60, 60, 60, 60]));
  const { status, err } = runIn(root, { exclude: [] });
  assert.equal(status, 1);
  const printed = err.join('\n');
  assert.match(
    printed,
    /ENTRY-LENGTH length-record-corpus-stale audits\/entry-length\.json: .*3 article entries.*4 article entries/
  );
  assert.match(printed, /ENTRY-LENGTH length-record-limits-stale/);
  assert.match(printed, /re-measure with: node scripts\/measure-entry-length\.mjs --write/);
});

test('a missing record fails by name', (t) => {
  const root = repoWith(t, STEADY);
  const { status, err } = runIn(root, { exclude: [] });
  assert.equal(status, 1);
  assert.match(err.join('\n'), /ENTRY-LENGTH length-record-missing audits\/entry-length\.json/);
});

test('an entry the pipeline wrote is left out of the measurement and is counted as left out', (t) => {
  const root = repoWith(t, { ...STEADY, [DATA + '/post/machine-written.md']: entryFile([10, 10, 10, 10]) });
  const { status, out } = runIn(root, { write: true, exclude: ['machine-written'] });
  assert.equal(status, 0);
  assert.deepEqual(recordOf(root).corpus.article, { entries: 3 });
  assert.equal(recordOf(root).limits.article.wordsFloor, 520);
  assert.ok(out.join('\n').includes('left out: 1 entry the pipeline wrote (machine-written)'), out.join('\n'));
});

test('a corpus whose floor would admit an unbroken block fails and writes nothing', (t) => {
  const root = repoWith(t, { ...STEADY, [DATA + '/glossary/flat.md']: '---\ntitle: Flat\n---\n' + words(120) + '\n' });
  const { status, err } = runIn(root, { write: true, exclude: [] });
  assert.equal(status, 1);
  assert.match(err.join('\n'), /ENTRY-LENGTH the derived term limits admit/);
  assert.equal(existsSync(join(root, LENGTH_FILE)), false);
});

test('the command line writes, confirms, then reports a corpus that moved on', (t) => {
  const root = repoWith(t, STEADY);
  const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, root], { encoding: 'utf8' });
  assert.equal(cli('--write').status, 0);
  assert.equal(cli().status, 0);
  writeFileSync(join(root, DATA, 'glossary/gamma.md'), entryFile([90, 90]));
  const stale = cli();
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /length-record-corpus-stale/);
});

test('the command line refuses an unknown flag and an extra argument', () => {
  for (const args of [['--wite'], ['..', 'extra']]) {
    const refused = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    assert.equal(refused.status, 2, args.join(' '));
    assert.match(refused.stderr, /usage: node scripts\/measure-entry-length\.mjs \[--write\]/);
  }
});

test('the command line measures the parent of its working directory when it is given no root', (t) => {
  const root = repoWith(t, { ...STEADY, 'site/src/config.yaml': 'site:\n  name: example.test\n' });
  const cli = (...args) =>
    spawnSync(process.execPath, [SCRIPT, ...args], { cwd: join(root, 'site'), encoding: 'utf8' });
  assert.equal(cli('--write').status, 0);
  assert.equal(recordOf(root).corpus.term.entries, 2);
  assert.equal(cli().status, 0);
});

test('a failure that is not a length failure is thrown, not reported as one', (t) => {
  const root = repoWith(t, { 'site/readme.txt': 'no data directories here' });
  assert.throws(() => runIn(root, { exclude: [] }), { code: 'ENOENT' });
});

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
