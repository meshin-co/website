import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolvePhase, targetDir } from './collect-reports.mjs';

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

test('an unsharded run writes the plain form-factor directory', () => {
  assert.equal(targetDir('mobile', { GATE_PHASE: 'ci' }), '../audits/phase-ci/lh-mobile');
});

test('a sharded run writes its own directory so parallel shards cannot wipe each other', () => {
  const env = { GATE_PHASE: 'ci', LH_SHARD_INDEX: '3', LH_SHARD_TOTAL: '4' };
  assert.equal(targetDir('desktop', env), '../audits/phase-ci/lh-desktop/shard-3');
});
