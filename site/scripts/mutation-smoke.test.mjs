import test from 'node:test';
import assert from 'node:assert/strict';

import { label, tally } from './mutation-smoke.mjs';

const proven = (id) => ({ id, ok: true, reason: 'guard failed on the specimen' });

test('the tally counts families proven, never the synthetic baseline row', () => {
  const results = [
    { id: 'baseline-green-copy', ok: true, reason: 'pristine copy builds green' },
    proven('a'),
    proven('b'),
  ];
  assert.equal(tally(results, 2, 40), 'mutation smoke: 2/2 families proven in 40s');
});

test('a skipped family is never reported as proven, because --fast must not read as a full run', () => {
  const results = [
    { id: 'baseline-green-copy', ok: true, reason: 'pristine copy builds green' },
    proven('a'),
    { id: 'slow-one', skipped: true, reason: 'skipped: --fast' },
  ];
  assert.equal(tally(results, 2, 9), 'mutation smoke: 1/2 families proven, 1 skipped in 9s');
  assert.equal(label(results[2]), 'skip');
});

test('a failed family is named in the tally', () => {
  const results = [proven('a'), { id: 'b', ok: false, reason: 'guard stayed green on the specimen' }];
  assert.equal(tally(results, 2, 30), 'mutation smoke: 1/2 families proven, 1 FAILED in 30s');
  assert.equal(label(results[1]), 'FAIL');
});
