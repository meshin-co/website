import { createHash } from 'node:crypto';

const VALID_STATUS = new Set(['rewritten', 'verified', 'owner-blocked']);

const normaliseTarget = (target) => target.replace(/^\.\//, '').replace(/^site\//, '');

const rowsFor = (rows, target, location) => {
  const wanted = normaliseTarget(target);
  return rows.filter(
    (row) =>
      row.usedIn.some((used) => normaliseTarget(used) === wanted) &&
      (location === undefined || row.location === location)
  );
};

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

const REVIEWED = new Set(['rewritten', 'verified', 'owner-blocked']);

const comparable = (text) =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d'"]/g, '');

export function inheritDerivedStatus(rows) {
  const sources = rows.filter((row) => REVIEWED.has(row.status) && !row.usedIn.every((used) => used.startsWith('/')));
  return rows.map((row) => {
    if (REVIEWED.has(row.status) || !row.usedIn.every((used) => used.startsWith('/'))) return row;
    const rendered = comparable(row.text);
    const source = sources.find((candidate) => comparable(candidate.text).includes(rendered));
    return source
      ? {
          ...row,
          status: source.status,
          ...(source.reason ? { reason: source.reason } : {}),
          derivedFrom: source.usedIn[0],
        }
      : row;
  });
}

export function applyConditionalCopy(dead, declarations) {
  const valid = declarations.filter((entry) => entry.reason);
  const invalid = dead.filter((entry) =>
    declarations.some((declared) => declared.text === entry.text && !declared.reason)
  );
  const declaredTexts = new Set(valid.map((entry) => entry.text));
  const deadTexts = new Set(dead.map((entry) => entry.text));
  return {
    remaining: dead.filter((entry) => !declaredTexts.has(entry.text)),
    invalid,
    stale: valid.filter((entry) => !deadTexts.has(entry.text)),
  };
}
