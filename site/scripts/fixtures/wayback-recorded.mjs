import { INDEX, NIST, recording } from './wayback-fakes.mjs';

const DAY_MS = 86_400_000;

const recordedCaptures = Object.keys(INDEX)
  .filter((name) => name.startsWith('available-') && name !== 'available-empty.json')
  .map((name) => JSON.parse(recording(name)).archived_snapshots.closest)
  .sort((left, right) => (left.timestamp < right.timestamp ? -1 : 1));

const dayOf = (stamp) =>
  Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T00:00:00Z`) / DAY_MS;

function nearestCapture(timestamp) {
  if (timestamp === null || timestamp === '') return recordedCaptures.at(-1);
  const wanted = dayOf(timestamp);
  return recordedCaptures.reduce((best, capture) =>
    Math.abs(dayOf(capture.timestamp) - wanted) < Math.abs(dayOf(best.timestamp) - wanted) ? capture : best
  );
}

export function availabilityFor({ address, timestamp, empty = false }) {
  if (empty) return { url: address, archived_snapshots: {}, timestamp };
  const closest = nearestCapture(timestamp);
  return {
    url: address,
    archived_snapshots: { closest: { ...closest, url: closest.url.replace(NIST, address) } },
    ...(timestamp === null ? {} : { timestamp }),
  };
}
