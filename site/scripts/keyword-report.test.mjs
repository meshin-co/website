import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildKeywords } from './keyword-demand-rows.mjs';
import { renderKeywords } from './keyword-demand-render.mjs';
import { readKeywordReport } from './keyword-report.mjs';
import { withProvenance } from './evidence-gate.mjs';

const ROUTES = [
  { route: '/glossary/shadow-ai', query: 'shadow ai', title: 'What is shadow AI?' },
  { route: '/glossary/dpia', query: 'dpia', title: 'What is a DPIA?' },
  { route: '/blog/a-dpia-guide', query: 'dpia guide', title: 'A DPIA guide' },
];
const week = (day, exact, broad) => ({ day, exact, broad });
const STATS = [
  { phrase: 'what is shadow ai', weeks: [week('2026-10-24', 800, 900), week('2026-10-31', 960, 1100)] },
  { phrase: 'shadow ai risks', weeks: [week('2026-10-31', 70, 75)] },
  { phrase: 'what is a dpia', weeks: [week('2026-10-17', 3, 4), week('2026-10-31', 4, 6)] },
  { phrase: 'dpia | template', weeks: [] },
];
const MARKET = { country: 'us', language: 'en-US' };

const built = (stats = STATS) => buildKeywords({ measured: '2026-11-08', market: MARKET, stats, routes: ROUTES });
const written = (stats) => withProvenance(renderKeywords(built(stats)), 'abc1234');

test('what the renderer writes is read back as the same phrases, counts, weeks, routes and candidates', () => {
  const { phrases, candidates } = built();
  const read = readKeywordReport(written());

  assert.deepEqual(read.phrases, phrases);
  assert.deepEqual(read.candidates, candidates);
});

test('the date, the window, the market and the commit it was generated from are read from the head', () => {
  const read = readKeywordReport(written());

  assert.equal(read.measured, '2026-11-08');
  assert.equal(read.windowStart, '2026-10-17');
  assert.equal(read.windowEnd, '2026-10-31');
  assert.equal(read.market, 'country us, language en-US');
  assert.equal(read.generatedFrom, 'abc1234');
});

test('a measurement with no window is read with a date and no window', () => {
  const read = readKeywordReport(written([{ phrase: 'a phrase', weeks: [] }]));

  assert.equal(read.measured, '2026-11-08');
  assert.equal(read.windowStart, null);
  assert.equal(read.windowEnd, null);
});

test('a date with a digit too many is no date, as in the Search Console reader', () => {
  const read = readKeywordReport(written().replace('Measured: 2026-11-08', 'Measured: 2026-11-081'));

  assert.equal(read.measured, null);
});

test('a row whose counts are not whole numbers is skipped, so a damaged row never reads as zero demand', () => {
  const damaged = written().replace(/\| what is shadow ai\s+\| 1760/, '| what is shadow ai | many');
  const read = readKeywordReport(damaged);

  assert.deepEqual(
    read.phrases.map(({ phrase }) => phrase),
    ['shadow ai risks', 'what is a dpia', 'dpia | template']
  );
});

test('the candidate table is told from the phrase table by its columns, and each is read from its own', () => {
  const read = readKeywordReport(written());

  assert.deepEqual(read.candidates, [{ phrase: 'shadow ai risks', exact: 70, broad: 75 }]);
  assert.equal(read.phrases.length, 4);
});

test('a document with no phrase table, an empty text and a value that is not text read as no phrase at all', () => {
  for (const input of ['# Keyword demand\n\nMeasured: 2026-11-08\n', '', undefined, null, 7]) {
    const read = readKeywordReport(input);

    assert.deepEqual(read.phrases, []);
    assert.deepEqual(read.candidates, []);
  }
  assert.equal(readKeywordReport('# Keyword demand\n\nMeasured: 2026-11-08\n').measured, '2026-11-08');
  assert.equal(readKeywordReport(undefined).measured, null);
});

test('a phrase that holds a pipe and a phrase no route serves are read back whole', () => {
  const read = readKeywordReport(written());
  const piped = read.phrases.find(({ phrase }) => phrase.includes('|'));

  assert.deepEqual(piped, {
    phrase: 'dpia | template',
    exact: 0,
    broad: 0,
    weeks: 0,
    measured: '2026-11-08',
    servedBy: [],
  });
});

const CARRIED = [{ phrase: 'shadow ai examples', exact: 40, broad: 80, weeks: 6, measured: '2026-10-20' }];
const UNMEASURED = ['what is data classification', 'a | pipe'];
const partial = () =>
  withProvenance(
    renderKeywords(
      buildKeywords({
        measured: '2026-11-08',
        market: MARKET,
        stats: STATS,
        carried: CARRIED,
        unmeasured: UNMEASURED,
        routes: ROUTES,
      })
    ),
    'abc1234'
  );

test('a phrase priced now is read with the day of the run and a carried one with the day it was measured', () => {
  const { phrases } = readKeywordReport(partial());
  const measuredOf = (name) => phrases.find(({ phrase }) => phrase === name).measured;

  assert.equal(measuredOf('what is shadow ai'), '2026-11-08');
  assert.equal(measuredOf('shadow ai examples'), '2026-10-20');
  assert.deepEqual(
    readKeywordReport(partial()).phrases,
    buildKeywords({
      measured: '2026-11-08',
      market: MARKET,
      stats: STATS,
      carried: CARRIED,
      unmeasured: UNMEASURED,
      routes: ROUTES,
    }).phrases
  );
});

test('the run line is read as the four counts it states', () => {
  assert.deepEqual(readKeywordReport(partial()).run, { built: 7, priced: 4, carried: 1, unanswered: 2 });
  assert.deepEqual(readKeywordReport(written()).run, { built: 4, priced: 4, carried: 0, unanswered: 0 });
});

test('the phrases Bing never answered for are read back whole, and are neither a phrase row nor a candidate', () => {
  const read = readKeywordReport(partial());

  assert.deepEqual(read.unmeasured, ['a | pipe', 'what is data classification']);
  assert.equal(read.phrases.length, 5);
  assert.equal(read.candidates.length, 2);
  assert.deepEqual(readKeywordReport(written()).unmeasured, []);
});

test('a report with no run line, or a run line that is not four counts, reads as no run', () => {
  const text = partial();

  assert.equal(readKeywordReport(text.replace(/^Run: .*$/m, '')).run, null);
  assert.equal(readKeywordReport(text.replace(/never answered 2/, 'never answered some')).run, null);
  assert.equal(readKeywordReport('# Keyword demand\n\nMeasured: 2026-11-08\n').run, null);
  assert.equal(readKeywordReport(undefined).run, null);
});

test('a Measured cell that is no date is read as no date, and the row stays with its counts', () => {
  const damaged = written().replace(/\| 2026-11-08 \| `\/glossary\/shadow-ai`/, '| yesterday  | `/glossary/shadow-ai`');
  const { phrases } = readKeywordReport(damaged);
  const row = phrases.find(({ phrase }) => phrase === 'what is shadow ai');

  assert.equal(row.measured, null);
  assert.equal(row.exact, 1760);
  assert.equal(phrases.length, 4);
});

test('a report written before phrases carried a day reads its rows with no date', () => {
  const old = [
    '# Keyword demand',
    '',
    'Measured: 2026-11-08',
    '',
    '| Phrase    | Exact | Broad | Weeks | Served by |',
    '| --------- | ----- | ----- | ----- | --------- |',
    '| shadow ai | 12    | 15    | 1     | -         |',
    '',
  ].join('\n');

  assert.deepEqual(readKeywordReport(old).phrases, [
    { phrase: 'shadow ai', exact: 12, broad: 15, weeks: 1, measured: null, servedBy: [] },
  ]);
});
