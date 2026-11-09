import { withProvenance } from '../evidence-gate.mjs';
import { renderKeywords } from '../keyword-demand-render.mjs';
import { buildKeywords } from '../keyword-demand-rows.mjs';
import { KEYWORDS } from './keyword-run.mjs';

const DAY_MS = 86_400_000;

export const daysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

export const figures = (phrase, daysOld, exact) => ({
  phrase,
  exact,
  broad: exact + 1,
  weeks: 3,
  measured: daysAgo(daysOld),
});

export const previousReport = (rows, market = { country: KEYWORDS.country, language: KEYWORDS.language }) =>
  withProvenance(
    renderKeywords(buildKeywords({ measured: daysAgo(1), market, stats: [], carried: rows, routes: [] })),
    'abc1234'
  );
