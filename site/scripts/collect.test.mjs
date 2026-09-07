import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolvePhase } from './collect-reports.mjs';

test('an explicit phase is used as the audit destination', () => {
  assert.equal(resolvePhase('2'), '2');
});

test('a missing phase is refused instead of overwriting phase 1', () => {
  assert.throws(() => resolvePhase(undefined), /GATE_PHASE/);
  assert.throws(() => resolvePhase(''), /GATE_PHASE/);
});
