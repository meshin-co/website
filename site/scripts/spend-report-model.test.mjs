import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ledgerWithAttempt, newLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { callOf, modelCheck } from './fixtures/generation-input.mjs';
import {
  GENERATED_AT,
  MODEL,
  asText,
  filesOf,
  ledgerOf,
  ledgerPath,
  mergedLedger,
  recordOf,
  recordPath,
  stoppedLedger,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { ledgerWithGeneration, recordAfterRepair, validateRecord } from './generation-record.mjs';
import { WINDOW_DAYS, corpusOf, reportModel } from './spend-report-model.mjs';
import { monthlySpend, recordMicro, spendWarnings } from './spend-sum.mjs';
import { costUsd } from './writer-cost.mjs';

const NEWEST = '2026-11-02T07:00:00.000Z';
const modelOf = (parts) => reportModel(corpusOf(filesOf(parts)), { at: GENERATED_AT });

const DRAFT = writingCall({ input: 12000, output: 3000, tag: 'draft' });
const CORRECTION = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });
const TERM_DRAFT = writingCall({ input: 6000, output: 1200, tag: 'term' });

function postAndTerm({ at = NEWEST, runId = 'run-1', slug = 'a-post', termSlug = 'a-term' } = {}) {
  const post = recordOf({ slug, at, runId, calls: [DRAFT, CORRECTION] });
  const termAt = new Date(Date.parse(at) + 1000).toISOString();
  const term = recordOf({ slug: termSlug, format: 'term', at: termAt, runId, ledgerSlug: slug, calls: [TERM_DRAFT] });
  const ledger = ledgerOf({ slug, runId, calls: [...post.calls, ...term.calls] });
  return { post, term, ledger };
}

function soleArticle(slug = 'a-post', at = NEWEST) {
  const post = recordOf({ slug, at, calls: [DRAFT, CORRECTION] });
  return { post, ledger: ledgerOf({ slug, calls: post.calls }) };
}

const entryAt = (slug, at, runId = slug) => {
  const record = recordOf({ slug, at, runId, calls: [DRAFT] });
  return { record, ledger: ledgerOf({ slug, runId, calls: record.calls }) };
};

test('with no record the model is empty: no row, no window, no rate, no warning and no note', () => {
  assert.deepEqual(modelOf({}), {
    empty: true,
    rows: [],
    newestRun: [],
    thirtyDays: null,
    allTime: null,
    rates: [],
    warnings: [],
    notes: [],
    thisMonth: {
      month: '2026-11',
      at: GENERATED_AT,
      ceilingMicro: 25_000_000,
      paid: { writingMicro: 0, repairMicro: 0, endedMicro: 0, unmatchedMicro: 0, totalMicro: 0 },
    },
    paidAllTime: { writingMicro: 0, repairMicro: 0, endedMicro: 0, unmatchedMicro: 0, totalMicro: 0 },
  });
});

test('ledgers alone are no measurement: an open ledger and a ceiling notice leave the model empty and silent', () => {
  const open = newLedger({ slug: 'a-post', runId: 'run-1', pullRequest: null });
  const notice = newLedger({ slug: 'spend-ceiling-2026-11', runId: 'run-2', pullRequest: null });
  const model = modelOf({ ledgers: [open, notice] });
  assert.equal(model.empty, true);
  assert.deepEqual(model.warnings, []);
});

test('one article is one row whose figures are its writing calls, and every window holds exactly it', () => {
  const { post, ledger } = soleArticle();
  const model = modelOf({ ledgers: [ledger], records: [post] });
  const row = {
    slug: 'a-post',
    runId: 'run-1',
    format: 'article',
    generatedAt: NEWEST,
    input: 25000,
    output: 5000,
    micro: 50000,
    repairMicro: 0,
  };
  assert.equal(model.empty, false);
  assert.deepEqual(model.rows, [row]);
  assert.deepEqual(model.newestRun, [row]);
  const total = { entries: 1, input: 25000, output: 5000, micro: 50000 };
  for (const window of [model.thirtyDays, model.allTime]) {
    assert.deepEqual(window.totals.all, total);
    assert.deepEqual(window.totals.formats, [{ format: 'article', ...total }]);
  }
  assert.deepEqual(model.warnings, []);
});

test('a post and a term of one run are the newest run together, in the order they were written, and split by format', () => {
  const { post, term, ledger } = postAndTerm();
  const model = modelOf({ ledgers: [ledger], records: [term, post] });
  assert.deepEqual(
    model.rows.map(({ slug }) => slug),
    ['a-term', 'a-post']
  );
  assert.deepEqual(
    model.newestRun.map(({ slug }) => slug),
    ['a-post', 'a-term']
  );
  const { totals } = model.allTime;
  assert.deepEqual(totals.all, { entries: 2, input: 31000, output: 6200, micro: 62000 });
  assert.deepEqual(totals.formats, [
    { format: 'article', entries: 1, input: 25000, output: 5000, micro: 50000 },
    { format: 'term', entries: 1, input: 6000, output: 1200, micro: 12000 },
  ]);
});

test('the newest run is found by its run id, so an older run never leaks into this entry', () => {
  const older = postAndTerm({ at: '2026-11-01T07:00:00.000Z', runId: 'run-1', slug: 'old-post', termSlug: 'old-term' });
  const newer = soleArticle('new-post');
  const model = modelOf({
    ledgers: [older.ledger, { ...newer.ledger, runId: 'run-2' }],
    records: [older.post, older.term, { ...newer.post, runId: 'run-2' }],
  });
  assert.deepEqual(
    model.newestRun.map(({ slug }) => slug),
    ['new-post']
  );
  assert.equal(model.allTime.totals.all.entries, 3);
});

test('the thirty days are 30 x 24 hours back from the newest entry: the start is excluded, one millisecond later is in', () => {
  assert.equal(WINDOW_DAYS, 30);
  const entries = [
    entryAt('newest', NEWEST),
    entryAt('just-inside', '2026-10-03T07:00:00.001Z'),
    entryAt('exactly-on-the-start', '2026-10-03T07:00:00.000Z'),
    entryAt('long-ago', '2026-09-01T00:00:00.000Z'),
  ];
  const model = modelOf({ ledgers: entries.map(({ ledger }) => ledger), records: entries.map(({ record }) => record) });
  assert.equal(model.thirtyDays.after, '2026-10-03T07:00:00.000Z');
  assert.equal(model.thirtyDays.through, NEWEST);
  assert.equal(model.thirtyDays.totals.all.entries, 2);
  assert.equal(model.allTime.since, '2026-09-01T00:00:00.000Z');
  assert.equal(model.allTime.through, NEWEST);
  assert.equal(model.allTime.totals.all.entries, 4);
});

test('the windows end at the newest entry and never at the clock', (t) => {
  const { post, term, ledger } = postAndTerm();
  const parts = { ledgers: [ledger], records: [post, term] };
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2030-01-01T00:00:00Z') });
  const years_later = modelOf(parts);
  t.mock.timers.reset();
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2020-01-01T00:00:00Z') });
  const years_earlier = modelOf(parts);
  assert.deepEqual(years_later, years_earlier);
  assert.equal(years_later.thirtyDays.through, term.generatedAt);
});

test('the order the files arrive in changes nothing', () => {
  const first = postAndTerm({
    slug: 'first-post',
    termSlug: 'first-term',
    at: '2026-10-20T07:00:00.000Z',
    runId: 'run-1',
  });
  const second = postAndTerm({ slug: 'second-post', termSlug: 'second-term', runId: 'run-2' });
  const ledgers = [first.ledger, second.ledger];
  const records = [first.post, first.term, second.post, second.term];
  assert.deepEqual(
    modelOf({ ledgers: [...ledgers].reverse(), records: [...records].reverse() }),
    modelOf({ ledgers, records })
  );
});

test('costs are whole micro-dollars added exactly, so 0.1 and 0.2 make 0.30 and not 0.30000000000000004', () => {
  const dime = writingCall({ input: 100000, output: 0, tag: 'dime' });
  const two = writingCall({ role: 'correction', input: 200000, output: 0, tag: 'two-dimes' });
  const post = recordOf({ slug: 'a-post', at: NEWEST, calls: [dime, two] });
  const model = modelOf({ ledgers: [ledgerOf({ slug: 'a-post', calls: post.calls })], records: [post] });
  assert.equal(model.rows[0].micro, 300000);
});

test('an entry costs what the monthly ceiling counts for it, because both read the same function', () => {
  const { post, term, ledger } = postAndTerm();
  const model = modelOf({ ledgers: [ledger], records: [post, term] });
  assert.equal(model.rows.find(({ slug }) => slug === 'a-post').micro, recordMicro(post));
  assert.equal(model.rows.find(({ slug }) => slug === 'a-term').micro, recordMicro(term));
  const ceiling = monthlySpend({ ledgers: [{ ledger, record: post }], month: '2026-11' });
  assert.equal(model.allTime.totals.all.micro, ceiling);
});

const repairedOf = (post) =>
  recordAfterRepair({
    record: post,
    calls: [callOf('repair', { input: 9000, output: 4000 }, 'repair')],
    modelChecks: [modelCheck()],
    claimTable: post.claimTable,
    measured: post.band.measured,
    measuredOn: post.band.measuredOn,
    gates: post.gates,
  });

const REPAIR_ATTEMPT = {
  judgedCommit: 'a'.repeat(40),
  recordedAt: '2026-11-02T09:00:00.000Z',
  failingRule: 'banned-phrase',
  failingPath: 'site/src/data/post/a-post.md',
  tokens: { input: 9000, output: 4000 },
  costUsd: 0.029,
};

test('a repair adds calls to a record and its attempt to the ledger, and changes no cost of the report and no warning, only the repair figure of its row', () => {
  const { post, ledger } = soleArticle();
  const repaired = repairedOf(post);
  assert.deepEqual(validateRecord(repaired).map(describeProblem), []);
  assert.ok(repaired.totals.costUsd > post.totals.costUsd, 'the repair call was not added');
  const before = modelOf({ ledgers: [ledger], records: [post] });
  const after = modelOf({ ledgers: [ledgerWithAttempt(ledger, REPAIR_ATTEMPT)], records: [repaired] });
  assert.deepEqual(
    after.rows.map((row) => ({ ...row, repairMicro: 0 })),
    before.rows
  );
  assert.deepEqual([before.rows[0].repairMicro, after.rows[0].repairMicro], [0, 29000]);
  assert.deepEqual(after.thirtyDays, before.thirtyDays);
  assert.deepEqual(after.allTime, before.allTime);
  assert.deepEqual(after.warnings, []);
});

test('repair calls that no attempt of the ledger covers are a warning, because the record then shows spend the ledger lacks', () => {
  const { post, ledger } = soleArticle();
  const model = modelOf({ ledgers: [ledger], records: [repairedOf(post)] });
  assert.deepEqual(model.warnings, [
    "a-post: its generation record's repair calls cost 0.029 USD but its ledger records 0 USD for its attempts, so the record cost is counted",
  ]);
});

test('what happens to a ledger after the entry is written moves no figure: attempts, a merge and its measurement debt', () => {
  const { post, ledger } = soleArticle();
  const attempted = ledgerWithAttempt(ledger, {
    judgedCommit: 'a'.repeat(40),
    recordedAt: '2026-11-02T09:00:00.000Z',
    failingRule: 'banned-phrase',
    failingPath: 'site/src/data/post/a-post.md',
    tokens: { input: 9000, output: 4000 },
    costUsd: 0.029,
  });
  const before = modelOf({ ledgers: [ledger], records: [post] });
  const entryFigures = (model) => ({ ...model, thisMonth: null, paidAllTime: null });
  const after = modelOf({ ledgers: [attempted], records: [post] });
  assert.deepEqual(entryFigures(after), entryFigures(before));
  assert.equal(before.paidAllTime.repairMicro, 0);
  assert.equal(after.paidAllTime.repairMicro, 29000);
  assert.deepEqual(modelOf({ ledgers: [mergedLedger(attempted)], records: [post] }), after);
});

test('the rates section names the model and both rates once, with the entries they priced and when', () => {
  const { post, term, ledger } = postAndTerm();
  const { rates } = modelOf({ ledgers: [ledger], records: [post, term] });
  assert.deepEqual(rates, [
    {
      model: MODEL,
      inputPerMillion: 1,
      outputPerMillion: 5,
      entries: 2,
      first: post.generatedAt,
      last: term.generatedAt,
    },
  ]);
});

test('a rate change adds a second row, and the earlier entry keeps the cost it was written at', () => {
  const cheap = recordOf({ slug: 'cheap-post', at: '2026-10-01T07:00:00.000Z', calls: [DRAFT] });
  const dear = recordOf({
    slug: 'dear-post',
    at: NEWEST,
    calls: [
      writingCall({ input: 12000, output: 3000, price: { inputPerMillion: 2, outputPerMillion: 10 }, tag: 'dear' }),
    ],
  });
  const model = modelOf({
    ledgers: [ledgerOf({ slug: 'cheap-post', calls: cheap.calls }), ledgerOf({ slug: 'dear-post', calls: dear.calls })],
    records: [dear, cheap],
  });
  assert.deepEqual(
    model.rates.map(({ inputPerMillion, outputPerMillion, entries, first, last }) => [
      inputPerMillion,
      outputPerMillion,
      entries,
      first,
      last,
    ]),
    [
      [1, 5, 1, '2026-10-01T07:00:00.000Z', '2026-10-01T07:00:00.000Z'],
      [2, 10, 1, NEWEST, NEWEST],
    ]
  );
  assert.deepEqual(
    model.rows.map(({ slug, micro }) => [slug, micro]),
    [
      ['dear-post', 54000],
      ['cheap-post', 27000],
    ]
  );
});

test('a repair call at another rate adds no rate row, because no entry cost is computed from it', () => {
  const { post, ledger } = soleArticle();
  const price = { inputPerMillion: 3, outputPerMillion: 15 };
  const tokens = { input: 9000, output: 4000 };
  const repair = { ...callOf('repair', tokens, 'dear-repair'), price, costUsd: costUsd(price, tokens) };
  const repaired = recordAfterRepair({
    record: post,
    calls: [repair],
    modelChecks: [modelCheck()],
    claimTable: post.claimTable,
    measured: post.band.measured,
    measuredOn: post.band.measuredOn,
    gates: post.gates,
  });
  assert.equal(modelOf({ ledgers: [ledger], records: [repaired] }).rates.length, 1);
});

test('a ledger that records less generation than its records cost is reported in the sentence spendWarnings already writes', () => {
  const { post } = soleArticle();
  const low = ledgerWithGeneration(newLedger({ slug: 'a-post', runId: 'run-1', pullRequest: null }), {
    tokens: { input: 1, output: 1 },
    costUsd: 0.001,
  });
  const model = modelOf({ ledgers: [low], records: [post] });
  const expected = spendWarnings({ ledgers: [{ ledger: low, record: post }] });
  assert.equal(expected.length, 1);
  assert.deepEqual(model.warnings, expected);
  assert.equal(model.allTime.totals.all.micro, 50000, 'the entries are still counted');
});

test('the check covers the whole run: a ledger that forgot the term is reported although its post alone fits', () => {
  const { post, term } = postAndTerm();
  const postOnly = ledgerOf({ slug: 'a-post', calls: post.calls });
  assert.deepEqual(spendWarnings({ ledgers: [{ ledger: postOnly, record: post }] }), []);
  const { warnings } = modelOf({ ledgers: [postOnly], records: [post, term] });
  assert.equal(warnings.length, 1);
  assert.match(
    warnings[0],
    /^a-post: its generation record's writing calls cost 0\.062 USD but its ledger records 0\.05 USD/
  );
});

test('a skipped draft is no disagreement: the ledger may record more generation than the records that shipped', () => {
  const { post, term } = postAndTerm();
  const wider = ledgerOf({ slug: 'a-post', calls: [...post.calls, ...term.calls] });
  assert.deepEqual(modelOf({ ledgers: [wider], records: [post] }).warnings, []);
});

test('a ledger that records a generation no record names says so while its verdict is open or merged, and counts no entry for it', () => {
  const { post } = soleArticle();
  const written = ledgerOf({ slug: 'a-post', calls: post.calls });
  for (const [state, ledger] of [
    ['open', written],
    ['merged', mergedLedger(written)],
  ]) {
    const model = modelOf({ ledgers: [ledger], records: [] });
    assert.deepEqual(
      model.warnings,
      [
        `a-post: its ledger records a generation of 0.05 USD (verdict: ${state}) but no generation record names this ledger, so no entry is counted for it`,
      ],
      state
    );
    assert.equal(model.empty, true, state);
  }
});

test('a run that stopped before it published an entry is no warning, because no entry was ever meant to exist', () => {
  const { post } = soleArticle();
  const stopped = stoppedLedger(ledgerOf({ slug: 'a-post', calls: post.calls }));
  assert.deepEqual(modelOf({ ledgers: [stopped] }).warnings, []);
});

test('a ledger with no generation and no record is a claim, not a missing record', () => {
  const claim = newLedger({ slug: 'a-post', runId: 'run-1', pullRequest: null });
  assert.deepEqual(modelOf({ ledgers: [claim] }).warnings, []);
});

test('a record whose ledger is not in the repository says so and is still counted', () => {
  const { post } = soleArticle();
  const model = modelOf({ records: [post] });
  assert.deepEqual(model.warnings, [
    `a-post: its generation record names the ledger ${ledgerPath('a-post')}, which does not exist, so the spend of its run is not checked against a ledger`,
  ]);
  assert.equal(model.allTime.totals.all.entries, 1);
});

test('a file that cannot be read is named and left out, and every readable file is still counted', () => {
  const { post, ledger } = soleArticle();
  const files = filesOf({ ledgers: [ledger], records: [post] });
  files.records.push({ path: recordPath('broken'), text: '{not json' });
  files.records.push({
    path: recordPath('off-schema'),
    text: asText({ ...recordOf({ slug: 'off-schema', at: NEWEST }), schema: 2 }),
  });
  files.records.push({ path: recordPath('wrong-name'), text: asText(recordOf({ slug: 'another-name', at: NEWEST })) });
  files.ledgers.push({ path: ledgerPath('broken-ledger'), text: '[]' });
  const corpus = corpusOf(files);
  assert.deepEqual(
    corpus.records.map(({ slug }) => slug),
    ['a-post']
  );
  assert.deepEqual(
    corpus.ledgers.map(({ slug }) => slug),
    ['a-post']
  );
  assert.equal(corpus.problems.length, 4);
  assert.ok(corpus.problems.every((sentence) => / is not counted: /.test(sentence)));
  assert.ok(
    corpus.problems.some((sentence) =>
      sentence.startsWith(`${recordPath('broken')} is not counted: it is not readable JSON`)
    )
  );
  assert.ok(corpus.problems.some((sentence) => sentence.includes('schema')));
  assert.ok(corpus.problems.some((sentence) => sentence.includes('does not match the file name')));
  const model = reportModel(corpus, { at: GENERATED_AT });
  assert.equal(model.allTime.totals.all.entries, 1);
  assert.deepEqual(model.warnings.slice(0, 4), corpus.problems);
});

test('the sentence for an unreadable file holds nothing that depends on the JSON parser of this Node version', () => {
  const { problems } = corpusOf({ ledgers: [], records: [{ path: recordPath('broken'), text: '{not json' }] });
  assert.deepEqual(problems, [`${recordPath('broken')} is not counted: it is not readable JSON`]);
});

const TOPIC = writingCall({ role: 'topic', input: 1800, output: 60, tag: 'topic' });

function categoryEntry(slug = 'a-category-post') {
  const record = recordOf({ slug, at: NEWEST, calls: [TOPIC, DRAFT, CORRECTION] });
  return { record, ledger: ledgerOf({ slug, calls: record.calls }) };
}

test('the proposal call of a category entry is in its row, its window and its month, at the cost its record stores', () => {
  const { record, ledger } = categoryEntry();
  const model = modelOf({ ledgers: [ledger], records: [record] });
  const cost = { entries: 1, input: 26800, output: 5060, micro: 52_100 };
  assert.deepEqual(model.rows[0], {
    slug: 'a-category-post',
    runId: 'run-1',
    format: 'article',
    generatedAt: NEWEST,
    input: cost.input,
    output: cost.output,
    micro: cost.micro,
    repairMicro: 0,
  });
  assert.equal(recordMicro(record), 52_100);
  assert.deepEqual(model.allTime.totals.all, cost);
  assert.equal(model.thisMonth.paid.writingMicro, 52_100);
  assert.equal(model.thisMonth.paid.totalMicro, 52_100);
  assert.deepEqual(model.warnings, []);
});

test('a ledger that forgot the proposal call is warned about, and the month still counts the record cost', () => {
  const { record } = categoryEntry();
  const draftsOnly = ledgerOf({ slug: 'a-category-post', calls: [DRAFT, CORRECTION] });
  const model = modelOf({ ledgers: [draftsOnly], records: [record] });
  assert.equal(model.warnings.length, 1);
  assert.match(model.warnings[0], /^a-category-post: its generation record's writing calls cost 0\.0521 USD/);
  assert.equal(model.thisMonth.paid.totalMicro, 52_100);
});

test('the price of the proposal call is a rate of the report, like the price of a draft', () => {
  const cheaper = writingCall({
    role: 'topic',
    input: 1800,
    output: 60,
    price: { inputPerMillion: 0.5, outputPerMillion: 2 },
  });
  const record = recordOf({ slug: 'a-category-post', at: NEWEST, calls: [cheaper, DRAFT, CORRECTION] });
  const ledger = ledgerOf({ slug: 'a-category-post', calls: record.calls });
  const { rates } = modelOf({ ledgers: [ledger], records: [record] });
  assert.deepEqual(
    rates.map(({ inputPerMillion, outputPerMillion }) => [inputPerMillion, outputPerMillion]),
    [
      [0.5, 2],
      [1, 5],
    ]
  );
});
