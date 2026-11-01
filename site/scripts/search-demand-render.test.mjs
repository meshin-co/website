import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildDemand } from './search-demand-rows.mjs';
import { renderDemand } from './search-demand-render.mjs';

const {
  window: WINDOW,
  property: PROPERTY,
  prompts: PROMPTS,
  ...DATA
} = JSON.parse(readFileSync(new URL('./search-demand.fixture.json', import.meta.url), 'utf8'));

const EMPTY = { totals: undefined, queries: [], pages: [], days: [], pairs: [] };
const row = (keys, impressions, position) => ({ keys, clicks: 0, impressions, ctr: 0, position });
const report = (data = DATA) =>
  renderDemand(buildDemand({ window: WINDOW, property: PROPERTY, prompts: PROMPTS, data }));

const cells = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

function tablesOf(markdown) {
  const tables = [];
  let current;
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) {
      current = undefined;
    } else if (!current) {
      current = { header: cells(line), rows: [] };
      tables.push(current);
    } else if (!/^\|\s*-+\s*\|/.test(line)) {
      current.rows.push(cells(line));
    }
  }
  return tables;
}

const NO_TABLE = { header: [], rows: [] };
const tableWith = (markdown, ...names) =>
  tablesOf(markdown).find((table) => names.every((name) => table.header.includes(name))) ?? NO_TABLE;

test('the report states the day it was measured, the window and the property, each on its own line', () => {
  assert.match(report(), /^Measured: 2026-11-01 \(window 2026-08-01 to 2026-10-30\)$/m);
  assert.match(report(), /^Property: sc-domain:meshin\.co$/m);
});

test('the totals line carries impressions, clicks, CTR and average position', () => {
  assert.match(report(), /^Totals: 77 impressions, 0 clicks, CTR 0\.0%, average position 67\.7$/m);
});

test('the queries table lists the three biggest first, with their page and the prompts they prove', () => {
  const queries = tableWith(report(), 'Query');

  assert.deepEqual(queries.header, ['Query', 'Impressions', 'Clicks', 'Position', 'CTR', 'Page', 'Prompts']);
  assert.deepEqual(queries.rows.slice(0, 3), [
    ['eu ai act', '28', '0', '76.2', '0.0%', '`/glossary/eu-ai-act`', '8'],
    ['ai act eu', '13', '0', '76.2', '0.0%', '`/glossary/eu-ai-act`', '8'],
    ['ai management system', '9', '0', '91.8', '0.0%', '`/glossary/ai-management-system`', '-'],
  ]);
  assert.equal(queries.rows.length, 15);
});

test('the pages table lists routes, not urls, and merges the scheme variants', () => {
  const pages = tablesOf(report()).find((table) => table.header[0] === 'Page') ?? NO_TABLE;

  assert.deepEqual(pages.rows.slice(0, 3), [
    ['`/glossary/eu-ai-act`', '48', '0', '77.9', '0.0%'],
    ['`/glossary/ai-management-system`', '11', '0', '91.8', '0.0%'],
    ['`/`', '4', '0', '3.0', '0.0%'],
  ]);
  assert.equal(pages.rows.length, 20);
});

test('the report says the queries add up to less than the total, and why', () => {
  assert.match(report(), /account for 65 of the 77 impressions/);
  assert.match(report(), /withholds a query that too few people searched/);
});

test('the report says what the Prompts column holds and what a dash in it means', () => {
  assert.match(
    report(),
    /The Prompts column names the buyer prompts the query proves, by the rule under Buyer prompts below\./
  );
  assert.match(report(), /A dash means the query proves none: no prompt in the core says the same thing, or the page/);
});

test('the report says the pages add up to more than the total, and why', () => {
  assert.match(report(), /add up to 86 impressions against a total of 77/);
});

test('queries that account for every impression are said to, with no talk of withholding', () => {
  const whole = {
    totals: { clicks: 0, impressions: 5, ctr: 0, position: 4 },
    queries: [row(['eu ai act'], 5, 4)],
    pages: [row(['https://meshin.co/glossary/eu-ai-act'], 5, 4)],
    days: [row(['2026-10-20'], 5, 4)],
    pairs: [row(['eu ai act', 'https://meshin.co/glossary/eu-ai-act'], 5, 4)],
  };

  assert.match(report(whole), /account for all 5 impressions/);
  assert.doesNotMatch(report(whole), /withholds/);
  assert.doesNotMatch(report(whole), /add up to \d+ impressions against/);
});

test('the report names the first day with an impression and the busiest day', () => {
  assert.match(report(), /First day with an impression in this window: 2026-10-19\./);
  assert.match(report(), /Busiest day: 2026-10-20, 16 impressions\./);
});

test('the by-day table has only days with an impression', () => {
  const days = tableWith(report(), 'Day');

  assert.deepEqual(days.rows[0], ['2026-10-19', '1', '0', '1.0']);
  assert.deepEqual(days.rows[1], ['2026-10-20', '16', '0', '59.1']);
  assert.equal(days.rows.length, 10);
});

test('the prompt table joins every prompt to its measured impressions, or to the word unproven', () => {
  const prompts = tableWith(report(), '#', 'Prompt', 'Impressions');
  const register = '`/blog/how-to-build-an-ai-system-register-in-a-week`';

  assert.deepEqual(prompts.header, ['#', 'Prompt', 'Must win', 'Impressions', 'Position', 'Carried by']);
  assert.deepEqual(prompts.rows, [
    ['1', PROMPTS[0].prompt, '`/`', 'unproven', '-', '-'],
    ['4', PROMPTS[1].prompt, '`/services/ai-readiness-and-risk-assessment`', 'unproven', '-', '-'],
    ['6', PROMPTS[2].prompt, register, '1', '91.0', '`/glossary/ai-register`'],
    ['8', PROMPTS[3].prompt, '`/glossary/eu-ai-act`', '47', '77.4', '`/glossary/eu-ai-act`'],
    ['17', PROMPTS[4].prompt, '-', 'unproven', '-', '-'],
    ['26', PROMPTS[5].prompt, '`/pricing`', 'unproven', '-', '-'],
  ]);
});

test('the report says how many prompts have an impression and how many are unproven', () => {
  assert.match(report(), /2 of 6 prompts have an impression in this window; 4 are unproven\./);
});

test('the report defines unproven, so the label cannot be read as a rank or as a page-level miss', () => {
  assert.match(report(), /reads `unproven`: no query measured in this window shows demand for it/);
  assert.match(report(), /A page that carried an impression for another query, or for a query Search Console withheld/);
  assert.match(report(), /names no must-win route has nothing to match and always reads `unproven`/);
});

test('only the prompt table has the three header names the gate reads', () => {
  const tables = tablesOf(report());
  const withAll = tables.filter((table) => ['#', 'Prompt', 'Impressions'].every((name) => table.header.includes(name)));

  assert.equal(tables.length, 4);
  assert.equal(withAll.length, 1);
});

test('an empty window says so in words, reads zero, and leaves every prompt unproven', () => {
  const empty = report(EMPTY);

  assert.match(empty, /^Totals: 0 impressions, 0 clicks, CTR 0\.0%, average position n\/a$/m);
  assert.match(empty, /The window holds no impressions: Search Console returned no rows for sc-domain:meshin\.co/);
  assert.match(empty, /No query produced an impression in this window\./);
  assert.match(empty, /No route carried an impression in this window\./);
  assert.match(empty, /No day in this window had an impression\./);
  assert.deepEqual(
    tableWith(empty, '#', 'Prompt', 'Impressions').rows.map((entry) => entry[3]),
    ['unproven', 'unproven', 'unproven', 'unproven', 'unproven', 'unproven']
  );
});

test('a totals row of zeros reads as an empty window too, not as a position of zero', () => {
  const zeros = report({ ...EMPTY, totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 } });

  assert.match(zeros, /^Totals: 0 impressions, 0 clicks, CTR 0\.0%, average position n\/a$/m);
  assert.match(zeros, /The window holds no impressions/);
});

test('impressions whose every query is withheld say so, with no queries table and no first day to name', () => {
  const withheld = report({ ...EMPTY, totals: { clicks: 0, impressions: 3, ctr: 0, position: 40 } });

  assert.match(withheld, /^Totals: 3 impressions, 0 clicks, CTR 0\.0%, average position 40\.0$/m);
  assert.match(withheld, /No query is named for these 3 impressions\. Search Console withholds a query/);
  assert.equal(
    tablesOf(withheld).some((table) => table.header.includes('Query')),
    false
  );
  assert.doesNotMatch(withheld, /First day with an impression/);
  assert.doesNotMatch(withheld, /The window holds no impressions/);
});

test('a query with a pipe in it cannot break its table row', () => {
  const piped = { ...EMPTY, totals: { clicks: 0, impressions: 1, ctr: 0, position: 3 }, queries: [row(['a|b'], 1, 3)] };

  const line = report(piped)
    .split('\n')
    .find((candidate) => candidate.includes('a\\|b'));

  assert.equal((line?.split(/(?<!\\)\|/).length ?? 0) - 2, 7);
});

test('the gate reads back what the generator wrote: the measured day and one row per prompt', async () => {
  const { parseDemandReport } = await import('./search-demand-gate.mjs');

  const parsed = parseDemandReport(report());

  assert.equal(parsed.measured, '2026-11-01');
  assert.deepEqual(
    parsed.rows,
    PROMPTS.map(({ number, prompt }) => ({ number, prompt, impressions: { 6: 1, 8: 47 }[number] ?? 0 }))
  );
});
