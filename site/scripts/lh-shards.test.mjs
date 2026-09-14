import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shardOf, shardRoutes } from './lh-shards.cjs';

const routes = ['/a', '/b', '/c', '/d', '/e', '/f', '/g'];

test('one shard audits every route', () => {
  assert.deepEqual(shardRoutes(routes, { index: 1, total: 1 }), routes);
});

test('shards partition the route list with no route lost or audited twice', () => {
  const total = 3;
  const union = [1, 2, 3].flatMap((index) => shardRoutes(routes, { index, total }));
  assert.deepEqual([...union].sort(), [...routes].sort());
  assert.equal(new Set(union).size, routes.length);
});

test('shard sizes differ by at most one so no runner carries the tail', () => {
  const sizes = [1, 2, 3].map((index) => shardRoutes(routes, { index, total: 3 }).length);
  assert.equal(Math.max(...sizes) - Math.min(...sizes) <= 1, true);
});

test('routes are dealt round robin, so adjacent heavy pages land on different shards', () => {
  assert.deepEqual(shardRoutes(routes, { index: 1, total: 3 }), ['/a', '/d', '/g']);
  assert.deepEqual(shardRoutes(routes, { index: 2, total: 3 }), ['/b', '/e']);
  assert.deepEqual(shardRoutes(routes, { index: 3, total: 3 }), ['/c', '/f']);
});

test('more shards than routes leaves the extra shards empty rather than failing', () => {
  assert.deepEqual(shardRoutes(['/a'], { index: 2, total: 4 }), []);
});

test('an out of range shard index is refused instead of silently auditing nothing', () => {
  assert.throws(() => shardRoutes(routes, { index: 0, total: 3 }), /shard/i);
  assert.throws(() => shardRoutes(routes, { index: 4, total: 3 }), /shard/i);
});

test('the environment reader defaults to the single unsharded run', () => {
  assert.deepEqual(shardOf({}), { index: 1, total: 1 });
  assert.deepEqual(shardOf({ LH_SHARD_INDEX: '2', LH_SHARD_TOTAL: '4' }), { index: 2, total: 4 });
});

test('a shard index without a total is a wiring mistake, not a default', () => {
  assert.throws(() => shardOf({ LH_SHARD_INDEX: '2' }), /LH_SHARD_TOTAL/);
});
