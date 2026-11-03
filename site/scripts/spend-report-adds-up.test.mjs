import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { newLedger } from './autowriter-ledger.mjs';
import { itemsOf, proseOf, tablesOf } from './fixtures/markdown-sections.mjs';
import {
  GENERATED_AT,
  attemptedLedger,
  discardedLedger,
  escalatedLedger,
  filesOf,
  ledgerOf,
  mergedLedger,
  recordOf,
  repairCall,
  repairedRecord,
  stoppedLedger,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { monthLine, reportMarkdown } from './spend-report-text.mjs';
import { spendMessage } from './spend-slack.mjs';
import { microOf, recordMicro, recordRepairMicro, spendItemsOf, totalBreakdown } from './spend-sum.mjs';

const CEILING = 25_000_000;
const NO_LINKS = { run: null, pullRequest: null, entries: {} };
const ROWS = [
  'Writing calls of entries',
  'Repair calls',
  'Runs that ended with no entry',
  'Spend with no generation record',
  'Everything paid for',
];

const DRAFT = writingCall({ input: 12000, output: 3000, tag: 'draft' });
const CORRECTION = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });
const TERM = writingCall({ input: 4000, output: 1000, tag: 'term' });
const CLOSED = writingCall({ input: 9000, output: 2500, tag: 'closed' });
const attempt = (recordedAt, costUsd) => ({ recordedAt, costUsd });

const post = recordOf({ slug: 'a-post', at: '2026-11-02T07:00:00.000Z', calls: [DRAFT, CORRECTION] });
const repairedPost = repairedRecord(post, [repairCall()]);
const term = recordOf({
  slug: 'a-term',
  format: 'term',
  at: '2026-11-02T07:05:00.000Z',
  ledgerSlug: 'a-post',
  calls: [TERM],
});
const old = recordOf({ slug: 'old-post', at: '2026-10-28T10:00:00.000Z', runId: 'run-0', calls: [DRAFT] });
const gone = recordOf({
  slug: 'gone-post',
  ledgerSlug: 'gone-ledger',
  at: '2026-11-02T07:30:00.000Z',
  runId: 'run-9',
  calls: [DRAFT],
});

const postLedger = attemptedLedger(
  ledgerOf({ slug: 'a-post', calls: [...post.calls, ...term.calls] }),
  attempt('2026-11-02T09:00:00.000Z', 0.015),
  attempt('2026-11-02T11:00:00.000Z', 0.03)
);
const oldLedger = ledgerOf({ slug: 'old-post', runId: 'run-0', calls: old.calls });
const lostLedger = escalatedLedger(
  attemptedLedger(
    ledgerOf({ slug: 'lost-post', runId: 'run-2', calls: [DRAFT] }),
    attempt('2026-11-02T10:00:00.000Z', 0.5)
  )
);
const stoppedPost = stoppedLedger(ledgerOf({ slug: 'stopped-post', runId: 'run-3', calls: [DRAFT] }));
const closedLedger = discardedLedger(ledgerOf({ slug: 'closed-post', runId: 'run-4', calls: [CLOSED] }));
const orphanLedger = mergedLedger(ledgerOf({ slug: 'orphan-post', runId: 'run-5', calls: [DRAFT] }));
const openOrphan = ledgerOf({ slug: 'open-orphan', runId: 'run-6', calls: [TERM] });
const attemptsOnly = mergedLedger(
  attemptedLedger(
    newLedger({ slug: 'attempts-only', runId: 'run-7', pullRequest: null }),
    attempt('2026-11-02T12:00:00.000Z', 0.2)
  )
);
const freshClaim = newLedger({ slug: 'fresh-claim', runId: 'run-8', pullRequest: null });

const LEDGERS = [
  postLedger,
  oldLedger,
  lostLedger,
  stoppedPost,
  closedLedger,
  orphanLedger,
  openOrphan,
  attemptsOnly,
  freshClaim,
];
const RECORDS = [repairedPost, term, old, gone];
const ENDED = [lostLedger, stoppedPost, closedLedger];
const UNMATCHED = [orphanLedger, openOrphan, attemptsOnly];

const corpus = corpusOf(filesOf({ ledgers: LEDGERS, records: RECORDS }));
const modelAt = (at = GENERATED_AT) => reportModel(corpus, { at });
const model = modelAt();
const markdown = reportMarkdown(model);

const ledgerMicro = (ledger) =>
  microOf(ledger.generation?.costUsd ?? 0) + ledger.attempts.reduce((sum, { costUsd }) => sum + microOf(costUsd), 0);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const microText = (text) => Math.round(Number(text) * 1_000_000);
const rowsOf = (table) => Object.fromEntries(table.rows.map(([label, cost]) => [label, microText(cost)]));
const [monthTable] = tablesOf(markdown, 'This month');
const [, allTimeTable] = tablesOf(markdown, 'All time');

test('the corpus is read without a single problem, so every figure below is of files that count', () => {
  assert.deepEqual(corpus.problems, []);
  assert.equal(corpus.ledgers.length, LEDGERS.length);
  assert.equal(corpus.records.length, RECORDS.length);
});

test('all time: the four rows are the four kinds of paid call, and they add up to what every ledger and record shows', () => {
  const everything = sum(LEDGERS.map(ledgerMicro)) + recordMicro(gone) + recordRepairMicro(gone);
  assert.equal(everything, 969_500);
  assert.deepEqual(model.paidAllTime, {
    writingMicro: 113_000,
    repairMicro: 45_000,
    endedMicro: 575_500,
    unmatchedMicro: 236_000,
    totalMicro: everything,
  });
});

test('this month: the same four rows over the month, with an entry of October and an undated ledger told apart', () => {
  assert.deepEqual(model.thisMonth.paid, {
    writingMicro: 86_000,
    repairMicro: 45_000,
    endedMicro: 575_500,
    unmatchedMicro: 236_000,
    totalMicro: 942_500,
  });
  const october = modelAt('2026-10-31T23:59:59.000Z').thisMonth.paid;
  assert.deepEqual([october.writingMicro, october.unmatchedMicro, october.totalMicro], [27_000, 9_000, 36_000]);
});

test('each ledger is in exactly one total: a ledger with a record in writing or repair, one without it in ended or unmatched', () => {
  for (const ledger of LEDGERS) {
    const records = RECORDS.filter(({ ledger: path }) => path.endsWith(`/${ledger.slug}.json`));
    const parts = totalBreakdown({ ledgers: spendItemsOf({ ledgers: [ledger], records }) });
    assert.equal(parts.totalMicro, ledgerMicro(ledger), ledger.slug);
    const named = [parts.writingMicro + parts.repairMicro, parts.endedMicro, parts.unmatchedMicro].filter(Boolean);
    assert.ok(named.length <= 1, `${ledger.slug} is in more than one total: ${JSON.stringify(parts)}`);
    if (records.length > 0) assert.equal(parts.endedMicro + parts.unmatchedMicro, 0, ledger.slug);
  }
});

test('a verdict that ended the run puts the spend of a ledger with no record in ended, and open or merged in unmatched', () => {
  for (const ledger of ENDED)
    assert.equal(
      totalBreakdown({ ledgers: spendItemsOf({ ledgers: [ledger], records: [] }) }).endedMicro,
      ledgerMicro(ledger)
    );
  for (const ledger of UNMATCHED)
    assert.equal(
      totalBreakdown({ ledgers: spendItemsOf({ ledgers: [ledger], records: [] }) }).unmatchedMicro,
      ledgerMicro(ledger)
    );
});

test('the paid tables of the file have the five rows, and the four rows add up to the last, in the month and in all time', () => {
  for (const table of [monthTable, allTimeTable]) {
    assert.deepEqual(table.header, ['What was paid for', 'Cost (USD)']);
    assert.deepEqual(
      table.rows.map(([label]) => label),
      ROWS
    );
    const rows = rowsOf(table);
    assert.equal(rows[ROWS[0]] + rows[ROWS[1]] + rows[ROWS[2]] + rows[ROWS[3]], rows[ROWS[4]]);
  }
  assert.deepEqual(rowsOf(allTimeTable), {
    [ROWS[0]]: 113_000,
    [ROWS[1]]: 45_000,
    [ROWS[2]]: 575_500,
    [ROWS[3]]: 236_000,
    [ROWS[4]]: 969_500,
  });
});

test('the month sentence names the figure of the paid table, so the sentence and the table cannot disagree', () => {
  assert.ok(
    proseOf(markdown, 'This month').startsWith(
      monthLine({ month: '2026-11', spentMicro: 942_500, ceilingMicro: CEILING })
    ),
    proseOf(markdown, 'This month')
  );
  assert.equal(rowsOf(monthTable)[ROWS[4]], 942_500);
});

test('the Notes total is the row of runs that ended with no entry, and it is the cost of exactly the ledgers the notes list', () => {
  const notes = itemsOf(markdown, 'Notes');
  assert.equal(notes.length, ENDED.length);
  for (const ledger of ENDED)
    assert.equal(notes.filter((line) => line.startsWith(`- ${ledger.slug}: `)).length, 1, ledger.slug);
  assert.match(proseOf(markdown, 'Notes'), /together cost 0\.5755 USD\./);
  assert.equal(sum(ENDED.map(ledgerMicro)), rowsOf(allTimeTable)[ROWS[2]]);
  assert.match(proseOf(markdown, 'Notes'), /count it under Runs that ended with no entry\./);
});

test('a warned ledger is counted: the warnings name each ledger no record names, and their cost is the row of the paid table', () => {
  const unmatched = itemsOf(markdown, 'Warnings').filter((line) =>
    line.includes('no generation record names this ledger')
  );
  assert.equal(unmatched.length, UNMATCHED.length);
  for (const ledger of UNMATCHED)
    assert.equal(unmatched.filter((line) => line.startsWith(`- ${ledger.slug}: `)).length, 1, ledger.slug);
  assert.equal(sum(UNMATCHED.map(ledgerMicro)), rowsOf(allTimeTable)[ROWS[3]]);
  assert.match(
    proseOf(markdown, 'Warnings'),
    /The ledgers below that no generation record names are counted in the paid tables, under Spend with no generation record: 0\.236 USD together\./
  );
});

test('a ledger that spent and has no record is listed once, under Notes or Warnings, and a ledger that spent nothing in neither', () => {
  const listed = [...itemsOf(markdown, 'Notes'), ...itemsOf(markdown, 'Warnings')];
  for (const ledger of [...ENDED, ...UNMATCHED]) {
    assert.equal(listed.filter((line) => line.startsWith(`- ${ledger.slug}: `)).length, 1, ledger.slug);
  }
  assert.equal(listed.filter((line) => line.includes('fresh-claim')).length, 0);
  assert.equal(ledgerMicro(freshClaim), 0);
});

test('a note and a warning state the whole spend of their ledger: the generation and the repair attempts', () => {
  const lines = [...itemsOf(markdown, 'Notes'), ...itemsOf(markdown, 'Warnings')];
  const of = (slug) => lines.find((line) => line.startsWith(`- ${slug}: `));
  assert.match(
    of('lost-post'),
    /its ledger records 0\.027 USD for the generation and 0\.5 USD for repair attempts, and the monthly spend ceiling counts that cost$/
  );
  assert.match(
    of('stopped-post'),
    /its ledger records 0\.027 USD for the generation, and the monthly spend ceiling counts that cost$/
  );
  assert.match(
    of('orphan-post'),
    /its ledger records a generation of 0\.027 USD \(verdict: merged\) but no generation record names this ledger/
  );
  assert.match(
    of('attempts-only'),
    /its ledger records repair attempts of 0\.2 USD \(verdict: merged\) but no generation record names this ledger/
  );
});

test('the message ends its all-time lines with the five figures, the four kinds and their sum, in its text and its table', () => {
  const rows = model.rows.filter(({ slug }) => slug === 'a-post');
  const status = { month: '2026-11', spentMicro: 942_500, ceilingUsd: CEILING / 1_000_000 };
  const { blocks, text } = spendMessage({ model, rows, status, links: NO_LINKS });
  const allTime = text.split('\n\n').find((chunk) => chunk.startsWith('All time'));
  assert.equal(
    allTime.split('\n').at(-1),
    'Everything paid for: 0.9695 USD, of which writing calls 0.113 USD, repair calls 0.045 USD, runs that ended with no entry 0.5755 USD and spend with no generation record 0.236 USD.'
  );
  const paid = blocks.find((block) => block.text?.text.startsWith('*Everything paid for*'));
  assert.match(
    paid.text.text,
    /^\*Everything paid for\*\n```\n +USD\nWriting calls +0\.113\nRepair calls +0\.045\nEnded with no entry +0\.5755\nNo generation record +0\.236\nEverything paid for +0\.9695\n```$/
  );
});

test('a corpus with no warned ledger has nothing under spend with no generation record, and then Warnings says nothing of it', () => {
  const calm = reportModel(corpusOf(filesOf({ ledgers: [postLedger, lostLedger], records: [repairedPost, term] })), {
    at: GENERATED_AT,
  });
  assert.equal(calm.paidAllTime.unmatchedMicro, 0);
  assert.deepEqual(calm.warnings, []);
  assert.doesNotMatch(reportMarkdown(calm), /## Warnings/);
});

test('spend with no generation record is never silent: whenever it is above zero there is a warning that names the ledger', () => {
  for (const ledger of UNMATCHED) {
    const alone = reportModel(corpusOf(filesOf({ ledgers: [ledger], records: [] })), { at: GENERATED_AT });
    assert.equal(alone.paidAllTime.unmatchedMicro, ledgerMicro(ledger), ledger.slug);
    assert.equal(alone.warnings.length, 1, ledger.slug);
    assert.ok(alone.warnings[0].startsWith(`${ledger.slug}: `), alone.warnings[0]);
  }
});
