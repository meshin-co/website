import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRequire } from 'node:module';

const { gatePort } = createRequire(import.meta.url)('./lh-port.cjs');

test('a port the runner assigned is used as given, because the runner already spaced the shards', () => {
  assert.equal(gatePort({ GATE_SERVER_PORT: '4336', LH_SHARD_INDEX: '3', LH_SHARD_TOTAL: '4' }), 4336);
  assert.equal(gatePort({ GATE_SERVER_PORT: '4330', LH_SHARD_INDEX: '1', LH_SHARD_TOTAL: '4' }), 4330);
});

test('a shard run by hand, with no port assigned, still spaces itself off the base', () => {
  assert.equal(gatePort({ LH_SHARD_INDEX: '3', LH_SHARD_TOTAL: '4' }), 4332);
  assert.equal(gatePort({}), 4330);
});
