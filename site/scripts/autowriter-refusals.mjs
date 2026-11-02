import { posix } from 'node:path';

export const DISPOSITION_DIRECTORY = 'audits/phase-4.7/dispositions';

const PIPELINE_REASON_OPENINGS = [
  'The text of this target changed in the run in which the unattended writer added ',
  'Written by the unattended writer from the claim in ',
];

const normalised = (path) =>
  typeof path === 'string' && path !== '' ? posix.normalize(path.replaceAll('\\', '/')) : '';

const exactly = (file) => (path) => normalised(path).toLowerCase() === file;

const matching = (pattern) => (path) => pattern.test(normalised(path));

export const REFUSED_PATHS = [
  {
    id: 'sentence-band',
    why: 'The band every generated entry is judged against, so a run that can move it moves its own goalposts.',
    covers: exactly('audits/sentence-band.json'),
  },
  {
    id: 'entry-length',
    why: 'The floor every generated entry is judged against, measured from entries a person wrote, so a run that can re-measure it lowers its own floor with its own output.',
    covers: exactly('audits/entry-length.json'),
  },
  {
    id: 'lighthouse-record',
    why: 'The record of a green Lighthouse run, which only a person measuring on the owner machine can vouch for (L59).',
    covers: exactly('audits/lighthouse-green.json'),
  },
  {
    id: 'lighthouse-stamp',
    why: 'The stamp that names the tree a Lighthouse run measured, which only the run that measured it may write.',
    covers: matching(/^audits\/[^/]+\/lh-measured\.json$/i),
  },
  {
    id: 'lighthouse-report',
    why: 'A raw Lighthouse report, the evidence behind the stamp, which git ignores and only a measuring run produces.',
    covers: matching(/^audits\/[^/]+\/lh-(?:mobile|desktop)\/./i),
  },
];

export function refusalFor(path) {
  const row = REFUSED_PATHS.find(({ covers }) => covers(path));
  return row ? { id: row.id, path: normalised(path), why: row.why } : null;
}

export const isDispositionFile = (path) => {
  const file = normalised(path).toLowerCase();
  return posix.dirname(file) === DISPOSITION_DIRECTORY && file.endsWith('.json');
};

const SEAL_REASON =
  'The digest of an entry moved while its reason and its status stayed, which is what the seal (npm run assets:seal) does, and the seal certifies text no human read.';
const UNREADABLE_REASON =
  'One version of this file is not a list of dispositions, so the change cannot be told from a seal.';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function entriesOf(text) {
  try {
    const entries = JSON.parse(text);
    return Array.isArray(entries) && entries.every(isPlainObject) ? entries : null;
  } catch {
    return null;
  }
}

const keyOf = ({ target, location }) => JSON.stringify([target ?? null, location ?? null]);

const labelOf = ({ target, location }) => (typeof location === 'string' ? `${target} ${location}` : String(target));

const isPipelineReason = (reason) =>
  typeof reason === 'string' && PIPELINE_REASON_OPENINGS.some((opening) => reason.startsWith(opening));

const isSealed = (previous, next) =>
  next.digest !== previous.digest &&
  next.reason === previous.reason &&
  next.status === previous.status &&
  !isPipelineReason(next.reason);

function groupedByKey(entries) {
  const groups = new Map();
  for (const entry of entries) groups.set(keyOf(entry), [...(groups.get(keyOf(entry)) ?? []), entry]);
  return groups;
}

function sealedEntries({ before, after }) {
  const previous = groupedByKey(before);
  const sealed = [];
  for (const entry of after) {
    const earlier = previous.get(keyOf(entry))?.shift();
    if (earlier !== undefined && isSealed(earlier, entry)) sealed.push(labelOf(entry));
  }
  return [...new Set(sealed)];
}

const unreadable = (path) => ({ id: 'disposition-unreadable', path, why: UNREADABLE_REASON, targets: [] });

export function sealSignature({ path, before, after }) {
  if (!isDispositionFile(path) || after == null) return null;
  const next = entriesOf(after);
  if (before == null) return next === null ? unreadable(path) : null;
  const previous = entriesOf(before);
  if (previous === null || next === null) return unreadable(path);
  const targets = sealedEntries({ before: previous, after: next });
  return targets.length === 0 ? null : { id: 'disposition-seal', path, why: SEAL_REASON, targets };
}

export const refusalOf = ({ path, before, after }) => refusalFor(path) ?? sealSignature({ path, before, after });

export const describeRefusal = ({ id, why, targets = [] }) =>
  `${id}: ${why}${targets.length === 0 ? '' : `; entries: ${targets.join(', ')}`}`;
