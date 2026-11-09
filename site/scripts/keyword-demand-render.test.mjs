import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tablesIn } from './markdown-table.mjs';
import { buildKeywords } from './keyword-demand-rows.mjs';
import { renderKeywords } from './keyword-demand-render.mjs';

const ROUTES = [
  { route: '/glossary/shadow-ai', query: 'shadow ai', title: 'What is shadow AI?' },
  { route: '/glossary/dpia', query: 'dpia', title: 'What is a DPIA?' },
  { route: '/blog/a-dpia-guide', query: 'dpia guide', title: 'A DPIA guide' },
];
const week = (day, exact, broad) => ({ day, exact, broad });
const MARKET = { country: 'us', language: 'en-US' };

const STATS = [
  { phrase: 'what is shadow ai', weeks: [week('2026-10-24', 800, 900), week('2026-10-31', 960, 1100)] },
  { phrase: 'shadow ai risks', weeks: [week('2026-10-31', 70, 70)] },
  { phrase: 'what is a dpia', weeks: [week('2026-10-17', 3, 4), week('2026-10-31', 4, 6)] },
  { phrase: 'dpia template', weeks: [] },
  { phrase: 'a | b', weeks: [] },
];

const model = (stats = STATS, options = {}) =>
  buildKeywords({ measured: '2026-11-08', market: MARKET, stats, routes: ROUTES, ...options });
const report = (stats, options) => renderKeywords(model(stats, options));
const tableWith = (markdown, ...names) =>
  tablesIn(markdown).find(({ header }) => names.every((name) => header.includes(name)));

test('the head states the date, the window, the market, the totals and the run, each on its own line', () => {
  const lines = report().split('\n');

  assert.equal(lines[0], '# Keyword demand: what Bing Webmaster Tools measured');
  assert.ok(lines.includes('Measured: 2026-11-08 (window 2026-10-17 to 2026-10-31)'));
  assert.ok(lines.includes('Market: country us, language en-US'));
  assert.ok(lines.includes('Totals: phrases priced 5, with an exact impression 3, candidates 1'));
  assert.ok(lines.includes('Run: phrases built 5, priced this run 5, carried from the cache 0, never answered 0'));
});

test('the document states both limits itself, so no reader takes a zero for a veto or a phrase for a proposal', () => {
  const text = report();

  assert.match(
    text,
    /Bing's index is smaller than Google's, so a phrase that reads 0 is weak evidence and never a veto/
  );
  assert.match(text, /prices phrases and never proposes one/);
  assert.match(text, /npm run audit:keywords/);
});

test('the phrase table lists every priced phrase in the order of the model, with its counts, weeks, day measured and routes', () => {
  const found = tableWith(report(), 'Phrase', 'Served by');

  assert.deepEqual(found.header, ['Phrase', 'Exact', 'Broad', 'Weeks', 'Measured', 'Served by']);
  assert.deepEqual(found.rows, [
    ['what is shadow ai', '1760', '2000', '2', '2026-11-08', '`/glossary/shadow-ai`'],
    ['shadow ai risks', '70', '70', '1', '2026-11-08', '-'],
    ['what is a dpia', '7', '10', '2', '2026-11-08', '`/blog/a-dpia-guide`, `/glossary/dpia`'],
    ['a | b', '0', '0', '0', '2026-11-08', '-'],
    ['dpia template', '0', '0', '0', '2026-11-08', '-'],
  ]);
});

test('a phrase that holds a pipe is escaped so it cannot split its row', () => {
  const markdown = report();

  assert.ok(markdown.includes('| a \\| b'));
  assert.equal(tableWith(markdown, 'Phrase', 'Served by').rows.length, 5);
});

test('the candidates section lists the phrases with volume and no route, in table order, with no route column', () => {
  const markdown = report();
  const found = tableWith(markdown, 'Phrase', 'Exact', 'Broad');
  const candidates = tablesIn(markdown).find(({ header }) => !header.includes('Served by'));

  assert.ok(found);
  assert.deepEqual(candidates.header, ['Phrase', 'Exact', 'Broad']);
  assert.deepEqual(candidates.rows, [['shadow ai risks', '70', '70']]);
  assert.match(markdown, /\n## Candidates\n/);
  assert.match(markdown, /Phrases with an exact impression that no route serves: 1, most first\./);
});

test('a measurement with no candidate says so and writes no second table', () => {
  const markdown = report([STATS[0], STATS[2]]);

  assert.match(markdown, /No phrase with an exact impression lacks a route that serves it\./);
  assert.equal(tablesIn(markdown).length, 1);
});

test('a run that returned no weekly row at all has no window, and the document says why', () => {
  const markdown = report([{ phrase: 'a phrase', weeks: [] }]);

  assert.ok(markdown.split('\n').includes('Measured: 2026-11-08'));
  assert.match(markdown, /Bing returned no weekly row for any phrase, so this run has no window\./);
  assert.doesNotMatch(markdown, /\(window /);
});

test('the phrase table comes before the candidates, and the whole report ends in one newline', () => {
  const markdown = report();

  assert.ok(markdown.indexOf('## Phrases') < markdown.indexOf('## Candidates'));
  assert.ok(markdown.endsWith('|\n'));
  assert.equal(markdown, report());
});

test('the first twenty-five lines already show the top of the phrase table, once the provenance line is added', () => {
  const withProvenance = ['', 'Generated-from: abc1234', ''].join('\n');
  const [title, ...rest] = report().split('\n');
  const lines = [title, ...withProvenance.split('\n'), ...rest].slice(0, 25);

  assert.ok(
    lines.some((line) => line.startsWith('| what is shadow ai ')),
    lines.join('\n')
  );
});

const CARRIED = [
  { phrase: 'shadow ai examples', exact: 40, broad: 80, weeks: 6, measured: '2026-10-20' },
  { phrase: 'dpia checklist', exact: 3, broad: 5, weeks: 2, measured: '2026-10-04' },
];
const UNMEASURED = ['what is data classification', 'a | pipe', 'dpia policy'];
const partial = () => report(STATS.slice(0, 3), { carried: CARRIED, unmeasured: UNMEASURED });

test('a carried phrase shows the day it was measured, not the day of the run, and the table says what that day means', () => {
  const markdown = partial();
  const found = tableWith(markdown, 'Phrase', 'Served by');

  assert.deepEqual(
    found.rows.map(([phrase, , , , measured]) => [phrase, measured]),
    [
      ['what is shadow ai', '2026-11-08'],
      ['shadow ai risks', '2026-11-08'],
      ['shadow ai examples', '2026-10-20'],
      ['what is a dpia', '2026-11-08'],
      ['dpia checklist', '2026-10-04'],
    ]
  );
  assert.match(markdown, /Measured is the day Bing was asked for the phrase\./);
  assert.match(markdown, /keeps its figures and that day, costs no request/);
  assert.match(markdown, /`keywords\.maxAgeDays`/);
});

test('the run line counts what was priced now, what was carried from the cache and what Bing never answered for', () => {
  const lines = partial().split('\n');

  assert.ok(
    lines.includes('Run: phrases built 8, priced this run 3, carried from the cache 2, never answered 3'),
    lines.filter((line) => line.startsWith('Run:')).join()
  );
  assert.ok(lines.includes('Totals: phrases priced 5, with an exact impression 5, candidates 3'));
});

test('a partial run says so plainly in the head: how many phrases are missing, that they are unknown and not zero, and where they are named', () => {
  const lines = partial().split('\n');
  const note = lines.find((line) => line.startsWith('Partial run:'));

  assert.equal(
    note,
    'Partial run: Bing throttled the key, so it never answered for 3 of 8 phrases. They are not zero-volume phrases: their volume is unknown. The report lists them under Not measured, and the next run asks Bing for them again.'
  );
  assert.ok(lines.indexOf(note) < lines.indexOf('## Phrases'));
});

test('the phrases Bing never answered for are named in a table of their own, in alphabetical order, and a pipe cannot split a row', () => {
  const markdown = partial();
  const named = tablesIn(markdown).find(({ header }) => header.length === 1);

  assert.deepEqual(named.header, ['Phrase']);
  assert.deepEqual(named.rows, [['a | pipe'], ['dpia policy'], ['what is data classification']]);
  assert.match(markdown, /\n## Not measured\n/);
  assert.match(
    markdown,
    /Phrases Bing never answered for: 3, in alphabetical order\. This report holds no figure for any of them: each is unknown, not zero\./
  );
  assert.ok(markdown.includes('| a \\| pipe'));
});

test('the unmeasured table comes last, after the phrases and the candidates, and is not taken for either of them', () => {
  const markdown = partial();
  const tables = tablesIn(markdown);

  assert.ok(markdown.indexOf('## Candidates') < markdown.indexOf('## Not measured'));
  assert.deepEqual(
    tables.map(({ header }) => header),
    [['Phrase', 'Exact', 'Broad', 'Weeks', 'Measured', 'Served by'], ['Phrase', 'Exact', 'Broad'], ['Phrase']]
  );
  assert.ok(markdown.endsWith('|\n'));
});

test('a run that missed nothing writes no partial note and no Not measured section', () => {
  for (const markdown of [report(), report(STATS, { carried: CARRIED })]) {
    assert.doesNotMatch(markdown, /Partial run:/);
    assert.doesNotMatch(markdown, /Not measured/);
    assert.match(markdown, /never answered 0\n/);
  }
});

test('a run that priced nothing says it has no window of its own, and says it for a reason other than an empty answer', () => {
  const markdown = report([], { carried: CARRIED });
  const empty = report([{ phrase: 'a phrase', weeks: [] }]);

  assert.ok(markdown.split('\n').includes('Measured: 2026-11-08'));
  assert.match(markdown, /No phrase was priced this run, so this run has no window\./);
  assert.doesNotMatch(markdown, /Bing returned no weekly row/);
  assert.match(empty, /Bing returned no weekly row for any phrase, so this run has no window\./);
  assert.doesNotMatch(empty, /No phrase was priced this run/);
});

test('a run that priced nothing and carried nothing still writes the unmeasured list a partial run owes', () => {
  const markdown = report([], { unmeasured: ['a phrase'] });

  assert.match(markdown, /Run: phrases built 1, priced this run 0, carried from the cache 0, never answered 1/);
  assert.match(markdown, /Partial run: Bing throttled the key, so it never answered for 1 of 1 phrases\./);
});

test('the first twenty-five lines of a partial report still show the top of the phrase table, once the provenance line is added', () => {
  const [title, ...rest] = partial().split('\n');
  const lines = [title, '', 'Generated-from: abc1234', ...rest].slice(0, 25);

  assert.ok(
    lines.some((line) => line.startsWith('| what is shadow ai ')),
    lines.join('\n')
  );
});
