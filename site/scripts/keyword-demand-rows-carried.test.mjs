import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildKeywords } from './keyword-demand-rows.mjs';

const ROUTES = [
  { route: '/glossary/shadow-ai', query: 'shadow ai', title: 'What is shadow AI?' },
  { route: '/blog/staff-rules', query: 'rules for staff', title: 'Using chatbots at work' },
  { route: '/about', query: 'about the author', title: 'About' },
];
const MARKET = { country: 'us', language: 'en-US' };

const week = (day, exact, broad) => ({ day, exact, broad });
const carriedRow = (phrase, exact, broad, weeks, measured) => ({ phrase, exact, broad, weeks, measured });
const buildFrom = (stats) => buildKeywords({ measured: '2026-11-08', market: MARKET, stats, routes: ROUTES });

test('a carried phrase keeps its figures and its own date, is ordered among the priced ones and is served by the routes of today', () => {
  const { phrases } = buildKeywords({
    measured: '2026-11-08',
    market: MARKET,
    stats: [{ phrase: 'shadow ai policy', weeks: [week('2026-10-31', 5, 6)] }],
    carried: [{ ...carriedRow('what is shadow ai', 900, 950, 24, '2026-10-20'), servedBy: ['/a-route-since-removed'] }],
    routes: ROUTES,
  });

  assert.deepEqual(phrases, [
    {
      phrase: 'what is shadow ai',
      exact: 900,
      broad: 950,
      weeks: 24,
      measured: '2026-10-20',
      servedBy: ['/glossary/shadow-ai'],
    },
    { phrase: 'shadow ai policy', exact: 5, broad: 6, weeks: 1, measured: '2026-11-08', servedBy: [] },
  ]);
});

test('a carried phrase with an exact impression and no route that serves it is a candidate, like a priced one', () => {
  const { candidates } = buildKeywords({
    measured: '2026-11-08',
    market: MARKET,
    stats: [{ phrase: 'shadow ai risks', weeks: [week('2026-10-31', 70, 70)] }],
    carried: [
      carriedRow('shadow ai examples', 40, 80, 3, '2026-10-20'),
      carriedRow('shadow ai template', 0, 4, 2, '2026-10-20'),
    ],
    routes: ROUTES,
  });

  assert.deepEqual(candidates, [
    { phrase: 'shadow ai risks', exact: 70, broad: 70 },
    { phrase: 'shadow ai examples', exact: 40, broad: 80 },
  ]);
});

test('the run counts the phrases priced now and the phrases carried, and lists those never reached in alphabetical order', () => {
  const model = buildKeywords({
    measured: '2026-11-08',
    market: MARKET,
    stats: [{ phrase: 'a', weeks: [] }],
    carried: [carriedRow('b', 1, 1, 1, '2026-10-20'), carriedRow('c', 2, 2, 2, '2026-10-21')],
    unmeasured: ['f', 'd', 'e'],
    routes: ROUTES,
  });

  assert.deepEqual(model.run, { priced: 1, carried: 2 });
  assert.deepEqual(model.unmeasured, ['d', 'e', 'f']);
  assert.equal(model.phrases.length, 3);
});

test('a run that carries nothing and misses nothing says so with zero and an empty list', () => {
  const model = buildFrom([{ phrase: 'a', weeks: [] }]);

  assert.deepEqual(model.run, { priced: 1, carried: 0 });
  assert.deepEqual(model.unmeasured, []);
});

test('the window comes from the weekly rows of this run alone, because a carried phrase keeps no weekly row', () => {
  const { window } = buildKeywords({
    measured: '2026-11-08',
    market: MARKET,
    stats: [{ phrase: 'a', weeks: [week('2026-10-24', 1, 1), week('2026-10-31', 1, 1)] }],
    carried: [carriedRow('b', 1, 1, 24, '2026-10-20')],
    routes: ROUTES,
  });

  assert.deepEqual(window, { measured: '2026-11-08', startDate: '2026-10-24', endDate: '2026-10-31' });
});

test('a run that priced nothing has no window, though it carries phrases', () => {
  const { window } = buildKeywords({
    measured: '2026-11-08',
    market: MARKET,
    stats: [],
    carried: [carriedRow('b', 1, 1, 24, '2026-10-20')],
    routes: ROUTES,
  });

  assert.deepEqual(window, { measured: '2026-11-08', startDate: null, endDate: null });
});
