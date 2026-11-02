import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as cost from './writer-cost.mjs';
import { WriterError } from './writer-error.mjs';

const { costUsd } = cost;

const refusal = (call) => {
  try {
    call();
  } catch (error) {
    return error;
  }
  return assert.fail('the call did not throw');
};

const terra = { inputPerMillion: 1, outputPerMillion: 5 };

test('the module exports only costUsd', () => {
  assert.deepEqual(Object.keys(cost), ['costUsd']);
});

test('costUsd: exact dollars from the configured rates', () => {
  assert.equal(costUsd({ inputPerMillion: 4, outputPerMillion: 20 }, { input: 1_000_000, output: 1_000_000 }), 24);
  assert.equal(costUsd(terra, { input: 1_000_000, output: 0 }), 1);
  assert.equal(costUsd(terra, { input: 0, output: 1_000_000 }), 5);
  assert.equal(costUsd(terra, { input: 0, output: 0 }), 0);
  assert.equal(costUsd(terra, { input: 12_345, output: 6_789 }), 0.04629);
  assert.equal(costUsd(terra, { input: 32_000, output: 32_000 }), 0.192);
  assert.equal(costUsd({ inputPerMillion: 0.1, outputPerMillion: 0.5 }, { input: 123_457, output: 7_654 }), 0.016173);
});

test('costUsd rounds to six decimals', () => {
  assert.equal(costUsd(terra, { input: 1, output: 0 }), 0.000001);
  assert.equal(costUsd({ inputPerMillion: 0.1, outputPerMillion: 0.5 }, { input: 1, output: 0 }), 0);
  assert.equal(costUsd({ inputPerMillion: 0.1, outputPerMillion: 0.5 }, { input: 5, output: 0 }), 0.000001);
});

test('costUsd rejects negative, fractional and non-numeric token counts', () => {
  const bad = [-1, 1.5, NaN, Infinity, '10', null, undefined, 2 ** 60];
  for (const value of bad) {
    for (const usage of [
      { input: value, output: 1 },
      { input: 1, output: value },
    ]) {
      const error = refusal(() => costUsd(terra, usage));
      assert.ok(error instanceof WriterError, String(value));
      assert.equal(error.kind, 'price');
    }
  }
});
