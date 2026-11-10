import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readEngineConfig } from './engine-config.mjs';
import { withProvenance } from './evidence-gate.mjs';
import { renderKeywords } from './keyword-demand-render.mjs';
import { buildKeywords } from './keyword-demand-rows.mjs';
import { MAX_AGE_DAYS, keywordFindings, summaryLine } from './keyword-demand-gate.mjs';

const TODAY = '2026-11-08';
const ROUTES = [{ route: '/glossary/shadow-ai', query: 'shadow ai', title: 'What is shadow AI?' }];
const week = (day, exact, broad) => ({ day, exact, broad });
const STATS = [
  { phrase: 'what is shadow ai', weeks: [week('2026-10-31', 960, 1100)] },
  { phrase: 'shadow ai risks', weeks: [week('2026-10-31', 70, 75)] },
];

const reportMeasured = (measured) =>
  withProvenance(
    renderKeywords(
      buildKeywords({ measured, market: { country: 'us', language: 'en-US' }, stats: STATS, routes: ROUTES })
    ),
    'abc1234'
  );

const findingsFor = (report) => keywordFindings({ report, today: TODAY });

test('a report measured today with a phrase table has no finding', () => {
  assert.deepEqual(findingsFor(reportMeasured(TODAY)), []);
});

test('a report older than the limit is stale and says how old it is', () => {
  assert.deepEqual(findingsFor(reportMeasured('2026-09-01')), [
    {
      rule: 'report-stale',
      path: 'audits/keyword-demand.md',
      detail: 'measured 2026-09-01; refresh with npm run audit:keywords (68 days old, limit 35)',
    },
  ]);
});

test('the limit is the last day that passes: the limit passes and one day more fails', () => {
  assert.deepEqual(findingsFor(reportMeasured('2026-10-04')), []);
  assert.equal(findingsFor(reportMeasured('2026-10-03')).length, 1);
});

test('a report with no Measured line has no age, so it fails and says how to make one', () => {
  const report = reportMeasured(TODAY).replace(/^Measured: .*$/m, '');

  assert.deepEqual(findingsFor(report), [
    {
      rule: 'report-stale',
      path: 'audits/keyword-demand.md',
      detail:
        'no "Measured: YYYY-MM-DD" line with a real date, so its age cannot be shown; make it with npm run audit:keywords',
    },
  ]);
});

test('a date that is not on the calendar is no date', () => {
  const [found] = findingsFor(reportMeasured('2026-02-30'));

  assert.equal(found.rule, 'report-stale');
  assert.match(found.detail, /^no "Measured: YYYY-MM-DD" line with a real date/);
});

test('a date in the future cannot show the report fresh, so it fails', () => {
  assert.deepEqual(findingsFor(reportMeasured('2026-11-20')), [
    {
      rule: 'report-stale',
      path: 'audits/keyword-demand.md',
      detail:
        'measured 2026-11-20, 12 days after today 2026-11-08; a date in the future cannot show it fresh, so re-measure with npm run audit:keywords',
    },
  ]);
});

test('a clock that runs one day ahead of the runner does not fail a report made today', () => {
  assert.deepEqual(findingsFor(reportMeasured('2026-11-09')), []);
});

test('a fresh date over a document with no phrase table is unreadable, so a reader would find no phrase', () => {
  assert.deepEqual(findingsFor('# Keyword demand\n\nMeasured: 2026-11-08\n'), [
    {
      rule: 'report-unreadable',
      path: 'audits/keyword-demand.md',
      detail:
        'no phrase table (a header with the cells Phrase, Exact, Broad, Weeks and Served by), so a reader finds no phrase; make it with npm run audit:keywords',
    },
  ]);
});

test('an empty or missing report fails twice: no date and no table', () => {
  assert.deepEqual(
    findingsFor('').map(({ rule }) => rule),
    ['report-stale', 'report-unreadable']
  );
});

test('a phrase table whose every row is damaged is unreadable, not empty demand', () => {
  const damaged = reportMeasured(TODAY).replace(/\| (960|70)\s*\|/g, '| many |');

  assert.deepEqual(
    findingsFor(damaged).map(({ rule }) => rule),
    ['report-unreadable']
  );
});

test('the age limit is the one the engine configuration holds', () => {
  assert.equal(MAX_AGE_DAYS, readEngineConfig().keywords.maxAgeDays);
  assert.equal(MAX_AGE_DAYS, 35);
});

test('the summary line shows the date, the age, the limit and the counts', () => {
  assert.equal(
    summaryLine({ measured: '2026-11-01', today: TODAY, phrases: 46, candidates: 3, findings: 0 }),
    'keywords: audits/keyword-demand.md measured 2026-11-01 (7 days old, limit 35), 46 phrases, 3 candidates, 0 findings'
  );
  assert.equal(
    summaryLine({ measured: null, today: TODAY, phrases: 0, candidates: 0, findings: 2 }),
    'keywords: audits/keyword-demand.md has no measured date (limit 35 days), 0 phrases, 0 candidates, 2 findings'
  );
});

const MARKET = { country: 'us', language: 'en-US' };
const reportWith = ({ measured = TODAY, stats = STATS, carried = [], unmeasured = [] } = {}) =>
  withProvenance(
    renderKeywords(buildKeywords({ measured, market: MARKET, stats, carried, unmeasured, routes: ROUTES })),
    'abc1234'
  );
const carriedPhrase = (phrase, measured) => ({ phrase, exact: 4, broad: 5, weeks: 2, measured });
const daysBeforeToday = (days) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
const STALE_PATH = 'audits/keyword-demand.md';

test('a phrase carried from the cache for exactly the limit passes, and one day more is a finding', () => {
  const atTheLimit = reportWith({ carried: [carriedPhrase('shadow ai examples', daysBeforeToday(MAX_AGE_DAYS))] });
  const pastTheLimit = reportWith({
    carried: [carriedPhrase('shadow ai examples', daysBeforeToday(MAX_AGE_DAYS + 1))],
  });

  assert.deepEqual(findingsFor(atTheLimit), []);
  assert.deepEqual(
    findingsFor(pastTheLimit).map(({ rule }) => rule),
    ['phrase-stale']
  );
});

test('phrases older than the cache window at the date of the report are one finding that counts them and names the oldest', () => {
  const report = reportWith({
    carried: [carriedPhrase('shadow ai examples', '2020-01-01'), carriedPhrase('shadow ai checklist', '2019-06-01')],
  });

  assert.deepEqual(findingsFor(report), [
    {
      rule: 'phrase-stale',
      path: STALE_PATH,
      detail:
        'phrases older than the cache window: 2, the oldest measured 2019-06-01 ("shadow ai checklist"); the window is 35 days before the report\'s own date 2026-11-08, and a phrase that old is asked for again, so refresh with npm run audit:keywords',
    },
  ]);
});

test('a phrase with no readable measured date has no age to show, so it is a finding of its own', () => {
  const report = reportWith().replace(
    /\| 2026-11-08 \| `\/glossary\/shadow-ai`/,
    '| yesterday  | `/glossary/shadow-ai`'
  );

  assert.deepEqual(findingsFor(report), [
    {
      rule: 'phrase-stale',
      path: STALE_PATH,
      detail:
        'phrases with no readable Measured date: 1, the first "what is shadow ai", so their age cannot be shown; make it with npm run audit:keywords',
    },
  ]);
});

test('a report dated long ago over phrases measured on its own day is stale once, and its phrases are not stale as well', () => {
  const moved = reportWith().replace(/^Measured: .*$/m, 'Measured: 2020-01-01');

  assert.deepEqual(
    findingsFor(moved).map(({ rule }) => rule),
    ['report-stale']
  );
});

test('a partial report that names every phrase it never reached is one the gate accepts', () => {
  const report = reportWith({
    stats: STATS.slice(0, 1),
    carried: [carriedPhrase('shadow ai examples', daysBeforeToday(20))],
    unmeasured: ['shadow ai checklist', 'shadow ai template'],
  });

  assert.deepEqual(findingsFor(report), []);
});

test('a phrase that vanished from the table without being named is a report that does not account for its phrases', () => {
  const report = reportWith().replace(/^\| shadow ai risks .*\n/m, '');

  assert.deepEqual(findingsFor(report), [
    {
      rule: 'report-unaccounted',
      path: STALE_PATH,
      detail:
        'the Run line and the tables disagree: it counts 2 built, 2 priced or carried and 0 never answered, while the tables hold 1 priced and 0 not measured; every phrase is priced, carried or named under Not measured, so make it with npm run audit:keywords',
    },
  ]);
});

test('a run line that counts more phrases never answered for than the Not measured table names is unaccounted too', () => {
  const report = reportWith({ unmeasured: ['shadow ai checklist', 'shadow ai template'] }).replace(
    /^\| shadow ai template .*\n/m,
    ''
  );
  const [found, ...others] = findingsFor(report);

  assert.equal(found.rule, 'report-unaccounted');
  assert.match(
    found.detail,
    /it counts 4 built, 2 priced or carried and 2 never answered, while the tables hold 2 priced and 1 not measured/
  );
  assert.deepEqual(others, []);
});

test('a report with readable phrases and no run line cannot say what is missing, so it is unaccounted', () => {
  const report = reportWith().replace(/^Run: .*\n\n/m, '');

  assert.deepEqual(findingsFor(report), [
    {
      rule: 'report-unaccounted',
      path: STALE_PATH,
      detail:
        'no "Run:" line with the counts of phrases built, priced this run, carried from the cache and never answered, so a reader cannot tell what is missing; make it with npm run audit:keywords',
    },
  ]);
});

test('the phrase rules wait for a readable phrase table and a real date, so a broken document is reported once', () => {
  assert.deepEqual(
    findingsFor('# Keyword demand\n\nMeasured: 2026-11-08\n').map(({ rule }) => rule),
    ['report-unreadable']
  );
  assert.deepEqual(
    findingsFor(
      reportWith({ carried: [carriedPhrase('shadow ai examples', '2020-01-01')] }).replace(/^Measured: .*\n/m, '')
    ).map(({ rule }) => rule),
    ['report-stale']
  );
});

const handledRow = (extra = {}) => ({
  phrase: 'shadow ai risks',
  route: '/glossary/shadow-ai',
  impressions: 70,
  handledOn: '2026-11-08',
  reason: 'Added a section on the risks of shadow AI.',
  ...extra,
});
const withHandled = (rows) => keywordFindings({ report: reportMeasured(TODAY), today: TODAY, handled: rows });

test('a handled ledger with every field of every row has no finding, and no ledger has none', () => {
  assert.deepEqual(withHandled(JSON.stringify([handledRow()])), []);
  assert.deepEqual(withHandled(''), []);
  assert.deepEqual(withHandled('[]'), []);
  assert.deepEqual(findingsFor(reportMeasured(TODAY)), []);
});

test('a handled row with no reason is a finding that names the ledger and the phrase, and the report is still read', () => {
  const found = withHandled(JSON.stringify([handledRow({ reason: undefined })]));
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, 'handled-invalid');
  assert.equal(found[0].path, 'audits/keyword-handled.json');
  assert.ok(found[0].detail.includes('"shadow ai risks": reason must say what was done to the route'), found[0].detail);
});

test('a handled ledger that is not JSON is a finding, not a crash', () => {
  const [found] = withHandled('{ nope');
  assert.equal(found.rule, 'handled-invalid');
  assert.match(found.detail, /is not JSON/);
});
