import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';

import { WEAKNESS_REASONS } from './autowriter-claims.mjs';
import { readDemandReport } from './demand-report.mjs';
import { engineScene } from './fixtures/engine-scene.mjs';
import { MIN_IMPRESSIONS, STRENGTHEN_BAND, proposalCandidates, weakCandidates } from './topic-demand.mjs';

const MODULE = 'site/scripts/topic-demand.mjs';
const real = readDemandReport(readFileSync(new URL('./fixtures/search-demand-2026-11-01.md', import.meta.url), 'utf8'));

const cleanup = [];
after(() => cleanup.forEach((remove) => remove()));

const row = (query, impressions, position, pages = ['/'], prompts = []) => ({
  query,
  impressions,
  clicks: 0,
  position,
  pages,
  prompts,
  cells: { Query: query, Impressions: String(impressions) },
});
const reportOf = (queries) => ({ queries, prompts: [], pages: [], days: [] });
const queriesOf = (queries) => weakCandidates(reportOf(queries)).map(({ query }) => query);
const weaknessOf = (query) => weakCandidates(reportOf([query]))[0]?.weakness;

const ABOVE_FLOOR = MIN_IMPRESSIONS + 1;
const BEYOND_BAND = STRENGTHEN_BAND.max + 0.1;

test('on the report measured 2026-11-01 no query is weak, because no unnamed query asks how or why', () => {
  assert.deepEqual(weakCandidates(real), []);
  assert.deepEqual(weakCandidates({ queries: [], prompts: [], pages: [], days: [] }), []);
});

test('a weak candidate names the query, its numbers, the page that carried it, its report row and what makes it weak', () => {
  const unnamed = row('how to write an ai policy', ABOVE_FLOOR, BEYOND_BAND, ['/']);
  assert.deepEqual(weakCandidates(reportOf([unnamed])), [
    {
      arm: 'weak',
      query: 'how to write an ai policy',
      impressions: ABOVE_FLOOR,
      position: BEYOND_BAND,
      page: '/',
      row: { Query: 'how to write an ai policy', Impressions: String(ABOVE_FLOOR) },
      weakness: ['no-buyer-prompt', 'position-beyond-strengthen-band'],
    },
  ]);
});

test('a measured query that no prompt names, no page answers and that asks how or why is weak', () => {
  const queries = [
    row('how to write an ai policy', 3, 40, ['/']),
    row('why do ai pilots fail', 5, 45, ['/blog']),
    row('can we ban chatgpt at work?', 2, 33, ['/faq']),
    row('fractional caio cost', 9, 30, ['/']),
  ];
  assert.deepEqual(queriesOf(queries), [
    'why do ai pilots fail',
    'how to write an ai policy',
    'can we ban chatgpt at work?',
  ]);
});

test('a row that is not measured, is named by a prompt, is answered by a page or asks nothing is not weak', () => {
  const queries = [
    row('how to a', 0, 40),
    row('how to b', 3, null),
    row('how to c', 3, 40, ['/'], [7]),
    row('how to d', 3, 40, ['/glossary/x']),
    row('how to e', 3, 40, ['/', '/blog/x']),
    row('what is f', 3, 40),
    row('fractional caio cost', 3, 40),
  ];
  assert.deepEqual(queriesOf(queries), []);
});

test('a proposal with no position is still a proposal for the owner, and never a weak candidate', () => {
  const unplaced = row('how to write an ai policy', 3, null, ['/']);
  assert.deepEqual(proposalCandidates(reportOf([unplaced])), [
    { query: 'how to write an ai policy', impressions: 3, position: null, page: '/' },
  ]);
  assert.deepEqual(weakCandidates(reportOf([unplaced])), []);
});

test('the weak candidates are the proposals that have a position, in the order of the proposals', () => {
  const queries = [row('how to b', 5, 20), row('how to c', 9, 25), row('how to a', 5, null), row('how to d', 5, 12)];
  assert.deepEqual(
    proposalCandidates(reportOf(queries)).map(({ query }) => query),
    ['how to c', 'how to d', 'how to b', 'how to a']
  );
  assert.deepEqual(queriesOf(queries), ['how to c', 'how to d', 'how to b']);
});

test('weak candidates run from the most impressions to the fewest, then the nearest to page one, then by query', () => {
  const queries = [row('how to b', 5, 20), row('how to c', 9, 25), row('how to a', 5, 20), row('how to d', 5, 12)];
  assert.deepEqual(queriesOf(queries), ['how to c', 'how to d', 'how to a', 'how to b']);
});

test('no buyer prompt is always the first reason, and a measured query inside the band and above the floor has no other', () => {
  const inside = row('how to a', ABOVE_FLOOR, STRENGTHEN_BAND.min);
  assert.deepEqual(weaknessOf(inside), ['no-buyer-prompt']);
  assert.deepEqual(weaknessOf(row('how to b', ABOVE_FLOOR, STRENGTHEN_BAND.min - 1)), ['no-buyer-prompt']);
});

test(`impressions equal to the floor of ${MIN_IMPRESSIONS} add impressions-at-floor, and one more impression does not`, () => {
  assert.deepEqual(weaknessOf(row('how to a', MIN_IMPRESSIONS, STRENGTHEN_BAND.min)), [
    'no-buyer-prompt',
    'impressions-at-floor',
  ]);
  assert.deepEqual(weaknessOf(row('how to a', ABOVE_FLOOR, STRENGTHEN_BAND.min)), ['no-buyer-prompt']);
});

test(`a position worse than ${STRENGTHEN_BAND.max} adds position-beyond-strengthen-band, and ${STRENGTHEN_BAND.max} itself does not`, () => {
  assert.deepEqual(weaknessOf(row('how to a', ABOVE_FLOOR, STRENGTHEN_BAND.max)), ['no-buyer-prompt']);
  assert.deepEqual(weaknessOf(row('how to a', ABOVE_FLOOR, BEYOND_BAND)), [
    'no-buyer-prompt',
    'position-beyond-strengthen-band',
  ]);
});

test('the reasons come in a fixed order, none comes twice, and together they are every reason a claim may carry', () => {
  assert.deepEqual(weaknessOf(row('how to a', MIN_IMPRESSIONS, 90)), WEAKNESS_REASONS);
});

test('the reasons are computed from the floor and the band of the engine configuration, not typed', () => {
  const scene = engineScene({
    entries: [MODULE],
    mutate: (config) => ({
      ...config,
      demand: { ...config.demand, minImpressions: 4, strengthenBand: { min: 3, max: 12 } },
    }),
    extraFiles: ['site/src/config.yaml'],
  });
  cleanup.push(scene.remove);
  const queries = [row('how to a', 4, 20), row('how to b', 5, 12), row('how to c', 3, 20), row('how to d', 4, 12.5)];
  const found = scene.evaluate(
    MODULE,
    `m.weakCandidates({ queries: ${JSON.stringify(queries)} }).map(({ query, weakness }) => [query, weakness])`
  );
  assert.deepEqual(found, [
    ['how to b', ['no-buyer-prompt']],
    ['how to d', ['no-buyer-prompt', 'impressions-at-floor', 'position-beyond-strengthen-band']],
    ['how to a', ['no-buyer-prompt', 'impressions-at-floor', 'position-beyond-strengthen-band']],
  ]);
});
