import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { PER_SHARD_BUDGET_BYTES, SUM_BUDGET_BYTES, discoverShards, shardBudgets } from './search-budget.mjs';

const distWith = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'search-budget-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
};

const clean = (dist) => rmSync(dist, { recursive: true, force: true });

const incompressible = (bytes) => randomBytes(bytes).toString('base64');

test('the single legacy index counts as the whole shard set and passes its budgets', () => {
  const dist = distWith({ 'search-index.json': JSON.stringify([{ href: '/blog/a' }]) });

  try {
    assert.deepEqual(discoverShards(dist), [join(dist, 'search-index.json')]);
    assert.equal(shardBudgets(dist).withinBudget, true);
  } finally {
    clean(dist);
  }
});

test('an oversized shard fails the per-shard budget even when it is the only shard', () => {
  const dist = distWith({ 'search-index-glossary.json': incompressible(PER_SHARD_BUDGET_BYTES + 8192) });

  try {
    const budgets = shardBudgets(dist);
    assert.equal(budgets.shards[0].withinBudget, false);
    assert.equal(budgets.withinBudget, false);
  } finally {
    clean(dist);
  }
});

test('shards each inside the per-shard cap still fail when their sum exceeds the sum cap', () => {
  const dist = distWith({
    'search-index-post.json': incompressible(50 * 1024),
    'search-index-glossary.json': incompressible(50 * 1024),
    'search-index-faq.json': incompressible(50 * 1024),
    'search-index-service.json': incompressible(50 * 1024),
    'search-index-page.json': incompressible(50 * 1024),
  });

  try {
    const budgets = shardBudgets(dist);
    assert.ok(
      budgets.shards.every((shard) => shard.withinBudget),
      'each fixture shard must stay under the per-shard cap'
    );
    assert.ok(budgets.sum > SUM_BUDGET_BYTES, `fixture sum ${budgets.sum} must exceed the sum cap ${SUM_BUDGET_BYTES}`);
    assert.equal(budgets.withinBudget, false);
  } finally {
    clean(dist);
  }
});

test('real shards win over a leftover legacy index', () => {
  const dist = distWith({ 'search-index.json': '[]', 'search-index-faq.json': '[]' });

  try {
    assert.deepEqual(discoverShards(dist), [join(dist, 'search-index-faq.json')]);
  } finally {
    clean(dist);
  }
});

test('a dist with no index at all fails loud instead of passing empty', () => {
  const dist = distWith({});

  try {
    assert.deepEqual(discoverShards(dist), []);
    assert.equal(shardBudgets(dist).withinBudget, false);
  } finally {
    clean(dist);
  }
});
