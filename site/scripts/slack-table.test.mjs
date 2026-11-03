import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PHONE_COLUMNS, monoTable, widthOf } from './slack-table.mjs';

test('a label column is left-aligned and a column of counts is right-aligned, so magnitudes can be compared', () => {
  const lines = monoTable({
    header: ['Tokens', 'input', 'output'],
    align: ['left', 'right', 'right'],
    rows: [
      ['all', '31,000', '6,200'],
      ['article', '25,000', '5,000'],
      ['term', '6,000', '1,200'],
    ],
  });
  assert.deepEqual(lines, [
    'Tokens    input  output',
    'all      31,000   6,200',
    'article  25,000   5,000',
    'term      6,000   1,200',
  ]);
});

test('a column of money lines up on the decimal point, whatever the length of each figure', () => {
  const lines = monoTable({
    header: ['', 'USD'],
    align: ['left', 'decimal'],
    rows: [
      ['Spent', '0.022748'],
      ['Ceiling', '25.00'],
      ['Left', '24.977252'],
    ],
  });
  assert.deepEqual(lines, ['               USD', 'Spent     0.022748', 'Ceiling  25.00', 'Left     24.977252']);
  const points = lines.slice(1).map((line) => line.indexOf('.'));
  assert.equal(new Set(points).size, 1, points.join());
});

test('a word in a decimal column ends where the integer part of the figures ends', () => {
  const lines = monoTable({
    header: ['k', 'USD'],
    align: ['left', 'decimal'],
    rows: [
      ['a', '1234.5'],
      ['b', '7'],
      ['c', 'none'],
    ],
  });
  assert.deepEqual(lines, ['k     USD', 'a  1234.5', 'b     7', 'c  none']);
});

test('a header wider than its figures is right-aligned over them, and the figures stay right-aligned under it', () => {
  const lines = monoTable({
    header: ['', 'USD'],
    align: ['left', 'decimal'],
    rows: [
      ['x', '1'],
      ['y', '22'],
    ],
  });
  assert.deepEqual(lines, ['   USD', 'x    1', 'y   22']);
});

test('a line never ends in a space, and a table with no row is its header alone', () => {
  const lines = monoTable({
    header: ['a', 'b'],
    align: ['left', 'decimal'],
    rows: [
      ['x', '1.5'],
      ['yy', '22.25'],
    ],
  });
  for (const line of lines) assert.equal(line, line.trimEnd());
  assert.deepEqual(monoTable({ header: ['only', 'header'], align: ['left', 'right'], rows: [] }), ['only  header']);
});

test('the width of a table is its longest line', () => {
  const lines = monoTable({
    header: ['Entries', 'USD'],
    align: ['left', 'decimal'],
    rows: [
      ['all', '12.345'],
      ['article', '9.1'],
    ],
  });
  assert.equal(widthOf(lines), Math.max(...lines.map((line) => line.length)));
  assert.equal(widthOf([]), 0);
});

test('a row with a different number of cells than the header is refused, and so is a missing alignment', () => {
  assert.throws(() => monoTable({ header: ['a', 'b'], align: ['left', 'left'], rows: [['x']] }), /2 cells/);
  assert.throws(() => monoTable({ header: ['a', 'b'], align: ['left'], rows: [] }), /align/);
  assert.throws(() => monoTable({ header: ['a'], align: ['middle'], rows: [] }), /align/);
});

test('the width a phone can show is one number that every message is held to', () => {
  assert.equal(PHONE_COLUMNS, 34);
});
