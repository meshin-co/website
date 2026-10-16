import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { KINDS } from '../public/search/shards.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

export const PER_SHARD_BUDGET_BYTES = 64 * 1024;
export const SUM_BUDGET_BYTES = 192 * 1024;
export const EXPECTED_SHARD_COUNT = Object.keys(KINDS).length;

const SHARD_NAME = /^search-index-[a-z]+\.json$/;

export function discoverShards(distDir) {
  const shards = readdirSync(distDir)
    .filter((name) => SHARD_NAME.test(name))
    .sort()
    .map((name) => join(distDir, name));
  if (shards.length > 0) return shards;

  const legacy = join(distDir, 'search-index.json');
  return existsSync(legacy) ? [legacy] : [];
}

const gzippedBytes = (file) => gzipSync(readFileSync(file)).byteLength;

export function shardBudgets(distDir) {
  const files = discoverShards(distDir);
  const isSharded = files.length > 0 && files.every((file) => SHARD_NAME.test(basename(file)));
  const shards = files.map((file) => {
    const bytes = gzippedBytes(file);
    return { file, bytes, withinBudget: bytes < PER_SHARD_BUDGET_BYTES };
  });
  const sum = shards.reduce((total, shard) => total + shard.bytes, 0);
  const sumWithinBudget = sum < SUM_BUDGET_BYTES;
  const expectedCount = isSharded ? EXPECTED_SHARD_COUNT : null;
  const countWithinBudget = expectedCount === null || shards.length === expectedCount;
  return {
    shards,
    sum,
    sumWithinBudget,
    expectedShardCount: expectedCount,
    withinBudget:
      shards.length > 0 && sumWithinBudget && shards.every((shard) => shard.withinBudget) && countWithinBudget,
  };
}

function main(distDir) {
  const budgets = shardBudgets(distDir);
  for (const shard of budgets.shards) {
    console.log(
      `${shard.file} ${shard.bytes} bytes gz${shard.withinBudget ? '' : ` (over ${PER_SHARD_BUDGET_BYTES})`}`
    );
  }
  console.log(`sum ${budgets.sum} bytes gz${budgets.sumWithinBudget ? '' : ` (over ${SUM_BUDGET_BYTES})`}`);
  if (budgets.expectedShardCount !== null && budgets.shards.length !== budgets.expectedShardCount) {
    console.log(`shard count ${budgets.shards.length} does not match the expected ${budgets.expectedShardCount}`);
  }
  if (!budgets.withinBudget) process.exitCode = 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  main(process.argv[2] ?? 'dist');
}
