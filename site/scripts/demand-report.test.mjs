import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { readDemandReport } from './demand-report.mjs';

const FIXTURE = readFileSync(join(import.meta.dirname, 'fixtures', 'search-demand-2026-11-01.md'), 'utf8');
const report = readDemandReport(FIXTURE);

const EMPTY = {
  measured: null,
  windowStart: null,
  windowEnd: null,
  property: null,
  generatedFrom: null,
  queries: [],
  pages: [],
  days: [],
  prompts: [],
};

const QUERY_HEAD =
  '| Query | Impressions | Clicks | Position | CTR | Page | Prompts |\n| --- | --- | --- | --- | --- | --- | --- |';
const PAGE_HEAD = '| Page | Impressions | Clicks | Position | CTR |\n| --- | --- | --- | --- | --- |';
const DAY_HEAD = '| Day | Impressions | Clicks | Position |\n| --- | --- | --- | --- |';
const PROMPT_HEAD =
  '| # | Prompt | Must win | Impressions | Position | Carried by |\n| --- | --- | --- | --- | --- | --- |';

const promptRow = (number) => `| ${number} | prompt ${number} | \`/route-${number}\` | unproven | - | - |`;

test('the header lines of the fixture are read', () => {
  assert.equal(report.measured, '2026-11-01');
  assert.equal(report.windowStart, '2026-08-01');
  assert.equal(report.windowEnd, '2026-10-30');
  assert.equal(report.property, 'sc-domain:meshin.co');
  assert.equal(report.generatedFrom, 'b5d0639');
});

test('the fixture yields every row of every table', () => {
  assert.equal(report.queries.length, 15);
  assert.equal(report.pages.length, 20);
  assert.equal(report.days.length, 10);
  assert.equal(report.prompts.length, 30);
});

test('the first query row carries numbers, routes and prompt numbers', () => {
  assert.deepEqual(report.queries[0], {
    query: 'eu ai act',
    impressions: 28,
    clicks: 0,
    position: 76.2,
    pages: ['/glossary/eu-ai-act'],
    prompts: [8],
    cells: {
      Query: 'eu ai act',
      Impressions: '28',
      Clicks: '0',
      Position: '76.2',
      CTR: '0.0%',
      Page: '`/glossary/eu-ai-act`',
      Prompts: '8',
    },
  });
});

test('a query keeps its quotes and a dash in Prompts gives no prompts', () => {
  const quoted = report.queries.find(({ query }) => query === '"fractional chief ai officer" remote');
  assert.equal(quoted.position, 6);
  assert.deepEqual(quoted.pages, ['/faq']);
  assert.deepEqual(quoted.prompts, []);
});

test('page and day rows are read as numbers', () => {
  assert.deepEqual(report.pages[0], { route: '/glossary/eu-ai-act', impressions: 48, clicks: 0, position: 77.9 });
  assert.deepEqual(report.days[1], { day: '2026-10-20', impressions: 16, clicks: 0, position: 59.1 });
});

test('an unproven prompt keeps its cells verbatim', () => {
  assert.deepEqual(report.prompts[8], {
    number: 9,
    prompt: 'why do AI pilots fail to reach production',
    mustWin: '/blog/why-your-ai-pilot-never-reached-production',
    unproven: true,
    impressions: 0,
    position: null,
    carriedBy: [],
    cells: {
      '#': '9',
      Prompt: 'why do AI pilots fail to reach production',
      'Must win': '`/blog/why-your-ai-pilot-never-reached-production`',
      Impressions: 'unproven',
      Position: '-',
      'Carried by': '-',
    },
  });
});

test('a proven prompt has its impression, position and carrier', () => {
  const six = report.prompts.find(({ number }) => number === 6);
  assert.equal(six.unproven, false);
  assert.equal(six.impressions, 1);
  assert.equal(six.position, 91);
  assert.deepEqual(six.carriedBy, ['/glossary/ai-register']);
});

test('exactly two fixture prompts are proven', () => {
  assert.deepEqual(
    report.prompts.filter(({ unproven }) => !unproven).map(({ number }) => number),
    [6, 8]
  );
});

test('a prompt without a must-win route reads null', () => {
  assert.equal(report.prompts.find(({ number }) => number === 16).mustWin, null);
});

test('a query row with two pages and two prompts lists both of each', () => {
  const markdown = `${QUERY_HEAD}\n| both ways | 5 | 1 | 12.5 | 20.0% | \`/a\`, \`/b\` | 6, 8 |`;
  const [row] = readDemandReport(markdown).queries;
  assert.deepEqual(row.pages, ['/a', '/b']);
  assert.deepEqual(row.prompts, [6, 8]);
  assert.equal(row.clicks, 1);
  assert.equal(row.position, 12.5);
});

test('an escaped pipe in a query is un-escaped', () => {
  const markdown = `${QUERY_HEAD}\n| a \\| b | 2 | 0 | 3.0 | 0.0% | \`/a\` | - |`;
  const [row] = readDemandReport(markdown).queries;
  assert.equal(row.query, 'a | b');
  assert.equal(row.cells.Query, 'a | b');
});

test('a position that is not a number reads null', () => {
  const markdown = `${PAGE_HEAD}\n| \`/a\` | 2 | 0 | n/a | 0.0% |\n| \`/b\` | 2 | 0 | - | 0.0% |`;
  assert.deepEqual(
    readDemandReport(markdown).pages.map(({ position }) => position),
    [null, null]
  );
});

test('a row whose Impressions cell is not a non-negative integer is dropped', () => {
  const rows = ['x', '-3', '1.5', '', '4'].map((cell) => `| \`/p\` | ${cell} | 0 | 1.0 | 0.0% |`);
  const pages = readDemandReport(`${PAGE_HEAD}\n${rows.join('\n')}`).pages;
  assert.deepEqual(
    pages.map(({ impressions }) => impressions),
    [4]
  );
});

test('a zero-impression report has empty lists and still reads 30 unproven prompts', () => {
  const rows = Array.from({ length: 30 }, (_, at) => promptRow(at + 1));
  const markdown = [
    '# Search demand: what Search Console measured',
    '',
    'Measured: 2026-11-01 (window 2026-08-01 to 2026-10-30)',
    '',
    'Property: sc-domain:meshin.co',
    '',
    '## Queries',
    '',
    'No query produced an impression in this window.',
    '',
    '## Pages',
    '',
    'No route carried an impression in this window.',
    '',
    '## By day',
    '',
    'No day in this window had an impression.',
    '',
    '## Buyer prompts',
    '',
    PROMPT_HEAD,
    ...rows,
  ].join('\n');
  const zero = readDemandReport(markdown);
  assert.deepEqual([zero.queries, zero.pages, zero.days], [[], [], []]);
  assert.equal(zero.prompts.length, 30);
  assert.ok(
    zero.prompts.every(({ unproven, impressions, position }) => unproven && impressions === 0 && position === null)
  );
  assert.equal(zero.generatedFrom, null);
});

test('tables are found by their header names whatever their order', () => {
  const reversed = [
    PROMPT_HEAD,
    promptRow(1),
    '',
    DAY_HEAD,
    '| 2026-10-19 | 1 | 0 | 1.0 |',
    '',
    PAGE_HEAD,
    '| `/a` | 2 | 0 | 3.0 | 0.0% |',
    '',
    QUERY_HEAD,
    '| q | 2 | 0 | 3.0 | 0.0% | `/a` | 1 |',
  ].join('\n');
  const found = readDemandReport(reversed);
  assert.deepEqual([found.queries.length, found.pages.length, found.days.length, found.prompts.length], [1, 1, 1, 1]);
  assert.equal(found.queries[0].query, 'q');
  assert.equal(found.pages[0].route, '/a');
});

test('text that is not a report returns the empty report', () => {
  assert.deepEqual(readDemandReport('hello\n\n| a | b |\n| - | - |\n| 1 | 2 |'), EMPTY);
  assert.deepEqual(readDemandReport(''), EMPTY);
});
