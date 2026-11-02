import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { lengthFindings } from './autowriter-length-rules.mjs';
import { LENGTH_FILE, REMEASURE_COMMAND } from './entry-length.mjs';
import { DATA, STEADY, entryFile, repoWith } from './fixtures/length-corpus.mjs';
import { PLACES, filedAt } from './fixtures/record-depths.mjs';
import { run } from './measure-entry-length.mjs';

const MACHINE = DATA + '/post/machine.md';
const TERM_MACHINE = DATA + '/glossary/machine-term.md';

const measure = (root, exclude = []) =>
  run({ write: true, repoRoot: root, today: '2026-11-02', out: () => {}, err: () => {}, exclude });

const measuredRepo = (t, files = {}, exclude = []) => {
  const root = repoWith(t, { ...STEADY, ...files });
  assert.equal(measure(root, exclude), 0);
  return root;
};

const rulesOf = (found) => found.map(({ rule }) => rule);
const recordOf = (root) => JSON.parse(readFileSync(join(root, LENGTH_FILE), 'utf8'));

test('a repository whose record is fresh and whose entries a person wrote has no finding', (t) => {
  assert.deepEqual(lengthFindings(measuredRepo(t), { generated: [] }), []);
});

test('an entry the pipeline wrote under the floor is named by its own path with every rule it breaks', (t) => {
  const root = measuredRepo(t, { [MACHINE]: entryFile([60, 60]) }, ['machine']);
  const found = lengthFindings(root, { generated: ['machine'] });
  assert.deepEqual(rulesOf(found), ['body-too-short', 'too-few-sections', 'section-too-thin']);
  for (const finding of found) assert.equal(finding.path, MACHINE);
  assert.match(found[0].detail, /the body has 120 words/);
  assert.match(found[0].detail, /fewer than 520/);
  assert.match(found[1].detail, /2 sections/);
  assert.match(found[2].detail, /"Question 1\?" has 60/);
});

test('an entry the pipeline wrote that clears every floor is not a finding', (t) => {
  const root = measuredRepo(t, { [MACHINE]: entryFile([130, 130, 130, 130]) }, ['machine']);
  assert.deepEqual(lengthFindings(root, { generated: ['machine'] }), []);
});

test('the pipeline cannot lower its own floor: its short entry leaves the record fresh and the floor where it was', (t) => {
  const root = measuredRepo(t, { [MACHINE]: entryFile([30, 30]) }, ['machine']);
  assert.equal(recordOf(root).limits.article.wordsFloor, 520);
  assert.deepEqual(recordOf(root).corpus.article, { entries: 3 });
  const stale = lengthFindings(root, { generated: ['machine'] }).filter(({ rule }) => rule.endsWith('-stale'));
  assert.deepEqual(stale, []);
});

test('a record measured with the pipeline entry in it is refused, because a fresh measurement leaves that entry out', (t) => {
  const root = measuredRepo(t, { [MACHINE]: entryFile([30, 30]) }, []);
  assert.equal(recordOf(root).limits.article.wordsFloor, 60);
  const found = lengthFindings(root, { generated: ['machine'] });
  assert.deepEqual(
    rulesOf(found).filter((rule) => rule.endsWith('-stale')),
    ['length-record-corpus-stale', 'length-record-distribution-stale', 'length-record-limits-stale']
  );
  assert.ok(found.every(({ path }) => path === LENGTH_FILE || path === MACHINE));
});

test('a missing record is one finding that names the file and the command that writes it', (t) => {
  const root = repoWith(t, { ...STEADY, [MACHINE]: entryFile([30, 30]) });
  assert.deepEqual(lengthFindings(root, { generated: ['machine'] }), [
    {
      rule: 'length-record-missing',
      path: LENGTH_FILE,
      detail: LENGTH_FILE + ' does not exist (re-measure with: ' + REMEASURE_COMMAND + ')',
    },
  ]);
});

test('a corpus a person changed makes the record stale, and each finding says how to re-measure', (t) => {
  const root = measuredRepo(t);
  writeFileSync(join(root, DATA, 'post/new.md'), entryFile([60, 60, 60, 60]));
  const found = lengthFindings(root, { generated: [] });
  assert.deepEqual(rulesOf(found), [
    'length-record-corpus-stale',
    'length-record-distribution-stale',
    'length-record-limits-stale',
  ]);
  for (const { path, detail } of found) {
    assert.equal(path, LENGTH_FILE);
    assert.ok(detail.endsWith('(re-measure with: ' + REMEASURE_COMMAND + ')'), detail);
  }
});

test('a floor edited by hand is stale on its own', (t) => {
  const root = measuredRepo(t);
  const record = recordOf(root);
  record.limits.article.wordsFloor = 10;
  writeFileSync(join(root, LENGTH_FILE), JSON.stringify(record));
  assert.deepEqual(rulesOf(lengthFindings(root, { generated: [] })), ['length-record-limits-stale']);
});

test('a record that is not JSON is one finding naming the file', (t) => {
  const root = measuredRepo(t);
  writeFileSync(join(root, LENGTH_FILE), '{ nope');
  const found = lengthFindings(root, { generated: [] });
  assert.deepEqual(rulesOf(found), ['length-record-unreadable']);
  assert.equal(found[0].path, LENGTH_FILE);
});

test('a corpus whose floor would admit an unbroken block is one finding, because nothing can be measured', (t) => {
  const root = measuredRepo(t);
  writeFileSync(join(root, DATA, 'glossary/flat.md'), '---\ntitle: Flat\n---\n' + 'word '.repeat(120) + '\n');
  const found = lengthFindings(root, { generated: [] });
  assert.deepEqual(rulesOf(found), ['length-record-unmeasurable']);
  assert.match(found[0].detail, /admit/);
});

test('an entry whose format the record holds no limits for is reported, not skipped', (t) => {
  const root = measuredRepo(t, { [TERM_MACHINE]: entryFile([20, 20]) }, ['machine-term']);
  const record = recordOf(root);
  delete record.limits.term;
  writeFileSync(join(root, LENGTH_FILE), JSON.stringify(record));
  const found = lengthFindings(root, { generated: ['machine-term'] });
  assert.ok(rulesOf(found).includes('length-unjudged'), rulesOf(found).join());
  const unjudged = found.find(({ rule }) => rule === 'length-unjudged');
  assert.equal(unjudged.path, TERM_MACHINE);
  assert.match(unjudged.detail, /"term"/);
});

test('with no entries named, the pipeline entries are the ones with a generation record', (t) => {
  const root = measuredRepo(t);
  assert.deepEqual(lengthFindings(root), []);
});

const recordsAt = filedAt('2026-11-02T07:00:00.000Z');

for (const [place, description] of Object.entries(PLACES)) {
  test(`an entry is the pipeline's when its generation record lies ${description}, so the gate judges it against the floor`, (t) => {
    const root = measuredRepo(
      t,
      { [MACHINE]: entryFile([60, 60]), [recordsAt[place]('generation', 'machine')]: '{}\n' },
      ['machine']
    );
    const found = lengthFindings(root);
    assert.deepEqual(rulesOf(found), ['body-too-short', 'too-few-sections', 'section-too-thin']);
    for (const finding of found) assert.equal(finding.path, MACHINE);
  });

  test(`a short entry whose generation record lies ${description} stays out of the corpus, so it cannot lower the floor`, (t) => {
    const root = measuredRepo(
      t,
      { [MACHINE]: entryFile([30, 30]), [recordsAt[place]('generation', 'machine')]: '{}\n' },
      ['machine']
    );
    assert.equal(recordOf(root).limits.article.wordsFloor, 520);
    const stale = lengthFindings(root).filter(({ rule }) => rule.endsWith('-stale'));
    assert.deepEqual(stale, []);
  });
}
