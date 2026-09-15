import { createHash } from 'node:crypto';

const VALID_STATUS = new Set(['rewritten', 'verified', 'owner-blocked']);

const rowsFor = (rows, target, location) =>
  rows.filter((row) => row.usedIn.includes(target) && (location === undefined || row.location === location));

export function digestFor(rows, target) {
  const texts = rowsFor(rows, target)
    .map((row) => `${row.location}\u0000${row.text}`)
    .sort();
  return createHash('sha256').update(texts.join('\u0001')).digest('hex').slice(0, 12);
}

export function applyDispositions(rows, dispositions) {
  const applied = rows.map((row) => ({ ...row }));
  const stale = [];
  const unmatched = [];

  for (const disposition of dispositions) {
    const { target, location, status, reason, digest } = disposition;
    const matched = rowsFor(applied, target, location);

    if (matched.length === 0) {
      unmatched.push(disposition);
      continue;
    }
    if (!VALID_STATUS.has(status) || (status === 'owner-blocked' && !reason)) {
      stale.push({ ...disposition, why: 'status is not one of rewritten, verified, owner-blocked with a reason' });
      continue;
    }
    if (digest !== digestFor(applied, target)) {
      stale.push({ ...disposition, why: 'the text changed since it was dispositioned' });
      continue;
    }

    for (const row of matched) {
      row.status = status;
      if (reason) row.reason = reason;
    }
  }

  return { rows: applied, stale, unmatched };
}
