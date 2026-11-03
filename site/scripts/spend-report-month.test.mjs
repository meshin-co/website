import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { spendReportFindings } from './autowriter-spend-rules.mjs';
import { newLedger } from './autowriter-ledger.mjs';
import {
  GENERATED_AT,
  REVISION,
  attemptedLedger,
  discardedLedger,
  escalatedLedger,
  filesOf,
  ledgerOf,
  mergedLedger,
  recordOf,
  repairCall,
  repairedRecord,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { headingsOf, itemsOf, proseOf, tablesOf } from './fixtures/markdown-sections.mjs';
import { ledgerWithGeneration } from './generation-record.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { monthLine, reportMarkdown, reportText, slackMessage, stampedAt } from './spend-report-text.mjs';

const CEILING = 25_000_000;
const NEWEST = '2026-11-02T07:00:00.000Z';
const OCTOBER = '2026-10-30T10:00:00.000Z';
const REPAIR_AT = '2026-11-02T09:00:00.000Z';

const DRAFT = writingCall({ input: 12000, output: 3000, tag: 'draft' });
const CORRECTION = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });

const plainPost = recordOf({ slug: 'a-post', at: NEWEST, calls: [DRAFT, CORRECTION] });
const repairedPost = repairedRecord(plainPost, [repairCall()]);
const postLedger = attemptedLedger(ledgerOf({ slug: 'a-post', calls: plainPost.calls }), {
  recordedAt: REPAIR_AT,
  costUsd: 0.015,
});
const lostLedger = escalatedLedger(ledgerOf({ slug: 'lost-post', calls: [DRAFT] }));
const oldPost = recordOf({ slug: 'old-post', at: OCTOBER, runId: 'run-0', calls: [DRAFT] });
const oldLedger = ledgerOf({ slug: 'old-post', runId: 'run-0', calls: oldPost.calls });

const modelAt = (parts, at = GENERATED_AT) => reportModel(corpusOf(filesOf(parts)), { at });
const NOVEMBER = { ledgers: [postLedger, lostLedger], records: [repairedPost] };
const BOTH_MONTHS = { ledgers: [postLedger, lostLedger, oldLedger], records: [repairedPost, oldPost] };
const NOVEMBER_LINE = monthLine({ month: '2026-11', spentMicro: 92_000, ceilingMicro: CEILING });

test('the month line says what was spent this month, the ceiling and what is left, in one sentence', () => {
  assert.equal(
    monthLine({ month: '2026-11', spentMicro: 92_000, ceilingMicro: CEILING }),
    '2026-11 so far: 0.092 USD spent of the 25.00 USD monthly ceiling, 24.908 USD left.'
  );
});

test('with nothing spent the month line says so in numbers and not in silence', () => {
  assert.equal(
    monthLine({ month: '2026-12', spentMicro: 0, ceilingMicro: CEILING }),
    '2026-12 so far: 0.00 USD spent of the 25.00 USD monthly ceiling, 25.00 USD left.'
  );
});

test('at the ceiling and over it the month line says none is left and that the writer does not run', () => {
  const stopped = ' none left: the ceiling is reached, so the writer does not run for the rest of the month.';
  assert.equal(
    monthLine({ month: '2026-11', spentMicro: CEILING, ceilingMicro: CEILING }),
    '2026-11 so far: 25.00 USD spent of the 25.00 USD monthly ceiling,' + stopped
  );
  assert.equal(
    monthLine({ month: '2026-11', spentMicro: 25_030_000, ceilingMicro: CEILING }),
    '2026-11 so far: 25.03 USD spent of the 25.00 USD monthly ceiling,' + stopped
  );
});

test('one micro-dollar under the ceiling is not reached, and the line names the one micro-dollar left', () => {
  assert.equal(
    monthLine({ month: '2026-11', spentMicro: CEILING - 1, ceilingMicro: CEILING }),
    '2026-11 so far: 24.999999 USD spent of the 25.00 USD monthly ceiling, 0.000001 USD left.'
  );
});

test('a month that is not a UTC year and month, or an amount that is not whole micro-dollars, is refused', () => {
  for (const month of ['2026-1', '2026-13', 'November', '', undefined])
    assert.throws(() => monthLine({ month, spentMicro: 0, ceilingMicro: CEILING }), /month/, String(month));
  for (const spentMicro of [0.5, -1, '5', Number.NaN, undefined])
    assert.throws(() => monthLine({ month: '2026-11', spentMicro, ceilingMicro: CEILING }), /micro-dollars/);
});

test('the model names the month from the instant it is given and splits what that month paid for four ways', () => {
  assert.deepEqual(modelAt(NOVEMBER).thisMonth, {
    month: '2026-11',
    at: GENERATED_AT,
    ceilingMicro: CEILING,
    paid: { writingMicro: 50_000, repairMicro: 15_000, endedMicro: 27_000, unmatchedMicro: 0, totalMicro: 92_000 },
  });
});

test('the clock decides the month: the same records read at the last second of October and the first of November', () => {
  const october = modelAt(BOTH_MONTHS, '2026-10-31T23:59:59.000Z').thisMonth;
  const november = modelAt(BOTH_MONTHS, '2026-11-01T00:00:00.000Z').thisMonth;
  assert.deepEqual([october.month, october.paid.totalMicro], ['2026-10', 27_000]);
  assert.deepEqual([november.month, november.paid.totalMicro], ['2026-11', 92_000]);
});

test('a model with no instant, or with one that is not a UTC instant, is refused and never reads the clock', () => {
  const corpus = corpusOf(filesOf({}));
  assert.throws(() => reportModel(corpus), /not a UTC instant/);
  assert.throws(() => reportModel(corpus, {}), /not a UTC instant/);
  assert.throws(() => reportModel(corpus, { at: '2026-11-03' }), /not a UTC instant/);
});

test('a month that has spent exactly the ceiling has paid exactly the ceiling', () => {
  const big = recordOf({
    slug: 'big-post',
    at: NEWEST,
    calls: [writingCall({ input: 25_000_000, output: 0, tag: 'big' })],
  });
  const model = modelAt({ ledgers: [ledgerOf({ slug: 'big-post', calls: big.calls })], records: [big] });
  assert.equal(model.thisMonth.paid.totalMicro, model.thisMonth.ceilingMicro);
});

test('all time splits the same way over every month', () => {
  assert.deepEqual(modelAt(BOTH_MONTHS).paidAllTime, {
    writingMicro: 77_000,
    repairMicro: 15_000,
    endedMicro: 27_000,
    unmatchedMicro: 0,
    totalMicro: 119_000,
  });
});

test('an entry row carries the cost of the repair calls its own record holds, beside what its writing calls cost', () => {
  const { rows } = modelAt({ ledgers: [postLedger, oldLedger], records: [repairedPost, oldPost] });
  assert.deepEqual(
    rows.map(({ slug, micro, repairMicro }) => [slug, micro, repairMicro]),
    [
      ['a-post', 50_000, 15_000],
      ['old-post', 27_000, 0],
    ]
  );
});

test('a warned ledger is counted in its own row, beside the noted runs, and both are in the month', () => {
  const orphan = mergedLedger(ledgerOf({ slug: 'orphan-post', calls: [DRAFT] }));
  const model = modelAt({ ledgers: [postLedger, lostLedger, orphan], records: [repairedPost] });
  assert.equal(model.notes.length, 1);
  assert.equal(model.warnings.length, 1);
  assert.equal(model.thisMonth.paid.endedMicro, 27_000);
  assert.equal(model.thisMonth.paid.unmatchedMicro, 27_000);
  assert.equal(model.thisMonth.paid.totalMicro, 119_000);
});

test('with nothing recorded the month is still named and has paid for nothing', () => {
  const model = modelAt({});
  const nothing = { writingMicro: 0, repairMicro: 0, endedMicro: 0, unmatchedMicro: 0, totalMicro: 0 };
  assert.deepEqual(model.thisMonth, { month: '2026-11', at: GENERATED_AT, ceilingMicro: CEILING, paid: nothing });
  assert.deepEqual(model.paidAllTime, nothing);
});

test('with only a discarded attempt there is no entry and the month has still paid for it', () => {
  const model = modelAt({ ledgers: [discardedLedger(ledgerOf({ slug: 'lost-post', calls: [DRAFT] }))] });
  assert.equal(model.empty, true);
  assert.equal(model.thisMonth.paid.endedMicro, 27_000);
  assert.equal(model.thisMonth.paid.totalMicro, 27_000);
});

test('the file opens with the month section, and the explanation of the file follows it under its own heading', () => {
  const markdown = reportMarkdown(modelAt(NOVEMBER));
  assert.deepEqual(headingsOf(markdown), [
    'This month',
    'About this file',
    'This entry',
    'Last 30 days',
    'All time',
    'Every entry',
    'Rates',
    'Notes',
  ]);
  assert.ok(proseOf(markdown, 'This month').startsWith(NOVEMBER_LINE), proseOf(markdown, 'This month'));
  assert.ok(markdown.indexOf('## This month') < markdown.indexOf('This file is written by'));
});

test('the first lines of the stamped file are the title, the two stamps, the month heading and the month sentence', () => {
  const lines = reportText(filesOf(NOVEMBER), REVISION, GENERATED_AT).split('\n');
  assert.deepEqual(lines.slice(0, 8), [
    '# Spend report: what writing each entry cost',
    '',
    `Generated-from: ${REVISION}`,
    `Generated-at: ${GENERATED_AT}`,
    '',
    '## This month',
    '',
    NOVEMBER_LINE,
  ]);
});

test('the explanation keeps the definitions the tables need: what Cost and Repair mean and that each call is in one row', () => {
  const prose = proseOf(reportMarkdown(modelAt(NOVEMBER)), 'About this file');
  assert.match(prose, /^This file is written by `npm run audit:spend`/);
  assert.match(prose, /Cost means the cost of the writing calls of an entry/);
  assert.match(prose, /each call is in exactly one row/);
  assert.match(prose, /The four rows add up to the last row\.$/);
});

test('the month section says whose month it is, what the figure counts and what the ceiling job counts besides', () => {
  const prose = proseOf(reportMarkdown(modelAt(NOVEMBER)), 'This month');
  assert.match(prose, /the UTC calendar month of 2026-11-03T09:00:00\.000Z, the instant stamped in Generated-at/);
  assert.match(prose, /It counts the ledgers and records committed in this repository/);
  assert.match(prose, /The ceiling job also counts the spend on branches that are not merged yet/);
});

test('the month section totals every call: writing, repair, runs that ended with no entry and spend with no record', () => {
  const [paid, ...rest] = tablesOf(reportMarkdown(modelAt(NOVEMBER)), 'This month');
  assert.deepEqual(rest, []);
  assert.deepEqual(paid.header, ['What was paid for', 'Cost (USD)']);
  assert.deepEqual(paid.rows, [
    ['Writing calls of entries', '0.05'],
    ['Repair calls', '0.015'],
    ['Runs that ended with no entry', '0.027'],
    ['Spend with no generation record', '0.00'],
    ['Everything paid for', '0.092'],
  ]);
});

test('all time shows both: the entries by their writing calls, then everything paid for, labelled', () => {
  const markdown = reportMarkdown(modelAt(BOTH_MONTHS));
  const [entries, paid, ...rest] = tablesOf(markdown, 'All time');
  assert.deepEqual(rest, []);
  assert.deepEqual(entries.rows[0], ['all', '2', '37,000', '8,000', '0.077']);
  assert.deepEqual(paid.header, ['What was paid for', 'Cost (USD)']);
  assert.deepEqual(paid.rows, [
    ['Writing calls of entries', '0.077'],
    ['Repair calls', '0.015'],
    ['Runs that ended with no entry', '0.027'],
    ['Spend with no generation record', '0.00'],
    ['Everything paid for', '0.119'],
  ]);
  assert.match(proseOf(markdown, 'All time'), /counts the writing calls of entries only/);
});

test('an entry row shows its repair cost beside its writing cost, in the newest run and in every entry', () => {
  const markdown = reportMarkdown(modelAt(BOTH_MONTHS));
  const header = ['Generated (UTC)', 'Format', 'Slug', 'Input tokens', 'Output tokens', 'Cost (USD)', 'Repair (USD)'];
  const [newest] = tablesOf(markdown, 'This entry');
  assert.deepEqual(newest.header, header);
  assert.deepEqual(newest.rows, [[NEWEST, 'article', 'a-post', '25,000', '5,000', '0.05', '0.015']]);
  const [every] = tablesOf(markdown, 'Every entry');
  assert.deepEqual(every.header, header);
  assert.deepEqual(every.rows, [
    [NEWEST, 'article', 'a-post', '25,000', '5,000', '0.05', '0.015'],
    [OCTOBER, 'article', 'old-post', '12,000', '3,000', '0.027', '0.00'],
  ]);
});

test('the notes name what the noted runs cost together and where that spend is counted', () => {
  const notes = proseOf(reportMarkdown(modelAt(NOVEMBER)), 'Notes');
  assert.equal(
    notes,
    'These runs ended with no entry and together cost 0.027 USD. That spend is in no entry row; the paid tables count it under Runs that ended with no entry. A note is not a warning: nothing a person does can clear it, because a run that ended will never gain a record.'
  );
  assert.equal(itemsOf(reportMarkdown(modelAt(NOVEMBER)), 'Notes').length, 1);
});

test('the file with no entry still opens with the month and says it has no entry', () => {
  const markdown = reportMarkdown(
    modelAt({ ledgers: [discardedLedger(ledgerOf({ slug: 'lost-post', calls: [DRAFT] }))] })
  );
  assert.deepEqual(headingsOf(markdown), ['This month', 'About this file', 'No entry yet', 'Notes']);
  assert.ok(
    proseOf(markdown, 'This month').startsWith(
      monthLine({ month: '2026-11', spentMicro: 27_000, ceilingMicro: CEILING })
    )
  );
  assert.match(
    proseOf(markdown, 'No entry yet'),
    /^No generation record could be counted, so this file holds no entry row/
  );
});

test('the file stamps the instant it was written, right after the commit it was generated from, and reads it back', () => {
  const text = reportText(filesOf(NOVEMBER), REVISION, GENERATED_AT);
  const lines = text.split('\n');
  assert.equal(lines[2], `Generated-from: ${REVISION}`);
  assert.equal(lines[3], `Generated-at: ${GENERATED_AT}`);
  assert.equal(stampedAt(text), GENERATED_AT);
  assert.equal(stampedAt('# a file with no stamp\n'), undefined);
});

test('the same records and the same stamp give the same file, and another instant gives another file', () => {
  const files = filesOf(NOVEMBER);
  assert.equal(reportText(files, REVISION, GENERATED_AT), reportText(files, REVISION, GENERATED_AT));
  assert.notEqual(reportText(files, REVISION, GENERATED_AT), reportText(files, REVISION, '2026-11-04T09:00:00.000Z'));
});

test('a file is never written without an instant', () => {
  assert.throws(() => reportText(filesOf(NOVEMBER), REVISION), /not a UTC instant/);
});

test('the introduction says the file reads the clock once and stamps it, not that it reads none', () => {
  const markdown = reportMarkdown(modelAt(NOVEMBER));
  assert.doesNotMatch(markdown, /It reads no clock/);
  assert.match(
    markdown,
    /It reads no network\. It reads the clock once, when it is written, and stamps that instant in Generated-at/
  );
});

const messageFor = (parts, line = NOVEMBER_LINE) => {
  const model = modelAt(parts);
  return slackMessage(model, model.newestRun, line);
};

test('the message carries the month line the file carries, word for word, between this entry and the windows', () => {
  const blocks = messageFor(NOVEMBER).split('\n\n');
  assert.equal(blocks[1], NOVEMBER_LINE);
  assert.ok(blocks[0].startsWith('This entry'));
  assert.ok(blocks[2].startsWith('Last 30 days'));
  assert.ok(reportMarkdown(modelAt(NOVEMBER)).includes(NOVEMBER_LINE));
});

test('the message names everything paid for after the all-time figures, labelled', () => {
  const blocks = messageFor(BOTH_MONTHS).split('\n\n');
  assert.equal(
    blocks[3].split('\n').at(-1),
    'Everything paid for: 0.119 USD, of which writing calls 0.077 USD, repair calls 0.015 USD, runs that ended with no entry 0.027 USD and spend with no generation record 0.00 USD.'
  );
});

test('the message needs the month line and refuses to go without one', () => {
  const model = modelAt(NOVEMBER);
  assert.throws(() => slackMessage(model, model.newestRun), /month line/);
  assert.throws(() => slackMessage(model, model.newestRun, ''), /month line/);
});

test('with no warning the message says what zero means: every ledger agrees with its record, and nothing about runs', () => {
  const lines = messageFor(NOVEMBER).split('\n\n').at(-1).split('\n');
  assert.deepEqual(lines, [
    'Warnings: 0 (every ledger agrees with its generation record; this does not say that every run produced an entry)',
  ]);
});

test('with a warning the message counts it, says a person has something to do, and carries it', () => {
  const low = ledgerWithGeneration(newLedger({ slug: 'a-post', runId: 'run-1', pullRequest: null }), {
    tokens: { input: 1, output: 1 },
    costUsd: 0.001,
  });
  const lines = messageFor({ ledgers: [low], records: [plainPost] })
    .split('\n\n')
    .at(-1)
    .split('\n');
  assert.deepEqual(lines, [
    'Warnings: 1 (each needs a person to look at it)',
    "a-post: its generation record's writing calls cost 0.05 USD but its ledger records 0.001 USD for the generation, so the record cost is counted",
  ]);
});

const FILES = filesOf(NOVEMBER);
const COMMITTED = reportText(FILES, REVISION, GENERATED_AT);
const findingsFor = (committed, files = FILES) => spendReportFindings({ ...files, committed });

test('the gate regenerates with the instant the file is stamped with, so a file written days ago still matches its records', () => {
  assert.deepEqual(findingsFor(COMMITTED), []);
  assert.deepEqual(findingsFor(reportText(FILES, REVISION, '2026-11-20T09:00:00.000Z')), []);
});

test('a file that lost its Generated-at line is reported, and the finding names the line', () => {
  const [found, ...rest] = findingsFor(COMMITTED.replace(/^Generated-at: .*\n/m, ''));
  assert.deepEqual(rest, []);
  assert.equal(found.rule, 'spend-report-differs');
  assert.match(found.detail, /Generated-at/);
});

test('a month figure edited by hand is reported', () => {
  const [found] = findingsFor(COMMITTED.replace('0.092 USD spent', '0.001 USD spent'));
  assert.equal(found.rule, 'spend-report-differs');
  assert.match(found.detail, /0\.001 USD spent/);
});

test('a ledger that moved without the file moving is reported: the repair that was not regenerated', () => {
  const moved = attemptedLedger(postLedger, { recordedAt: '2026-11-02T10:00:00.000Z', costUsd: 0.5 });
  const [found, ...rest] = findingsFor(COMMITTED, filesOf({ ledgers: [moved, lostLedger], records: [repairedPost] }));
  assert.deepEqual(rest, []);
  assert.equal(found.rule, 'spend-report-differs');
});
