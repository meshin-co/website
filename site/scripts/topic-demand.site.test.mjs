import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { MIN_IMPRESSIONS, STRENGTHEN_BAND } from './topic-demand.mjs';

test('the band and the floor are the numbers locked row L61 states', () => {
  const locked = readFileSync(new URL('../../docs/plan/reference/locked-decisions.md', import.meta.url), 'utf8');
  const row61 = locked.split('\n').find((line) => line.startsWith('| L61 '));
  assert.ok(
    row61.includes('a query with impressions and a position from ' + STRENGTHEN_BAND.min + ' to ' + STRENGTHEN_BAND.max)
  );
  assert.equal(MIN_IMPRESSIONS, 1);
});
