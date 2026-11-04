import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { citesUrl, isOpen, isSearchStandIn, parseEntry } from './entry-surgery.mjs';

export const SOURCE_COLLECTIONS = Object.freeze(['post', 'glossary', 'faq', 'service', 'resource']);

const DATA_DIRECTORY = 'site/src/data';
const ENTRY_FILE = /\.mdx?$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

function entryNames(repoRoot, collection) {
  const directory = join(repoRoot, DATA_DIRECTORY, collection);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((item) => item.isFile() && ENTRY_FILE.test(item.name))
    .map((item) => item.name);
}

const entryRefs = (repoRoot) =>
  SOURCE_COLLECTIONS.flatMap((collection) =>
    entryNames(repoRoot, collection).map((name) => ({
      collection,
      path: `${DATA_DIRECTORY}/${collection}/${name}`,
      slug: name.replace(ENTRY_FILE, ''),
    }))
  ).sort(byPath);

function readEntry(repoRoot, { collection, path, slug }) {
  try {
    return { path, collection, slug, ...parseEntry(readFileSync(join(repoRoot, path), 'utf8')) };
  } catch (error) {
    throw new Error(`${path}: ${error.message}`, { cause: error });
  }
}

const readEntries = (repoRoot) => entryRefs(repoRoot).map((ref) => readEntry(repoRoot, ref));

const isoDay = (instant) => (Number.isNaN(instant.getTime()) ? null : instant.toISOString().slice(0, 10));
const isRealDay = (day) => isoDay(new Date(day)) === day;

function calendarDay(value) {
  if (value instanceof Date) return isoDay(value);
  if (typeof value !== 'string') return null;
  if (ISO_DAY.test(value)) return isRealDay(value) ? value : null;
  return ISO_INSTANT.test(value) && isRealDay(value.slice(0, 10)) ? isoDay(new Date(value)) : null;
}

function dayOrNull(value, label) {
  if (value === undefined || value === null) return null;
  const day = calendarDay(value);
  if (day === null) throw new Error(`${label} ${JSON.stringify(value)} is not a calendar day`);
  return day;
}

function citation({ path, collection, slug, frontmatter }, rows) {
  const [{ value: source }] = rows;
  const day = (value, field) => dayOrNull(value, `${path}: ${field}`);
  const retrieved = day(source.retrieved, 'the retrieved date of the source row');
  const updatedDate = day(frontmatter.updatedDate, 'the updatedDate');
  const publishDate = day(frontmatter.publishDate, 'the publishDate');
  const citedOn = retrieved ?? updatedDate;
  if (citedOn === null) {
    throw new Error(`${path}: neither the source row's retrieved date nor the updatedDate says when it was cited`);
  }
  const { title = null, publisher = null } = source;
  return {
    path,
    collection,
    slug,
    sourceTitle: title,
    publisher,
    retrieved,
    updatedDate,
    publishDate,
    citedOn,
    rows: rows.length,
  };
}

export function citingEntries({ repoRoot, url }) {
  return readEntries(repoRoot).flatMap((entry) => {
    const rows = entry.rows.filter(citesUrl(url));
    return rows.length === 0 ? [] : [citation(entry, rows)];
  });
}

export function citedUrls({ repoRoot }) {
  const cited = new Map();
  for (const { path, rows } of readEntries(repoRoot)) {
    for (const url of new Set(rows.filter(isOpen).map(({ value }) => value.url))) {
      cited.set(url, [...(cited.get(url) ?? []), path]);
    }
  }
  return cited;
}

function searchStandIn(entry, row) {
  const { path, collection, slug } = entry;
  const { sourceTitle, publisher, citedOn } = citation(entry, [row]);
  const { url, original } = row.value;
  return { path, collection, slug, position: row.index + 1, sourceTitle, publisher, citedOn, url, original };
}

export function searchStandIns({ repoRoot }) {
  const standIns = [];
  const unreadable = [];
  for (const ref of entryRefs(repoRoot)) {
    try {
      const entry = readEntry(repoRoot, ref);
      standIns.push(...entry.rows.filter(isSearchStandIn).map((row) => searchStandIn(entry, row)));
    } catch (error) {
      unreadable.push({ path: ref.path, message: error.message });
    }
  }
  return { standIns, unreadable };
}
