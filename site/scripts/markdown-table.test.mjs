import assert from 'node:assert/strict';
import { test } from 'node:test';

import { table } from './markdown-table.mjs';

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
