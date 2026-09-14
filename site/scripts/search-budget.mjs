import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export const PER_SHARD_BUDGET_BYTES = 64 * 1024;
export const SUM_BUDGET_BYTES = 192 * 1024;

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
  const shards = discoverShards(distDir).map((file) => {
    const bytes = gzippedBytes(file);
    return { file, bytes, withinBudget: bytes < PER_SHARD_BUDGET_BYTES };
  });
  const sum = shards.reduce((total, shard) => total + shard.bytes, 0);
  return {
    shards,
    sum,
    withinBudget: shards.length > 0 && sum < SUM_BUDGET_BYTES && shards.every((shard) => shard.withinBudget),
  };
}

function main(distDir) {
  const budgets = shardBudgets(distDir);
  for (const shard of budgets.shards) {
    console.log(
      `${shard.file} ${shard.bytes} bytes gz${shard.withinBudget ? '' : ` (over ${PER_SHARD_BUDGET_BYTES})`}`
    );
  }
  console.log(`sum ${budgets.sum} bytes gz${budgets.withinBudget ? '' : ` (over ${SUM_BUDGET_BYTES})`}`);
  if (!budgets.withinBudget) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv[2] ?? 'dist');
}
