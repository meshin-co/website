function shardOf(env) {
  const rawIndex = env.LH_SHARD_INDEX;
  const rawTotal = env.LH_SHARD_TOTAL;
  if (rawIndex === undefined && rawTotal === undefined) return { index: 1, total: 1 };
  if (rawIndex === undefined || rawTotal === undefined) {
    throw new Error('lh-shards: LH_SHARD_INDEX and LH_SHARD_TOTAL must be set together');
  }
  return { index: Number(rawIndex), total: Number(rawTotal) };
}

function shardRoutes(routes, { index, total }) {
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 1 || index > total) {
    throw new Error(`lh-shards: shard ${index} of ${total} is out of range`);
  }
  return routes.filter((_, position) => position % total === index - 1);
}

module.exports = { shardOf, shardRoutes };
