import assert from 'node:assert/strict';
import { test } from 'node:test';

import { promptGapRows } from './generate-gaps.mjs';

const tableWith = (rows) =>
  [
    '### GAP register — feeds Phase 6 content plans',
    '',
    '| # | Prompt | Gap | Planned source |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');

test('a GAP register row using recognised phrasing is kept', () => {
  const doc = tableWith(['| 19 | MCP security best practices | No route at all | new glossary term |']);

  assert.deepEqual(promptGapRows(doc), ['MCP security best practices — No route at all']);
});

test('a declared GAP register row whose phrasing the allowlist does not recognise is an error, not a silent drop', () => {
  const doc = tableWith([
    '| 19 | MCP security best practices | No route at all | new glossary term |',
    '| 2 | fractional vs full-time cost | No cost-shape comparison article | PRD row |',
  ]);

  assert.throws(() => promptGapRows(doc), /fractional vs full-time cost.*No cost-shape comparison article/s);
});
