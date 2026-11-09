import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cellText, code, codes, recordsOf, table, tableWith, tablesIn } from './markdown-table.mjs';

test('a rendered table is what prettier would write, so a formatter run is never drift', async () => {
  const prettier = await import('prettier');
  const rendered = table(
    ['Route', 'Query', 'To'],
    [
      ['`/pricing`', 'what a fractional chief ai officer costs', 'b'],
      ['`/`', 'x', 'y'],
    ]
  );

  assert.equal((await prettier.format(rendered, { parser: 'markdown' })).trim(), rendered.trim());
});

test('every column is at least three dashes wide, which is prettier’s floor', () => {
  const rendered = table(['A', 'B'], [['x', 'y']]);

  assert.match(rendered.split('\n')[1], /^\| --- \| --- \|$/);
});

test('a numeric cell renders like any other, rather than crashing the generator', () => {
  const rendered = table(['Route', 'Links'], [['`/`', 7]]);

  assert.match(rendered, /\| 7 {5}\|/);
});

test('a table written by table() is read back with its header and its rows', () => {
  const written = table(
    ['Route', 'Query'],
    [
      ['`/a`', 'first'],
      ['`/b`', 'second'],
    ]
  );

  assert.deepEqual(tablesIn(`# Title\n\n${written}\n\nAfter.\n`), [
    {
      header: ['Route', 'Query'],
      rows: [
        ['`/a`', 'first'],
        ['`/b`', 'second'],
      ],
    },
  ]);
});

test('an escaped pipe stays inside its cell and the cell is read without the backslash', () => {
  const [{ rows }] = tablesIn(['| A | B |', '| --- | --- |', '| x \\| y | z |'].join('\n'));

  assert.deepEqual(rows, [['x | y', 'z']]);
});

test('two tables are found in document order, each with only its own rows', () => {
  const markdown = [
    '| A |',
    '| - |',
    '| 1 |',
    '',
    'text',
    '',
    '| B | C |',
    '| :-- | --: |',
    '| 2 | 3 |',
    '| 4 | 5 |',
  ].join('\n');

  assert.deepEqual(
    tablesIn(markdown).map(({ header, rows }) => [header, rows.length]),
    [
      [['A'], 1],
      [['B', 'C'], 2],
    ]
  );
});

test('a pipe line with no delimiter row under it is not a table', () => {
  assert.deepEqual(tablesIn('| a | b |\n| c | d |\n'), []);
  assert.deepEqual(tablesIn(''), []);
});

test('a table that ends the document without a newline keeps its last row', () => {
  const [{ rows }] = tablesIn('| A |\n| --- |\n| 1 |\n| 2 |');

  assert.deepEqual(rows, [['1'], ['2']]);
});

test('tableWith picks the first table that has every named column and none of the excluded ones', () => {
  const tables = [
    { header: ['Query', 'Page'], rows: [] },
    { header: ['Page', 'Impressions', 'Query'], rows: [] },
    { header: ['Page', 'Impressions'], rows: [] },
  ];

  assert.equal(tableWith(tables, ['Page', 'Impressions']), tables[1]);
  assert.equal(tableWith(tables, ['Page', 'Impressions'], ['Query']), tables[2]);
  assert.equal(tableWith(tables, ['Day']), undefined);
});

test('recordsOf names every cell by its column, pads a short row and reads no table as no rows', () => {
  const found = { header: ['A', 'B'], rows: [['1', '2'], ['3']] };

  assert.deepEqual(recordsOf(found), [
    { A: '1', B: '2' },
    { A: '3', B: '' },
  ]);
  assert.deepEqual(recordsOf(undefined), []);
});

test('a route is written between backticks, a list of routes is comma separated, and no route is a dash', () => {
  assert.equal(code('/a'), '`/a`');
  assert.equal(codes(['/a', '/b']), '`/a`, `/b`');
  assert.equal(codes([]), '-');
});

test('a pipe in a cell is escaped so it cannot end the cell, and a number is written as text', () => {
  assert.equal(cellText('a | b'), 'a \\| b');
  assert.equal(cellText(7), '7');
  assert.deepEqual(tablesIn(table(['A'], [[cellText('x | y')]]))[0].rows, [['x | y']]);
});
