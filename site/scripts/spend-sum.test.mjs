import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { monthOf, monthlySpend } from './spend-ceiling.mjs';
import {
  chooseVersions,
  monthlyBreakdown,
  recordMicro,
  spendItemsOf,
  spendWarnings,
  totalBreakdown,
} from './spend-sum.mjs';

const attempt = (recordedAt, costUsd) => ({ recordedAt, costUsd });
const ledgerOf = ({ slug = 'a-post', generation, attempts = [], decidedAt = null, spendUsd = 0, state = 'open' }) => ({
  slug,
  attempts,
  ...(generation === undefined ? {} : { generation: { costUsd: generation } }),
  spend: { costUsd: spendUsd },
  verdict: { decidedAt, state },
});
const recordOf = (generatedAt, costUsd = 0) => ({
  generatedAt,
  calls: [{ role: 'draft', costUsd }],
  totals: { costUsd },
});
const spent = (ledgers, month) => monthlySpend({ ledgers, month });

test('the month is the calendar month in UTC, the first seven characters of the instant', () => {
  assert.equal(monthOf('2026-10-31T23:59:59Z'), '2026-10');
  assert.equal(monthOf('2026-11-01T00:00:00Z'), '2026-11');
  assert.equal(monthOf('2026-12-31T23:59:59.999Z'), '2026-12');
  assert.equal(monthOf('2027-01-01T00:00:00.000Z'), '2027-01');
  assert.equal(monthOf(new Date('2026-11-01T00:00:00.000Z')), '2026-11');
});

test('the leap day of 2028 is in February and the next second is in March', () => {
  assert.equal(monthOf('2028-02-29T23:59:59Z'), '2028-02');
  assert.equal(monthOf('2028-03-01T00:00:00Z'), '2028-03');
});

test('an instant that is not UTC, or not an instant, is refused instead of read in a local zone', () => {
  for (const bad of [
    '2026-11-01T01:00:00+02:00',
    '2026-11-01',
    '2026-13-01T00:00:00Z',
    'yesterday',
    '',
    202611,
    null,
  ]) {
    assert.throws(() => monthOf(bad), /instant/, String(bad));
  }
  assert.throws(() => monthOf(new Date('nope')), /instant/);
});

test('only the attempts and the generation are summed, never the ledger spend total', () => {
  const ledger = ledgerOf({
    generation: 2,
    attempts: [attempt('2026-11-02T01:00:00Z', 1), attempt('2026-11-02T02:00:00Z', 0.5)],
    spendUsd: 3.5,
    decidedAt: '2026-11-02T03:00:00Z',
  });
  assert.equal(spent([{ ledger, record: null }], '2026-11'), 3_500_000);
  assert.equal(spent([{ ledger: { ...ledger, spend: { costUsd: 99 } }, record: null }], '2026-11'), 3_500_000);
});

test('an attempt belongs to the month of its own recordedAt, so one ledger can straddle a month boundary', () => {
  const ledger = ledgerOf({
    attempts: [attempt('2026-10-31T23:59:59Z', 1), attempt('2026-11-01T00:00:00Z', 2)],
  });
  assert.equal(spent([{ ledger, record: null }], '2026-10'), 1_000_000);
  assert.equal(spent([{ ledger, record: null }], '2026-11'), 2_000_000);
});

test('a boundary at the end of a year and on a leap day splits the attempts the same way', () => {
  const year = ledgerOf({ attempts: [attempt('2026-12-31T23:59:59Z', 1), attempt('2027-01-01T00:00:00Z', 2)] });
  assert.equal(spent([{ ledger: year, record: null }], '2026-12'), 1_000_000);
  assert.equal(spent([{ ledger: year, record: null }], '2027-01'), 2_000_000);
  const leap = ledgerOf({ attempts: [attempt('2028-02-29T23:59:59Z', 3), attempt('2028-03-01T00:00:00Z', 4)] });
  assert.equal(spent([{ ledger: leap, record: null }], '2028-02'), 3_000_000);
  assert.equal(spent([{ ledger: leap, record: null }], '2028-03'), 4_000_000);
});

test('the generation belongs to the month of its generation record, apart from the attempts', () => {
  const ledger = ledgerOf({ generation: 2, attempts: [attempt('2026-11-01T00:00:01Z', 1)] });
  const record = recordOf('2026-10-31T23:59:59.000Z', 2);
  assert.equal(spent([{ ledger, record }], '2026-10'), 2_000_000);
  assert.equal(spent([{ ledger, record }], '2026-11'), 1_000_000);
});

test('without a record the generation takes the month of the verdict decision, as a stopped write leaves it', () => {
  const ledger = ledgerOf({ generation: 2, decidedAt: '2026-10-31T23:59:59Z' });
  assert.equal(spent([{ ledger, record: null }], '2026-10'), 2_000_000);
  assert.equal(spent([{ ledger, record: null }], '2026-11'), 0);
});

test('a generation with no record and no decision cannot be placed, so it counts against the month under test', () => {
  const ledger = ledgerOf({ generation: 2 });
  assert.equal(spent([{ ledger, record: null }], '2026-11'), 2_000_000);
  assert.equal(spent([{ ledger, record: null }], '2026-10'), 2_000_000);
});

test('a ledger with no generation sums its attempts only', () => {
  const ledger = ledgerOf({ attempts: [attempt('2026-11-05T00:00:00Z', 0.25)] });
  assert.equal(spent([{ ledger, record: null }], '2026-11'), 250_000);
});

test('amounts are added as integer micro-dollars, so ten tenths make exactly one dollar', () => {
  const tenths = Array.from({ length: 10 }, (_, at) => attempt(`2026-11-0${at}T00:00:00Z`.replace('-00', '-01'), 0.1));
  assert.equal(spent([{ ledger: ledgerOf({ attempts: tenths }), record: null }], '2026-11'), 1_000_000);
  const pair = ledgerOf({ attempts: [attempt('2026-11-01T00:00:00Z', 0.1), attempt('2026-11-01T00:00:01Z', 0.2)] });
  assert.equal(spent([{ ledger: pair, record: null }], '2026-11'), 300_000);
});

test('the spend of several ledgers is added', () => {
  const first = ledgerOf({ slug: 'first-post', attempts: [attempt('2026-11-02T00:00:00Z', 1)] });
  const second = ledgerOf({ slug: 'second-post', generation: 2, decidedAt: '2026-11-03T00:00:00Z' });
  assert.equal(
    spent(
      [
        { ledger: first, record: null },
        { ledger: second, record: null },
      ],
      '2026-11'
    ),
    3_000_000
  );
});

test('a record that costs more than its ledger generation is counted at the record cost', () => {
  const ledger = ledgerOf({ generation: 1 });
  assert.equal(spent([{ ledger, record: recordOf('2026-11-02T00:00:00Z', 1.5) }], '2026-11'), 1_500_000);
  assert.equal(spent([{ ledger: ledgerOf({}), record: recordOf('2026-11-02T00:00:00Z', 1.5) }], '2026-11'), 1_500_000);
});

test('a record that costs less than its ledger generation is the normal case of a run that wrote terms too', () => {
  const ledger = ledgerOf({ generation: 2 });
  const record = recordOf('2026-11-02T00:00:00Z', 1.5);
  assert.equal(spent([{ ledger, record }], '2026-11'), 2_000_000);
  assert.deepEqual(spendWarnings({ ledgers: [{ ledger, record }] }), []);
});

test('a ledger that under-counts its own record is named in a warning, one line per disagreement', () => {
  const short = {
    ledger: ledgerOf({ slug: 'short-post', generation: 1 }),
    record: recordOf('2026-11-02T00:00:00Z', 1.5),
  };
  const none = { ledger: ledgerOf({ slug: 'none-post' }), record: recordOf('2026-11-02T00:00:00Z', 0.5) };
  const fine = { ledger: ledgerOf({ slug: 'fine-post', generation: 1 }), record: recordOf('2026-11-02T00:00:00Z', 1) };
  const warnings = spendWarnings({ ledgers: [short, none, fine] });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /short-post/);
  assert.match(warnings[1], /none-post/);
});

const version = (source, slug, spendUsd, record = null) => ({ source, ledger: ledgerOf({ slug, spendUsd }), record });

test('one slug on main and on a branch is one ledger, the version with the largest spend, never both', () => {
  const chosen = chooseVersions([
    version('working tree', 'one-post', 1),
    version('refs/heads/autowriter/one-post', 'one-post', 3),
  ]);
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].ledger.spend.costUsd, 3);
  const reversed = chooseVersions([
    version('refs/heads/autowriter/one-post', 'one-post', 3),
    version('working tree', 'one-post', 1),
  ]);
  assert.equal(reversed[0].ledger.spend.costUsd, 3);
});

test('dedupe compares micro-dollars and keeps the first version when two are equal', () => {
  const chosen = chooseVersions([
    version('working tree', 'tie-post', 1.0000001),
    version('refs/heads/x', 'tie-post', 1),
  ]);
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].source, 'working tree');
});

test('dedupe keeps one ledger per slug and returns them in slug order', () => {
  const chosen = chooseVersions([
    version('working tree', 'b-post', 1),
    version('working tree', 'a-post', 1),
    version('refs/heads/autowriter/c-post', 'c-post', 1),
    version('refs/heads/autowriter/a-post', 'a-post', 2),
  ]);
  assert.deepEqual(
    chosen.map(({ ledger }) => [ledger.slug, ledger.spend.costUsd]),
    [
      ['a-post', 2],
      ['b-post', 1],
      ['c-post', 1],
    ]
  );
});

test('the record of the chosen version is kept, and another source supplies one when the chosen version has none', () => {
  const own = recordOf('2026-11-01T00:00:00.000Z', 1);
  const other = recordOf('2026-11-02T00:00:00.000Z', 1);
  const withOwn = chooseVersions([
    version('working tree', 'r-post', 1, other),
    version('refs/heads/x', 'r-post', 2, own),
  ]);
  assert.equal(withOwn[0].record, own);
  const without = chooseVersions([
    version('working tree', 'r-post', 1, other),
    version('refs/heads/x', 'r-post', 2, null),
  ]);
  assert.equal(without[0].record, other);
});

const call = (role, costUsd) => ({ role, costUsd });
const repairedRecord = (generatedAt) => {
  const calls = [call('draft', 1), call('correction', 0.5), call('repair', 2), call('repair-correction', 0.25)];
  return { generatedAt, calls, totals: { costUsd: 3.75 } };
};

test('a repaired record is not counted twice: the writing calls match the ledger generation and the repair sits in the attempts', () => {
  const ledger = ledgerOf({
    generation: 1.5,
    attempts: [attempt('2026-11-04T00:00:00Z', 2.25)],
    spendUsd: 3.75,
  });
  const item = { ledger, record: repairedRecord('2026-11-02T00:00:00.000Z') };
  assert.equal(spent([item], '2026-11'), 3_750_000);
  assert.deepEqual(spendWarnings({ ledgers: [item] }), []);
});

test('only the writing calls of a record are compared with the ledger generation, and its repair calls with the attempts', () => {
  const item = {
    ledger: ledgerOf({
      slug: 'cheap-post',
      generation: 1,
      attempts: [attempt('2026-11-04T00:00:00Z', 2.25)],
    }),
    record: repairedRecord('2026-11-02T00:00:00.000Z'),
  };
  const warnings = spendWarnings({ ledgers: [item] });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /cheap-post/);
  assert.match(warnings[0], /writing calls/);
  assert.equal(spent([item], '2026-11'), 3_750_000);
});

const gone = (calls, generatedAt = '2026-11-02T00:00:00.000Z') => ({
  slug: 'lost-post',
  ledger: 'audits/autowriter/2026/11/lost-post.json',
  generatedAt,
  calls,
  totals: { costUsd: 0 },
});

test('a record whose ledger is gone is counted at its own cost, writing and repair, in the month it was generated', () => {
  const record = gone([call('draft', 1), call('repair', 0.5)]);
  assert.equal(spent([{ ledger: null, record }], '2026-11'), 1_500_000);
  assert.equal(spent([{ ledger: null, record }], '2026-10'), 0);
});

test('a record whose ledger is gone is named in a warning, once', () => {
  const record = gone([call('draft', 1)]);
  assert.deepEqual(spendWarnings({ ledgers: [{ ledger: null, record }] }), [
    'lost-post: its generation record names the ledger audits/autowriter/2026/11/lost-post.json, which does not exist, so its cost is counted from the record alone',
  ]);
});

test('repair calls that a record shows and its ledger attempts do not cover are counted in the month of the generation, and warned', () => {
  const ledger = ledgerOf({
    slug: 'short-post',
    generation: 1.5,
    attempts: [attempt('2026-11-04T00:00:00Z', 1)],
    spendUsd: 2.5,
  });
  const item = { ledger, record: repairedRecord('2026-10-31T23:00:00.000Z') };
  assert.equal(spent([item], '2026-10'), 2_750_000);
  assert.equal(spent([item], '2026-11'), 1_000_000);
  assert.deepEqual(spendWarnings({ ledgers: [item] }), [
    "short-post: its generation record's repair calls cost 2.25 USD but its ledger records 1 USD for its attempts, so the record cost is counted",
  ]);
});

test('attempts that a ledger records and its record lacks are the spend of a repair that failed: counted, and never a warning', () => {
  const ledger = ledgerOf({
    slug: 'failed-post',
    generation: 1.5,
    attempts: [attempt('2026-11-04T00:00:00Z', 2.25), attempt('2026-11-05T00:00:00Z', 0.75)],
    spendUsd: 4.5,
  });
  const item = { ledger, record: repairedRecord('2026-11-02T00:00:00.000Z') };
  assert.equal(spent([item], '2026-11'), 4_500_000);
  assert.deepEqual(spendWarnings({ ledgers: [item] }), []);
});

test('the month splits into writing, repair, runs that ended with no entry and ledgers with no record, and the parts add up to the ceiling figure', () => {
  const carried = {
    ledger: ledgerOf({
      slug: 'a-post',
      generation: 1.5,
      attempts: [attempt('2026-11-04T00:00:00Z', 2.25)],
      spendUsd: 3.75,
    }),
    record: repairedRecord('2026-11-02T00:00:00.000Z'),
  };
  const ended = {
    ledger: ledgerOf({
      slug: 'lost-post',
      generation: 0.5,
      attempts: [attempt('2026-11-06T00:00:00Z', 0.25)],
      decidedAt: '2026-11-06T01:00:00Z',
      spendUsd: 0.75,
      state: 'stopped',
    }),
    record: null,
  };
  const parts = monthlyBreakdown({ ledgers: [carried, ended], month: '2026-11' });
  assert.deepEqual(parts, {
    writingMicro: 1_500_000,
    repairMicro: 2_250_000,
    endedMicro: 750_000,
    unmatchedMicro: 0,
    totalMicro: 4_500_000,
  });
  assert.equal(parts.totalMicro, spent([carried, ended], '2026-11'));
});

test('a ledger with no record is a run that ended or a ledger with no record by its verdict alone, and each kind has its own figure', () => {
  const alone = (state, slug, generation) => ({ ledger: ledgerOf({ slug, generation, state }), record: null });
  const ledgers = [
    alone('stopped', 'stopped-post', 0.5),
    alone('escalated', 'escalated-post', 0.25),
    alone('discarded', 'discarded-post', 0.125),
    alone('open', 'open-post', 0.0625),
    alone('merged', 'merged-post', 0.03125),
  ];
  assert.deepEqual(totalBreakdown({ ledgers }), {
    writingMicro: 0,
    repairMicro: 0,
    endedMicro: 875_000,
    unmatchedMicro: 93_750,
    totalMicro: 968_750,
  });
  for (const [state, kind] of [
    ['stopped', 'endedMicro'],
    ['escalated', 'endedMicro'],
    ['discarded', 'endedMicro'],
    ['open', 'unmatchedMicro'],
    ['merged', 'unmatchedMicro'],
  ]) {
    const parts = totalBreakdown({ ledgers: [alone(state, 'one', 1)] });
    assert.equal(parts[kind], 1_000_000, `${state} belongs in ${kind}`);
    assert.equal(parts.totalMicro, 1_000_000, state);
  }
});

test('a ledger that has a record is never ended or unmatched, whatever its verdict', () => {
  const record = recordOf('2026-11-02T00:00:00.000Z', 1);
  for (const state of ['stopped', 'escalated', 'discarded', 'open', 'merged']) {
    const item = { ledger: ledgerOf({ generation: 1, state }), record };
    assert.deepEqual(totalBreakdown({ ledgers: [item] }), {
      writingMicro: 1_000_000,
      repairMicro: 0,
      endedMicro: 0,
      unmatchedMicro: 0,
      totalMicro: 1_000_000,
    });
  }
});

test('a record whose ledger is gone is a carried entry in the breakdown, since the report counts it as one', () => {
  const record = gone([call('draft', 1), call('repair', 0.5)]);
  assert.deepEqual(monthlyBreakdown({ ledgers: [{ ledger: null, record }], month: '2026-11' }), {
    writingMicro: 1_000_000,
    repairMicro: 500_000,
    endedMicro: 0,
    unmatchedMicro: 0,
    totalMicro: 1_500_000,
  });
});

const filedAs = (slug) => `audits/autowriter/2026/11/${slug}.json`;
const entryOf = (slug, ledgerSlug, costUsd) => ({
  slug,
  ledger: filedAs(ledgerSlug),
  generatedAt: '2026-11-02T00:00:00.000Z',
  calls: [call('draft', costUsd)],
  totals: { costUsd },
});

test('spendItemsOf pairs a record with the ledger it names, so the term of a run joins its run, and a record whose ledger is gone stands alone', () => {
  const run = ledgerOf({ slug: 'run-post', generation: 1.5 });
  const article = entryOf('run-post', 'run-post', 1);
  const term = entryOf('run-term', 'run-post', 0.5);
  const stray = entryOf('stray-post', 'gone-post', 2);
  const items = spendItemsOf({ ledgers: [run], records: [article, term, stray] });
  assert.equal(items.length, 2);
  assert.equal(items[0].ledger, run);
  assert.deepEqual(
    items[0].record.calls.map(({ costUsd }) => costUsd),
    [1, 0.5]
  );
  assert.equal(items[1].ledger, null);
  assert.equal(items[1].record, stray);
});

test('spendItemsOf gives a ledger with no record a null record, and nothing at all for nothing', () => {
  const alone = ledgerOf({ slug: 'alone-post', generation: 1 });
  assert.deepEqual(spendItemsOf({ ledgers: [alone], records: [] }), [{ ledger: alone, record: null }]);
  assert.deepEqual(spendItemsOf({ ledgers: [], records: [] }), []);
});

test('the whole of the spend is the same split over every month, and a spend with no date counts in it and in every month', () => {
  const dated = {
    ledger: ledgerOf({
      slug: 'a-post',
      generation: 1,
      attempts: [attempt('2026-12-04T00:00:00Z', 0.5)],
      spendUsd: 1.5,
    }),
    record: recordOf('2026-11-02T00:00:00.000Z', 1),
  };
  const undated = { ledger: ledgerOf({ slug: 'old-post', generation: 0.25, spendUsd: 0.25 }), record: null };
  assert.deepEqual(totalBreakdown({ ledgers: [dated, undated] }), {
    writingMicro: 1_000_000,
    repairMicro: 500_000,
    endedMicro: 0,
    unmatchedMicro: 250_000,
    totalMicro: 1_750_000,
  });
  assert.equal(monthlyBreakdown({ ledgers: [dated, undated], month: '2026-10' }).totalMicro, 250_000);
  assert.equal(monthlyBreakdown({ ledgers: [dated, undated], month: '2026-12' }).totalMicro, 750_000);
});

const categoryRecord = (generatedAt = '2026-11-02T00:00:00.000Z') => ({
  generatedAt,
  calls: [call('topic', 0.25), call('draft', 1), call('correction', 0.5)],
  totals: { costUsd: 1.75 },
});

test('the proposal call of a category entry is an entry cost: a record counts it with the draft and the correction', () => {
  assert.equal(recordMicro(categoryRecord()), 1_750_000);
  assert.equal(recordMicro({ calls: [call('topic', 0.25)] }), 250_000);
  assert.equal(recordMicro({ calls: [call('draft', 1), call('correction', 0.5)] }), 1_500_000);
});

test('the monthly ceiling counts the proposal call of a record whose ledger is gone, in the month of the record', () => {
  const record = { ...categoryRecord(), slug: 'lost-post', ledger: 'audits/autowriter/2026/11/lost-post.json' };
  assert.equal(spent([{ ledger: null, record }], '2026-11'), 1_750_000);
  assert.equal(spent([{ ledger: null, record }], '2026-10'), 0);
});

test('a ledger that carries the proposal and the draft agrees with its record: the cost is counted once and nothing is warned', () => {
  const item = { ledger: ledgerOf({ slug: 'cat-post', generation: 1.75, spendUsd: 1.75 }), record: categoryRecord() };
  assert.equal(spent([item], '2026-11'), 1_750_000);
  assert.deepEqual(spendWarnings({ ledgers: [item] }), []);
});

test('a ledger that forgot the proposal call is named in a warning, and the cost of the record is the one counted', () => {
  const item = { ledger: ledgerOf({ slug: 'cat-post', generation: 1.5, spendUsd: 1.5 }), record: categoryRecord() };
  const warnings = spendWarnings({ ledgers: [item] });
  assert.equal(warnings.length, 1);
  assert.match(
    warnings[0],
    /cat-post: its generation record's writing calls cost 1\.75 USD but its ledger records 1\.5 USD/
  );
  assert.equal(spent([item], '2026-11'), 1_750_000);
});
