export function shardPlan({ factors, shards, routes, basePort }) {
  const total = routes === undefined ? shards : Math.max(1, Math.min(shards, routes));
  return factors.flatMap((factor) =>
    Array.from({ length: total }, (_, offset) => ({
      factor,
      index: offset + 1,
      total,
      port: basePort + offset + (factor === 'desktop' ? total : 0),
    }))
  );
}

export function workerCount({ cores, requested }) {
  if (requested !== undefined) return Math.max(1, Number(requested));
  return Math.max(1, Math.floor(cores / 4));
}

export function deadlineMs({ done, floorMs, factor = 2.5 }) {
  if (done.length < 2) return floorMs;
  const sorted = [...done].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.max(floorMs, Math.round(median * factor));
}
