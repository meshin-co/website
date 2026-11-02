import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filesOf, ledgerOf, mergedLedger, recordOf, recordPath, writingCall } from './fixtures/spend-report-corpus.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { REPORT_PATH, reportMarkdown, reportText, slackMessage, tokenText, usdText } from './spend-report-text.mjs';

const NEWEST = '2026-11-02T07:00:00.000Z';
const TERM_AT = '2026-11-02T07:00:01.000Z';

const DRAFT = writingCall({ input: 12000, output: 3000, tag: 'draft' });
const CORRECTION = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });
const TERM_DRAFT = writingCall({ input: 6000, output: 1200, tag: 'term' });

const post = recordOf({ slug: 'a-post', at: NEWEST, calls: [DRAFT, CORRECTION] });
const term = recordOf({ slug: 'a-term', format: 'term', at: TERM_AT, ledgerSlug: 'a-post', calls: [TERM_DRAFT] });
const ledger = ledgerOf({ slug: 'a-post', calls: [...post.calls, ...term.calls] });

const corpusFor = (parts) => corpusOf(filesOf(parts));
const modelFor = (parts) => reportModel(corpusFor(parts));
const populated = () => modelFor({ ledgers: [ledger], records: [term, post] });
const empty = () => modelFor({});

const headingsOf = (markdown) =>
  markdown
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3));

function sectionOf(markdown, title) {
  const lines = markdown.split('\n');
  const start = lines.indexOf(`## ${title}`);
  assert.notEqual(start, -1, `no section "${title}"`);
  const length = lines.slice(start + 1).findIndex((line) => line.startsWith('## '));
  return lines.slice(start + 1, length === -1 ? undefined : start + 1 + length);
}

const cellsOf = (line) =>
  line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
const rowsOf = (markdown, title) =>
  sectionOf(markdown, title)
    .filter((line) => line.startsWith('|'))
    .map(cellsOf)
    .slice(2);
const headerOf = (markdown, title) => cellsOf(sectionOf(markdown, title).find((line) => line.startsWith('|')));
const proseOf = (markdown, title) =>
  sectionOf(markdown, title)
    .filter((line) => line !== '' && !line.startsWith('|'))
    .join(' ');

test('money is shown as the exact decimal of whole micro-dollars, at least two decimals and never an exponent', () => {
  for (const [micro, text] of [
    [0, '0.00'],
    [1, '0.000001'],
    [10, '0.00001'],
    [62000, '0.062'],
    [300000, '0.30'],
    [1500000, '1.50'],
    [25000000, '25.00'],
    [123456789, '123.456789'],
    [9007199254740991, '9007199254.740991'],
  ])
    assert.equal(usdText(micro), text, String(micro));
  for (const bad of [0.5, -1, '5', Number.NaN, null, Number.POSITIVE_INFINITY])
    assert.throws(() => usdText(bad), /whole number of micro-dollars/, String(bad));
});

test('tokens are grouped in thousands, and a small count is left alone', () => {
  for (const [count, text] of [
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [31000, '31,000'],
    [1234567, '1,234,567'],
  ])
    assert.equal(tokenText(count), text);
});

test('the report is written to the one path the gate and the pipeline both name', () => {
  assert.equal(REPORT_PATH, 'audits/spend-report.md');
});

test('with nothing generated the file says so in words and carries no number at all', () => {
  const markdown = reportMarkdown(empty());
  assert.deepEqual(headingsOf(markdown), ['No entry yet']);
  assert.match(
    proseOf(markdown, 'No entry yet'),
    /^No entry has been generated, so this file holds no row, no total and no rate\./
  );
  assert.match(markdown, /It is not a cost of zero\./);
  assert.doesNotMatch(markdown, /\d/);
  assert.equal(markdown.split('\n').filter((line) => line.startsWith('|')).length, 0, 'a table holds a row of zeros');
});

test('with only unreadable files the file does not claim that nothing was generated, and lists what it could not count', () => {
  const unreadable = reportMarkdown(
    reportModel(corpusOf({ ledgers: [], records: [{ path: recordPath('broken'), text: '{not json' }] }))
  );
  assert.deepEqual(headingsOf(unreadable), ['No entry yet', 'Warnings']);
  assert.doesNotMatch(unreadable, /No entry has been generated/);
  assert.match(
    proseOf(unreadable, 'No entry yet'),
    /^No generation record could be counted, so this file holds no row, no total and no rate\./
  );
  assert.deepEqual(
    sectionOf(unreadable, 'Warnings').filter((line) => line.startsWith('- ')),
    [`- ${recordPath('broken')} is not counted: it is not readable JSON`]
  );
});

test('a populated report has the three windows first, then every entry and the rates, and no warning section when all is well', () => {
  const markdown = reportMarkdown(populated());
  assert.deepEqual(headingsOf(markdown), ['This entry', 'Last 30 days', 'All time', 'Every entry', 'Rates']);
  assert.equal(markdown.split('\n')[0], '# Spend report: what writing each entry cost');
  assert.equal(markdown.split('\n')[1], '');
});

test('this entry lists each entry of the newest run in the order it was written, with its own figures', () => {
  const markdown = reportMarkdown(populated());
  assert.deepEqual(headerOf(markdown, 'This entry'), [
    'Generated (UTC)',
    'Format',
    'Slug',
    'Input tokens',
    'Output tokens',
    'Cost (USD)',
  ]);
  assert.deepEqual(rowsOf(markdown, 'This entry'), [
    [NEWEST, 'article', 'a-post', '25,000', '5,000', '0.05'],
    [TERM_AT, 'term', 'a-term', '6,000', '1,200', '0.012'],
  ]);
  assert.match(proseOf(markdown, 'This entry'), new RegExp(`generated at ${TERM_AT}`));
});

test('each window totals all its entries and then each format, and defines its own boundaries as instants', () => {
  const markdown = reportMarkdown(populated());
  const header = ['Format', 'Entries', 'Input tokens', 'Output tokens', 'Cost (USD)'];
  const totals = [
    ['all', '2', '31,000', '6,200', '0.062'],
    ['article', '1', '25,000', '5,000', '0.05'],
    ['term', '1', '6,000', '1,200', '0.012'],
  ];
  for (const title of ['Last 30 days', 'All time']) {
    assert.deepEqual(headerOf(markdown, title), header, title);
    assert.deepEqual(rowsOf(markdown, title), totals, title);
  }
  const thirty = proseOf(markdown, 'Last 30 days');
  assert.match(thirty, /after 2026-10-03T07:00:01\.000Z and through 2026-11-02T07:00:01\.000Z/);
  assert.match(thirty, /The start is excluded and the end is included/);
  assert.match(thirty, /an entry generated exactly at the start is outside/);
  assert.match(
    proseOf(markdown, 'All time'),
    /from 2026-11-02T07:00:00\.000Z, the oldest record, through 2026-11-02T07:00:01\.000Z, the newest/
  );
});

test('the thirty days say they are not the calendar month of the spend ceiling, and that they end at the newest entry and not the clock', () => {
  const thirty = proseOf(reportMarkdown(populated()), 'Last 30 days');
  assert.match(thirty, /not the UTC calendar month of the monthly spend ceiling/);
  assert.match(thirty, /counts spend that no entry carries/);
  assert.match(thirty, /ends at the newest record and not at the clock/);
});

test('every entry is one row per record, newest first, and the rates name the model and both rates once', () => {
  const markdown = reportMarkdown(populated());
  assert.deepEqual(rowsOf(markdown, 'Every entry'), [
    [TERM_AT, 'term', 'a-term', '6,000', '1,200', '0.012'],
    [NEWEST, 'article', 'a-post', '25,000', '5,000', '0.05'],
  ]);
  assert.deepEqual(headerOf(markdown, 'Rates'), [
    'Model',
    'Input USD per million tokens',
    'Output USD per million tokens',
    'Entries',
    'First',
    'Last',
  ]);
  assert.deepEqual(rowsOf(markdown, 'Rates'), [['gpt-6.1-terra-2026-10-01', '1', '5', '2', NEWEST, TERM_AT]]);
});

test('the definitions state what is counted and what is not, in the file itself', () => {
  const markdown = reportMarkdown(populated());
  assert.match(markdown, /Cost means the cost of the writing calls of an entry: its draft and its correction/);
  assert.match(markdown, /A repair call is not a writing call and is not counted here/);
  assert.match(
    markdown,
    /A draft that a run wrote and then skipped, and a run that stopped before any entry existed, have no entry and are not counted here either/
  );
  assert.match(markdown, /the monthly spend ceiling counts it/);
  assert.match(markdown, /It reads no clock and no network/);
});

test('a warning becomes one list item under its own heading, and the entries that can be counted are still totalled', () => {
  const orphan = mergedLedger(ledgerOf({ slug: 'lost-post', calls: [DRAFT] }));
  const model = modelFor({ ledgers: [ledger, orphan], records: [term, post] });
  const markdown = reportMarkdown(model);
  assert.deepEqual(headingsOf(markdown), [
    'This entry',
    'Last 30 days',
    'All time',
    'Every entry',
    'Rates',
    'Warnings',
  ]);
  assert.deepEqual(
    sectionOf(markdown, 'Warnings').filter((line) => line.startsWith('- ')),
    model.warnings.map((sentence) => `- ${sentence}`)
  );
  assert.equal(model.warnings.length, 1);
  assert.deepEqual(rowsOf(markdown, 'All time')[0], ['all', '2', '31,000', '6,200', '0.062']);
});

test('the same model renders to the same text every time, on any day, and ends in one newline with no trailing space', (t) => {
  const first = reportMarkdown(populated());
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2031-05-05T12:00:00Z') });
  const second = reportMarkdown(populated());
  assert.equal(second, first);
  assert.ok(first.endsWith('\n') && !first.endsWith('\n\n'));
  assert.ok(first.split('\n').every((line) => line === line.trimEnd()));
  assert.doesNotMatch(first, /\t/);
});

test('a report text is the markdown with the stamp the evidence gate requires, on the third line', () => {
  const text = reportText(filesOf({ ledgers: [ledger], records: [term, post] }), '3fa620f');
  const lines = text.split('\n');
  assert.equal(lines[0], '# Spend report: what writing each entry cost');
  assert.deepEqual(lines.slice(1, 4), ['', 'Generated-from: 3fa620f', '']);
  assert.equal(text.replace('Generated-from: 3fa620f\n\n', ''), reportMarkdown(populated()));
});

const ENTRIES = (...slugs) =>
  populated()
    .rows.filter(({ slug }) => slugs.includes(slug))
    .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt));

test('the Slack message holds this entry, the 30 days and all time as plain lines of numbers and units', () => {
  assert.equal(
    slackMessage(populated(), ENTRIES('a-post', 'a-term')),
    [
      'This entry',
      'article a-post: 25,000 input tokens, 5,000 output tokens, 0.05 USD',
      'term a-term: 6,000 input tokens, 1,200 output tokens, 0.012 USD',
      '',
      'Last 30 days, to 2026-11-02T07:00:01.000Z',
      'all: 2 entries, 31,000 input tokens, 6,200 output tokens, 0.062 USD',
      'article: 1 entry, 25,000 input tokens, 5,000 output tokens, 0.05 USD',
      'term: 1 entry, 6,000 input tokens, 1,200 output tokens, 0.012 USD',
      '',
      'All time, since 2026-11-02T07:00:00.000Z',
      'all: 2 entries, 31,000 input tokens, 6,200 output tokens, 0.062 USD',
      'article: 1 entry, 25,000 input tokens, 5,000 output tokens, 0.05 USD',
      'term: 1 entry, 6,000 input tokens, 1,200 output tokens, 0.012 USD',
      '',
      'The 30 days end at the newest entry. They are not the calendar month of the spend ceiling.',
    ].join('\n')
  );
});

test('the Slack message has no table, no emphasis, no link and no currency sign', () => {
  const message = slackMessage(populated(), ENTRIES('a-post', 'a-term'));
  assert.doesNotMatch(message, /[|*_`>#~$<]/);
  assert.doesNotMatch(message, /https?:/);
  assert.ok(message.split('\n').every((line) => line === line.trimEnd()));
});

test('the entries of the message are the ones it is given, so a post that shipped alone is reported alone', () => {
  const message = slackMessage(populated(), ENTRIES('a-post'));
  const [, first, blank] = message.split('\n');
  assert.equal(first, 'article a-post: 25,000 input tokens, 5,000 output tokens, 0.05 USD');
  assert.equal(blank, '');
  assert.doesNotMatch(message.split('\n\n')[0], /a-term/);
});

test('warnings join the message, capped at three with a count of the rest, and a clean corpus adds none', () => {
  assert.doesNotMatch(slackMessage(populated(), ENTRIES('a-post')), /Warnings/);
  const orphans = ['one', 'two', 'three', 'four', 'five'].map((name) =>
    mergedLedger(ledgerOf({ slug: `lost-${name}`, calls: [DRAFT] }))
  );
  const model = modelFor({ ledgers: [ledger, ...orphans], records: [term, post] });
  assert.equal(model.warnings.length, 5);
  const blocks = slackMessage(model, ENTRIES('a-post')).split('\n\n');
  assert.deepEqual(blocks.at(-1).split('\n'), [
    'Warnings: 5',
    ...model.warnings.slice(0, 3),
    `and 2 more in ${REPORT_PATH}`,
  ]);
  const three = reportModel({
    ...corpusFor({ ledgers: [ledger], records: [term, post] }),
    problems: model.warnings.slice(0, 3),
  });
  assert.deepEqual(slackMessage(three, ENTRIES('a-post')).split('\n\n').at(-1).split('\n'), [
    'Warnings: 3',
    ...three.warnings,
  ]);
});

test('a message is never built from an empty model: there is no window to total', () => {
  assert.throws(() => slackMessage(empty(), []), /no entry/);
});
