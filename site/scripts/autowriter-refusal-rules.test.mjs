import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REFUSED_PATHS, refusalFor, sealSignature } from './autowriter-refusals.mjs';
import { judgeCommit, pipelineCommits, skippedLine } from './autowriter-refusal-rules.mjs';
import { BOT_EMAIL } from './pr-classify.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const SHA12 = '0123456789ab';
const CLAIMED_AT = '2026-11-01T07:00:00.000Z';
const RECORD = recordPath('generation', 'first-post', CLAIMED_AT);
const SECOND_RECORD = recordPath('generation', 'second-post', CLAIMED_AT);
const BAND = 'audits/sentence-band.json';
const DISPOSITION = `${recordDirectory('disposition')}/main.json`;
const PIPELINE_REASON = 'The text of this target changed in the run in which the unattended writer added /blog/x.';

const REFUSED = [
  ['sentence-band', BAND],
  ['lighthouse-record', 'audits/lighthouse-green.json'],
  ['lighthouse-stamp', 'audits/phase-7/lh-measured.json'],
  ['lighthouse-report', 'audits/phase-7/lh-mobile/lhr-0.json'],
];

const change = (path, before = null, after = null) => ({ path, before, after });
const entry = (digest, extra = {}) => ({
  target: 'src/data/post/a.md',
  location: 'frontmatter.title',
  status: 'verified',
  reason: 'Read on 2026-10-08.',
  digest,
  ...extra,
});
const listing = (...entries) => `${JSON.stringify(entries, null, 2)}\n`;
const judged = ({ records = [RECORD], changes = [], texts = {} }) =>
  judgeCommit({ sha: SHA, records, changes: [...records.map((path) => change(path)), ...changes] }, (id) => texts[id]);
const sealed = (before, after) =>
  judged({ changes: [change(DISPOSITION, 'old', 'new')], texts: { old: before, new: after } });

test('the refusal list and the ids this file proves are the same list, so a new refusal cannot enter without a test', () => {
  assert.deepEqual(
    REFUSED.map(([id]) => id),
    REFUSED_PATHS.map(({ id }) => id)
  );
  for (const [id, path] of REFUSED) assert.equal(refusalFor(path)?.id, id, path);
});

for (const [id, path] of REFUSED) {
  test(`a commit that touched ${path} is found once, naming the record, the path, ${id}, why and the commit`, () => {
    const detail = `touched ${path} (${id}: ${refusalFor(path).why}), in commit ${SHA12}`;
    assert.deepEqual(judged({ changes: [change(path)] }), [{ rule: 'refused-path-committed', path: RECORD, detail }]);
  });
}

test('the commit comes last in a finding, so the text before it is a stable prefix for a smoke token', () => {
  const found = judged({ changes: [change(BAND)] });
  assert.equal(found.length, 1);
  const { detail } = found[0];
  assert.ok(detail.startsWith(`touched ${BAND} (sentence-band: `), detail);
  assert.ok(detail.endsWith(`, in commit ${SHA12}`), detail);
  assert.equal(detail.indexOf(SHA12), detail.length - SHA12.length);
});

test('a commit that touched nothing on the refusal list is clean, near misses included', () => {
  const near = ['site/src/data/post/x.md', `${BAND}.bak`, 'audits/phase-7/lh-measured.txt', 'audits/lh-mobile/a.json'];
  assert.deepEqual(judged({ changes: near.map((path) => change(path)) }), []);
  assert.deepEqual(judged({ records: [] }), []);
});

test('two records in one commit are two findings for each refused path, one per record', () => {
  const changes = [change('audits/lighthouse-green.json'), change(BAND)];
  const found = judged({ records: [RECORD, SECOND_RECORD], changes });
  assert.deepEqual(
    found.map(({ path, detail }) => [path, detail.split(' ')[1]]),
    [
      [RECORD, 'audits/lighthouse-green.json'],
      [RECORD, BAND],
      [SECOND_RECORD, 'audits/lighthouse-green.json'],
      [SECOND_RECORD, BAND],
    ]
  );
  assert.equal(new Set(found.map(({ rule }) => rule)).size, 1);
});

test('a digest that moved while the reason and the status stayed is a seal, named with its entry, its file and the commit', () => {
  const before = listing(entry('a'.repeat(12)));
  const after = listing(entry('b'.repeat(12)));
  const signature = sealSignature({ path: DISPOSITION, before, after });
  const named = `sealed src/data/post/a.md frontmatter.title in ${DISPOSITION}`;
  const detail = `${named} (${signature.id}: ${signature.why}), in commit ${SHA12}`;
  assert.deepEqual(sealed(before, after), [{ rule: 'disposition-seal-committed', path: RECORD, detail }]);
  assert.equal(signature.id, 'disposition-seal');
});

test('each sealed entry is named, and a seal is found for every record the commit changed', () => {
  const rows = [entry('a'.repeat(12)), entry('b'.repeat(12), { location: 'frontmatter.term' })];
  const moved = rows.map((row) => ({ ...row, digest: 'c'.repeat(12) }));
  const found = judged({
    records: [RECORD, SECOND_RECORD],
    changes: [change(DISPOSITION, 'old', 'new')],
    texts: { old: listing(...rows), new: listing(...moved) },
  });
  assert.equal(found.length, 2);
  const named = 'src/data/post/a.md frontmatter.title, src/data/post/a.md frontmatter.term';
  for (const { detail } of found) assert.ok(detail.startsWith(`sealed ${named} in ${DISPOSITION}`), detail);
});

test('a seal is found in a disposition file wherever it lies: flat, in its month and below it make three', () => {
  const texts = { old: listing(entry('a'.repeat(12))), new: listing(entry('b'.repeat(12))) };
  const placements = [
    DISPOSITION,
    recordPath('disposition', 'first-post', CLAIMED_AT),
    `${recordDirectory('disposition')}/2026/11/extra/generated-first-post.json`,
  ];
  const found = placements.flatMap((path) => judged({ changes: [change(path, 'old', 'new')], texts }));

  assert.equal(found.length, 3);
  assert.deepEqual(
    found.map(({ rule }) => rule),
    Array(3).fill('disposition-seal-committed')
  );
  placements.forEach((path, index) =>
    assert.ok(found[index].detail.includes(`sealed src/data/post/a.md frontmatter.title in ${path} (`), path)
  );
});

test('a restate that the pipeline wrote itself, with a reason of its own that it leaves as it was, is not a seal', () => {
  const before = listing(entry('a'.repeat(12), { reason: PIPELINE_REASON }));
  const after = listing(entry('b'.repeat(12), { reason: PIPELINE_REASON }));
  assert.deepEqual(sealed(before, after), []);
});

test('a disposition file that is new, deleted or only given a new reason is not a seal', () => {
  const rows = listing(entry('a'.repeat(12)));
  const reworded = listing(entry('a'.repeat(12), { reason: 'Read again on 2026-10-09.' }));
  const texts = { old: rows, new: rows, reworded };
  for (const [before, after] of [
    [null, 'new'],
    ['old', null],
    ['old', 'reworded'],
  ])
    assert.deepEqual(judged({ changes: [change(DISPOSITION, before, after)], texts }), [], `${before} ${after}`);
});

test('a disposition file that is not a list cannot be told from a seal, so the finding says the file changed', () => {
  const before = '{ not a list';
  const after = listing(entry('a'.repeat(12)));
  const signature = sealSignature({ path: DISPOSITION, before, after });
  const detail = `changed ${DISPOSITION} (${signature.id}: ${signature.why}), in commit ${SHA12}`;
  assert.deepEqual(sealed(before, after), [{ rule: 'disposition-seal-committed', path: RECORD, detail }]);
  assert.equal(signature.id, 'disposition-unreadable');
});

test('a refused path and a seal in one commit are both found, in the order the commit lists its files', () => {
  const texts = { old: listing(entry('a'.repeat(12))), new: listing(entry('b'.repeat(12))) };
  const seal = change(DISPOSITION, 'old', 'new');
  const band = change(BAND);
  const rulesOf = (changes) => judged({ changes, texts }).map(({ rule }) => rule);
  assert.deepEqual(rulesOf([seal, band]), ['disposition-seal-committed', 'refused-path-committed']);
  assert.deepEqual(rulesOf([band, seal]), ['refused-path-committed', 'disposition-seal-committed']);
});

test('the line a skipped history prints says which rules were skipped and why', () => {
  assert.equal(skippedLine('the clone is shallow'), 'autowriter: history rules skipped: the clone is shallow');
});

const raw = (...paths) =>
  paths.map((path) => `:000000 100644 ${'0'.repeat(40)} ${'a'.repeat(40)} A\0${path}\0`).join('');

test('a Provenance line is found whatever line ending the message carries', () => {
  const log = `${SHA}\0owner@example.test\0feat(x): y\r\n\r\nProvenance: ${RECORD}\r\n\0`;
  const git = (args) => (args.includes('log') ? log : raw(RECORD));
  assert.deepEqual(
    pipelineCommits(git).map(({ sha, records }) => [sha, records]),
    [[SHA, [RECORD]]]
  );
});

test('a generation record is a record at any depth: flat, in its month and below it make three of seven changes', () => {
  const directory = recordDirectory('generation');
  const records = [`${directory}/third-post.json`, RECORD, `${directory}/2026/11/extra/fourth-post.json`];
  const others = [
    `${directory}/2026/11/notes.md`,
    recordPath('claim', 'first-post', CLAIMED_AT),
    recordPath('ledger', 'first-post', CLAIMED_AT),
    BAND,
  ];
  const git = (args) => (args.includes('log') ? `${SHA}\0${BOT_EMAIL}\0feat(x): y\0` : raw(...records, ...others));
  const [commit, ...later] = pipelineCommits(git);

  assert.equal(later.length, 0);
  assert.deepEqual(commit.records, records);
  assert.equal(commit.records.length, 3);
  assert.deepEqual(
    judgeCommit(commit, () => '').map(({ path }) => path),
    records
  );
});

test('output that is not a whole number of commits is refused, never read as an empty history', () => {
  assert.throws(() => pipelineCommits(() => `${SHA}\0owner@example.test\0`), /git log/);
});
