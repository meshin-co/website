import assert from 'node:assert/strict';
import { test } from 'node:test';

import { withProvenance } from './evidence-gate.mjs';
import { collectKeywords } from './keyword-demand.mjs';
import { planPricing } from './keyword-demand-cache.mjs';
import { renderKeywords } from './keyword-demand-render.mjs';
import { buildKeywords } from './keyword-demand-rows.mjs';

const MARKET = { country: 'us', language: 'en-US' };
const OTHER_MARKET = { country: 'gb', language: 'en-GB' };
const TODAY = '2026-11-09';
const WINDOW_DAYS = 35;
const PHRASES = ['what is shadow ai', 'what is a dpia', 'shadow ai policy', 'dpia policy'];

const daysBefore = (days) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

const figures = (phrase, measured, exact = 7) => ({ phrase, exact, broad: exact + 1, weeks: 3, measured });

const reportOf = (carried, market = MARKET) =>
  withProvenance(renderKeywords(buildKeywords({ measured: TODAY, market, stats: [], carried, routes: [] })), 'abc1234');

const plan = (previousReport, overrides = {}) =>
  planPricing({
    phrases: PHRASES,
    previousReport,
    market: MARKET,
    today: TODAY,
    maxAgeDays: WINDOW_DAYS,
    ...overrides,
  });

const namesOf = (rows) => rows.map(({ phrase }) => phrase);

test('a phrase measured inside the window is carried with its figures and its own date, and is not due', () => {
  const { carried, due } = plan(reportOf([figures(PHRASES[0], daysBefore(10), 960)]));

  assert.deepEqual(carried, [{ phrase: PHRASES[0], exact: 960, broad: 961, weeks: 3, measured: daysBefore(10) }]);
  assert.deepEqual(due, PHRASES.slice(1));
});

test('the window ends on the last day that passes: a phrase measured maxAgeDays ago is carried, one day more is due', () => {
  const atTheLimit = plan(reportOf([figures(PHRASES[0], daysBefore(WINDOW_DAYS))]));
  const pastTheLimit = plan(reportOf([figures(PHRASES[0], daysBefore(WINDOW_DAYS + 1))]));

  assert.deepEqual(namesOf(atTheLimit.carried), [PHRASES[0]]);
  assert.deepEqual(atTheLimit.due, PHRASES.slice(1));
  assert.deepEqual(pastTheLimit.carried, []);
  assert.deepEqual(pastTheLimit.due, PHRASES);
});

test('a phrase measured today is carried, so a second run on the same day asks Bing only for what is missing', () => {
  const { carried, due } = plan(reportOf([figures(PHRASES[0], TODAY), figures(PHRASES[1], TODAY)]));

  assert.deepEqual(namesOf(carried), [PHRASES[0], PHRASES[1]]);
  assert.deepEqual(due, PHRASES.slice(2));
});

test('a phrase the previous report does not hold is due, and every phrase is when there is no readable report', () => {
  const unreadable = [undefined, null, '', 'PREVIOUS REPORT', '# Keyword demand\n\nMeasured: 2026-11-08\n', 42];

  for (const previousReport of unreadable) {
    assert.deepEqual(plan(previousReport), { carried: [], due: PHRASES }, String(previousReport));
  }
  assert.deepEqual(plan(reportOf([figures('an unrelated phrase', daysBefore(1))])), { carried: [], due: PHRASES });
});

test('a phrase the core no longer builds is left out of the carry, and the carry keeps the order of the phrases', () => {
  const previous = reportOf([
    figures(PHRASES[2], daysBefore(3)),
    figures('a phrase no concept builds any more', daysBefore(3)),
    figures(PHRASES[0], daysBefore(3)),
  ]);
  const { carried, due } = plan(previous);

  assert.deepEqual(namesOf(carried), [PHRASES[0], PHRASES[2]]);
  assert.deepEqual(due, [PHRASES[1], PHRASES[3]]);
});

test('a row that cannot be read is not carried and does not stop the run: damaged counts, no date, no real date, a future date', () => {
  const previous = reportOf([
    figures(PHRASES[0], daysBefore(1)),
    figures(PHRASES[1], daysBefore(1), 123),
    figures(PHRASES[2], 'yesterday'),
    figures(PHRASES[3], '2026-13-45'),
    figures('shadow ai risks', daysBefore(-3)),
  ]).replace(/\| 123\s*\|/, '| many |');
  const { carried, due } = plan(previous, { phrases: [...PHRASES, 'shadow ai risks'] });

  assert.deepEqual(namesOf(carried), [PHRASES[0]]);
  assert.deepEqual(due, [PHRASES[1], PHRASES[2], PHRASES[3], 'shadow ai risks']);
});

test('a date far in the future is never carried, so a hand-edited date cannot pin a figure for good', () => {
  assert.deepEqual(plan(reportOf([figures(PHRASES[0], '2099-01-01')])), { carried: [], due: PHRASES });
});

test('a report written for another market is not carried, because a figure measured elsewhere is no measurement here', () => {
  const previous = reportOf([figures(PHRASES[0], daysBefore(1))], OTHER_MARKET);

  assert.deepEqual(plan(previous), { carried: [], due: PHRASES });
  assert.deepEqual(namesOf(plan(previous, { market: OTHER_MARKET }).carried), [PHRASES[0]]);
});

test('what the renderer wrote is what the cache reads back: the figures, the dates and the market survive the round trip', () => {
  const model = buildKeywords({
    measured: TODAY,
    market: MARKET,
    stats: [
      { phrase: PHRASES[0], weeks: [{ day: '2026-11-01', exact: 40, broad: 50 }] },
      { phrase: PHRASES[1], weeks: [] },
    ],
    carried: [figures(PHRASES[2], daysBefore(12), 9)],
    routes: [{ route: '/glossary/shadow-ai', query: 'shadow ai', title: 'What is shadow AI?' }],
  });
  const { carried, due } = plan(withProvenance(renderKeywords(model), 'abc1234'));
  const written = model.phrases.map(({ phrase, exact, broad, weeks, measured }) => ({
    phrase,
    exact,
    broad,
    weeks,
    measured,
  }));
  const byPhrase = (a, b) => (a.phrase < b.phrase ? -1 : 1);

  assert.deepEqual(namesOf(carried), PHRASES.slice(0, 3));
  assert.deepEqual([...carried].sort(byPhrase), [...written].sort(byPhrase));
  assert.deepEqual(due, [PHRASES[3]]);
});

test('a report in the committed layout is read as written, so the cache does not depend on the renderer that made it', () => {
  const previous = [
    '# Keyword demand: what Bing Webmaster Tools measured',
    '',
    'Generated-from: abc1234',
    '',
    'Measured: 2026-11-05 (window 2026-05-10 to 2026-11-01)',
    '',
    'Market: country us, language en-US',
    '',
    '## Phrases',
    '',
    '| Phrase            | Exact | Broad | Weeks | Measured   | Served by             |',
    '| ----------------- | ----- | ----- | ----- | ---------- | --------------------- |',
    '| what is shadow ai | 1760  | 2000  | 2     | 2026-11-05 | `/glossary/shadow-ai` |',
    '| what is a dpia    | 7     | 10    | 2     | 2026-09-01 | `/glossary/dpia`      |',
    '',
  ].join('\n');
  const { carried, due } = plan(previous);

  assert.deepEqual(carried, [{ phrase: PHRASES[0], exact: 1760, broad: 2000, weeks: 2, measured: '2026-11-05' }]);
  assert.deepEqual(due, PHRASES.slice(1));
});

test('a phrase inside the window costs no request and one outside it costs exactly one', async () => {
  const previous = reportOf([
    figures(PHRASES[0], daysBefore(WINDOW_DAYS)),
    figures(PHRASES[1], daysBefore(WINDOW_DAYS + 1)),
  ]);
  const { carried, due } = plan(previous);
  const asked = [];
  const get = async (phrase) => {
    asked.push(phrase);
    return [];
  };
  const { stats, unreached } = await collectKeywords({ get, phrases: due, wait: async () => {}, gapMs: 0 });
  const requestsFor = (phrase) => asked.filter((name) => name === phrase).length;

  assert.equal(requestsFor(PHRASES[0]), 0);
  assert.equal(requestsFor(PHRASES[1]), 1);
  assert.deepEqual(asked, PHRASES.slice(1));
  assert.deepEqual(namesOf(carried), [PHRASES[0]]);
  assert.deepEqual(namesOf(stats), PHRASES.slice(1));
  assert.deepEqual(unreached, []);
});
