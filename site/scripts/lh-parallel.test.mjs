import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deadlineMs, shardPlan, workerCount } from './lh-parallel.mjs';

test('every form factor is sharded, and each shard gets its own port', () => {
  const plan = shardPlan({ factors: ['mobile', 'desktop'], shards: 3, basePort: 4330 });

  assert.equal(plan.length, 6);
  assert.deepEqual(plan[0], { factor: 'mobile', index: 1, total: 3, port: 4330 });
  assert.deepEqual(plan.at(-1), { factor: 'desktop', index: 3, total: 3, port: 4335 });
  assert.equal(new Set(plan.map((shard) => `${shard.factor}-${shard.port}`)).size, 6);
});

test('a shard count is never more than the cores can measure honestly', () => {
  assert.equal(workerCount({ cores: 16, requested: undefined }), 4);
  assert.equal(workerCount({ cores: 4, requested: undefined }), 1);
  assert.equal(workerCount({ cores: 16, requested: 8 }), 8);
  assert.equal(workerCount({ cores: 16, requested: 0 }), 1);
});

test('nothing is killed before a shard has had its floor', () => {
  assert.equal(deadlineMs({ done: [], floorMs: 600_000 }), 600_000);
  assert.equal(deadlineMs({ done: [60_000], floorMs: 600_000 }), 600_000);
});

test('once shards have finished, a straggler is judged against them', () => {
  const deadline = deadlineMs({ done: [400_000, 500_000, 600_000], floorMs: 60_000 });

  assert.equal(deadline, 1_250_000);
});
