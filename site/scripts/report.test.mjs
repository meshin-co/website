import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderReport } from './report.mjs';

const row = (route, scores, runs = 3) => ({ route, runs, scores });
const perfect = { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 };
const gate = { routes: ['/'], measured: [{ route: '/', js: 1108, css: 18921, page: 26195 }], overBudget: [] };

test('a clean run reports PASS', () => {
  const { markdown, failures } = renderReport({
    phase: '1',
    gate,
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, []);
  assert.match(markdown, /Result: PASS/);
});

test('a 99 anywhere is a failure, not a footnote', () => {
  const { markdown, failures } = renderReport({
    phase: '1',
    gate,
    mobile: [row('/', { ...perfect, performance: 99 })],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['mobile / performance: 99']);
  assert.match(markdown, /Result: FAIL/);
});

test('fewer than three runs is a failure even when every score is 100', () => {
  const { failures } = renderReport({
    phase: '1',
    gate,
    mobile: [row('/', perfect, 1)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['mobile /: 1 runs, gate requires 3']);
});

test('an over-budget route fails the report', () => {
  const { failures } = renderReport({
    phase: '1',
    gate: { ...gate, overBudget: ['/ css 21000 > 20480'] },
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['budget: / css 21000 > 20480']);
});

test('the report carries no waiver or deferral vocabulary', () => {
  const { markdown } = renderReport({ phase: '1', gate, mobile: [row('/', perfect)], desktop: [row('/', perfect)] });

  assert.doesNotMatch(markdown, /waiver|waived|known issue|next phase|accepted/i);
});
