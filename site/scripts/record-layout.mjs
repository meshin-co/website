import { readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

import { isCalendarInstant } from './autowriter-records.mjs';

const AUTOWRITER = 'audits/autowriter';

const FAMILIES = {
  ledger: { directory: AUTOWRITER, prefix: '', noun: 'ledger' },
  claim: { directory: `${AUTOWRITER}/claims`, prefix: '', noun: 'claim', reclaimable: true },
  generation: { directory: `${AUTOWRITER}/generations`, prefix: '', noun: 'generation record' },
  disposition: { directory: 'audits/phase-4.7/dispositions', prefix: 'generated-', noun: 'disposition' },
};

const MOST_SPECIFIC_FIRST = ['claim', 'generation', 'ledger', 'disposition'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MONTH_FILE = /^(\d{4})\/(0[1-9]|1[0-2])\/([^/]+)\.json$/;

export const RECORD_FAMILIES = Object.freeze(Object.keys(FAMILIES));

function rule(family) {
  if (!Object.hasOwn(FAMILIES, family)) throw new Error(`unknown record family ${JSON.stringify(family)}`);
  return FAMILIES[family];
}

export const recordDirectory = (family) => rule(family).directory;

function monthOf(date) {
  const instant = date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : date;
  if (!isCalendarInstant(instant))
    throw new Error(`${JSON.stringify(date)} is not a UTC instant such as 2026-11-01T00:00:00Z`);
  return instant.slice(0, 7).replace('-', '/');
}

export function recordPath(family, slug, date) {
  const { directory, prefix } = rule(family);
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new Error(`${JSON.stringify(slug)} is not a slug`);
  return `${directory}/${monthOf(date)}/${prefix}${slug}.json`;
}

export function familyOf(path) {
  if (typeof path !== 'string' || !path.endsWith('.json')) return null;
  return MOST_SPECIFIC_FIRST.find((family) => path.startsWith(`${FAMILIES[family].directory}/`)) ?? null;
}

export function slugOfRecord(path) {
  const family = familyOf(path);
  if (family === null) return null;
  const { prefix } = FAMILIES[family];
  const name = basename(path, '.json');
  const slug = name.startsWith(prefix) ? name.slice(prefix.length) : '';
  return slug === '' ? null : slug;
}

const isHandWritten = ({ family, relativePath, prefix }) =>
  family === 'disposition' && !relativePath.includes('/') && !relativePath.startsWith(prefix);

export function layoutProblem(path) {
  const family = familyOf(path);
  if (family === null) return null;
  const { directory, prefix } = FAMILIES[family];
  const relativePath = path.slice(directory.length + 1);
  const filed = MONTH_FILE.exec(relativePath);
  if (filed !== null && filed[3].startsWith(prefix)) return null;
  if (isHandWritten({ family, relativePath, prefix })) return null;
  return `is not filed as ${directory}/<year>/<month>/${prefix}<slug>.json`;
}

export function findRecordPath(paths, family, slug) {
  const { prefix, noun, reclaimable } = rule(family);
  const name = `${prefix}${slug}.json`;
  const found = paths.filter((path) => familyOf(path) === family && basename(path) === name);
  const following = reclaimable && found.every((path) => layoutProblem(path) === null);
  if (found.length > 1 && !following) throw new Error(`${noun} ${slug} is filed more than once: ${found.join(', ')}`);
  return found.sort().at(-1) ?? null;
}

const newest = (instants) => instants.reduce((latest, at) => (Date.parse(at) > Date.parse(latest) ? at : latest));

function misfiled({ path, family, slug, instants }) {
  if (instants.some((claimedAt) => recordPath(family, slug, claimedAt) === path)) return [];
  const claimedAt = newest(instants);
  const expected = recordPath(family, slug, claimedAt);
  const detail = `the ${FAMILIES[family].noun} of ${slug} belongs at ${expected}, the month of its claim (${claimedAt})`;
  return [{ path, detail }];
}

export function filingProblems({ paths, claims }) {
  const claimed = Map.groupBy(claims, ({ slug }) => slug);
  return paths.flatMap((path) => {
    const slug = slugOfRecord(path);
    if (slug !== null && claimed.has(slug)) {
      const instants = claimed.get(slug).map(({ claimedAt }) => claimedAt);
      return misfiled({ path, family: familyOf(path), slug, instants });
    }
    const detail = layoutProblem(path);
    return detail === null ? [] : [{ path, detail }];
  });
}

export function recordFiles(repoRoot, family) {
  const { directory } = rule(family);
  let entries;
  try {
    entries = readdirSync(join(repoRoot, directory), { withFileTypes: true, recursive: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(repoRoot, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((path) => familyOf(path) === family)
    .sort();
}

export const locateRecord = (repoRoot, family, slug) => findRecordPath(recordFiles(repoRoot, family), family, slug);
