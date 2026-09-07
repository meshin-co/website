import assert from 'node:assert/strict';
import { test } from 'node:test';

import { yearsShipping } from '../src/utils/experience.mjs';

test('the year count grows with the clock instead of being fixed', () => {
  assert.equal(yearsShipping(Date.UTC(2026, 8, 8)), 18);
  assert.equal(yearsShipping(Date.UTC(2031, 0, 2)), 23);
});

test('the count never reads as a full year before the anniversary', () => {
  assert.equal(yearsShipping(Date.UTC(2025, 11, 31)), 17);
});
