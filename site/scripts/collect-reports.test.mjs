import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolvePhase } from './collect-reports.mjs';

test('a phase already carrying its prefix is not prefixed twice', () => {
  assert.equal(resolvePhase('phase-4.5'), '4.5');
  assert.equal(resolvePhase('phase-2'), '2');
});

test('a bare phase name is accepted unchanged', () => {
  assert.equal(resolvePhase('4.5'), '4.5');
  assert.equal(resolvePhase('ci'), 'ci');
});

test('a missing phase is refused rather than writing to an unnamed directory', () => {
  assert.throws(() => resolvePhase(undefined), /GATE_PHASE/);
});
