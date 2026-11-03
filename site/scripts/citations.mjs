import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { isMap, isSeq, parseDocument } from 'yaml';

import { isSnapshotOf, searchFallbackUrl, standInKind } from '../src/utils/archive-url.mjs';

export const SOURCE_COLLECTIONS = Object.freeze(['post', 'glossary', 'faq', 'service', 'resource']);

const DATA_DIRECTORY = 'site/src/data';
const ENTRY_FILE = /\.mdx?$/;
const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const YAML_OPTIONS = { customTags: ['timestamp'] };
const QUOTE_OF = { PLAIN: '', QUOTE_SINGLE: "'", QUOTE_DOUBLE: '"' };
const UNSPELLABLE = /[\s'"\\]/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const BEFORE_ADDRESS = /[\p{L}\p{N}\p{M}\-.:/?#@!$&+,;=%]$/u;
const AFTER_ADDRESS = /^[\p{L}\p{N}\p{M}\-/#@$&+=%([]/u;
const TRAILING_PUNCTUATION = ".,;:!?'*_~";
const FENCE_OPENING = /^[ \t]*(`{3,}(?=[^`]*$)|~{3,})/;
const FENCE_CLOSING = /^[ \t]*(`{3,}|~{3,})$/;
const INLINE_CODE = /(?<!`)(`+)(?!`)(?:(?!\r?\n[ \t]*\r?\n)[\s\S])*?(?<!`)\1(?!`)/g;

export class RewriteError extends Error {
  name = 'RewriteError';
}

function parseEntry(text) {
  const split = FRONTMATTER.exec(text);
  if (split === null) throw new RewriteError('the entry has no front matter block between --- lines');
  const doc = parseDocument(split[1], YAML_OPTIONS);
  if (doc.errors.length > 0) {
    const [reason] = doc.errors[0].message.split('\n');
    throw new RewriteError(`the front matter does not parse: ${reason.replace(/:$/, '')}`);
  }
  const frontmatter = doc.toJS() ?? {};
  const offset = text.indexOf('\n') + 1;
  const nodes = doc.get('sources', true);
  const rows = isSeq(nodes)
    ? nodes.items.map((node, index) => ({ index, node, offset, value: frontmatter.sources[index] }))
    : [];
  return { frontmatter, rows };
}

const isOpen = ({ value }) => typeof value?.url === 'string' && !Object.hasOwn(value, 'original');
const citesUrl = (url) => (row) => isOpen(row) && row.value.url === url;
const isArchivedFrom =
  (url) =>
  ({ value }) =>
    value?.original === url || (value?.url === url && Object.hasOwn(value, 'original'));

const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

function entryNames(repoRoot, collection) {
  const directory = join(repoRoot, DATA_DIRECTORY, collection);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((item) => item.isFile() && ENTRY_FILE.test(item.name))
    .map((item) => item.name);
}

function readEntry(repoRoot, collection, name) {
  const path = `${DATA_DIRECTORY}/${collection}/${name}`;
  try {
    return {
      path,
      collection,
      slug: name.replace(ENTRY_FILE, ''),
      ...parseEntry(readFileSync(join(repoRoot, path), 'utf8')),
    };
  } catch (error) {
    throw new Error(`${path}: ${error.message}`, { cause: error });
  }
}

const readEntries = (repoRoot) =>
  SOURCE_COLLECTIONS.flatMap((collection) =>
    entryNames(repoRoot, collection).map((name) => readEntry(repoRoot, collection, name))
  ).sort(byPath);

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

const isAddressStart = (text, start) => !BEFORE_ADDRESS.test(text.slice(Math.max(0, start - 2), start));

function isAddressEnd(text, end) {
  let next = end;
  while (next < text.length && TRAILING_PUNCTUATION.includes(text[next])) next += 1;
  return !AFTER_ADDRESS.test(text.slice(next, next + 2));
}

function occurrences(text, url) {
  const found = [];
  for (let start = text.indexOf(url); start !== -1; start = text.indexOf(url, start + 1)) {
    const end = start + url.length;
    if (isAddressStart(text, start) && isAddressEnd(text, end)) found.push({ start, end });
  }
  return found;
}

const covered = (ranges, { start, end }) => ranges.some((range) => range.start <= start && end <= range.end);

function closesFence(fence, line) {
  const closing = FENCE_CLOSING.exec(line)?.[1];
  return closing !== undefined && closing[0] === fence[0] && closing.length >= fence.length;
}

function fencedRanges(text) {
  const ranges = [];
  let open = null;
  let offset = 0;
  for (const line of text.split('\n')) {
    const bare = line.trimEnd();
    if (open === null) {
      const fence = FENCE_OPENING.exec(bare)?.[1];
      if (fence !== undefined) open = { start: offset, fence };
    } else if (closesFence(open.fence, bare)) {
      ranges.push({ start: open.start, end: offset + line.length });
      open = null;
    }
    offset += line.length + 1;
  }
  return open === null ? ranges : [...ranges, { start: open.start, end: text.length }];
}

const codeRanges = (text) => [
  ...fencedRanges(text),
  ...[...text.matchAll(INLINE_CODE)].map((span) => ({ start: span.index, end: span.index + span[0].length })),
];

function lineAt(text, position) {
  const number = text.slice(0, position).split('\n').length;
  return `line ${number}: ${text.split('\n')[number - 1].trim().slice(0, 120)}`;
}

function originalLine({ text, keyStart, valueEnd, spelledUrl }) {
  const lineEnd = text.indexOf('\n', valueEnd);
  const crlf = text[lineEnd - 1] === '\r';
  const at = crlf ? lineEnd - 1 : lineEnd;
  const indent = ' '.repeat(keyStart - (text.lastIndexOf('\n', keyStart - 1) + 1));
  return { start: at, end: at, text: `${crlf ? '\r\n' : '\n'}${indent}original: ${spelledUrl}` };
}

function planRow({ text, row, url, standIn }) {
  const label = `sources row ${row.index + 1}`;
  const pair = isMap(row.node) && !row.node.flow ? row.node.items.find(({ key }) => key?.value === 'url') : undefined;
  if (pair === undefined) {
    throw new RewriteError(
      `${label} is not a block mapping with a url key of its own, so the rewrite cannot edit it in place`
    );
  }
  const { key, value: node } = pair;
  const start = row.offset + node.range[0];
  const end = row.offset + node.range[1];
  const quote = QUOTE_OF[node.type];
  const spelled = text.slice(start, end);
  if (quote === undefined || spelled !== `${quote}${url}${quote}`) {
    throw new RewriteError(
      `${label} spells its url as ${JSON.stringify(spelled)}, which the rewrite cannot replace in place`
    );
  }
  return {
    replace: { start, end, text: `${quote}${standIn}${quote}` },
    insert: originalLine({ text, keyStart: row.offset + key.range[0], valueEnd: end, spelledUrl: spelled }),
  };
}

function addressEdits({ text, url, standIns, claimed }) {
  const code = codeRanges(text);
  const found = occurrences(text, url).filter((span) => !covered(claimed, span) && !covered(code, span));
  const [standIn, ...others] = new Set(standIns);
  if (found.length > 0 && others.length > 0) {
    throw new RewriteError(
      `${url} is cited by rows that would each search for something different, so the prose that links to it has no one search to point at; a person decides`
    );
  }
  return found.map(({ start, end }) => ({ start, end, text: standIn }));
}

const applyEdits = (text, edits) =>
  [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((current, { start, end, text: added }) => current.slice(0, start) + added + current.slice(end), text);

function assertSpellable(addresses) {
  for (const address of addresses) {
    if (UNSPELLABLE.test(address)) {
      throw new RewriteError(
        `${address} holds whitespace, a quote or a backslash, which YAML spells differently inside different strings`
      );
    }
  }
}

function openRowsFor(rows, url) {
  if (rows.some(isArchivedFrom(url))) {
    throw new RewriteError(`${url} already has a stand-in in this entry: a source row carries it as original`);
  }
  const open = rows.filter(citesUrl(url));
  if (open.length === 0) throw new RewriteError(`no source row cites ${url}`);
  return open;
}

function assertNoLeftover(text, url) {
  const left = occurrences(text, url);
  if (left.length === 0) return;
  const where = left.map(({ start }) => lineAt(text, start)).join('; ');
  throw new RewriteError(`${url} is still cited where the rewrite does not change it (${where}); a person decides`);
}

function assertRowsStandIn({ result, rows, open, standIns, url, kind }) {
  const after = parseEntry(result).rows;
  if (after.length !== rows.length) throw new RewriteError('the rewrite changed how many sources rows the entry has');
  for (const row of rows) {
    const now = after[row.index].value;
    const at = open.indexOf(row);
    const sound =
      at === -1
        ? isDeepStrictEqual(now, row.value)
        : now?.url === standIns[at] && now.original === url && standInKind(now) === kind;
    if (!sound) throw new RewriteError(`sources row ${row.index + 1} reads ${JSON.stringify(now)} after the rewrite`);
  }
}

function standInEntryText({ text, url, kind, standInFor }) {
  assertSpellable([url]);
  const { rows } = parseEntry(text);
  const open = openRowsFor(rows, url);
  const standIns = open.map((row) => standInFor(row));
  assertSpellable(standIns);
  const plans = open.map((row, at) => planRow({ text, row, url, standIn: standIns[at] }));
  const claimed = plans.map(({ replace }) => replace);
  const replacements = [...claimed, ...addressEdits({ text, url, standIns, claimed })];
  assertNoLeftover(applyEdits(text, replacements), url);
  const result = applyEdits(text, [...replacements, ...plans.map(({ insert }) => insert)]);
  assertRowsStandIn({ result, rows, open, standIns, url, kind });
  return result;
}

export function archivedEntryText({ text, url, archiveUrl }) {
  if (!isSnapshotOf(archiveUrl, url)) throw new RewriteError(`${archiveUrl} is not a Wayback snapshot of ${url}`);
  return standInEntryText({ text, url, kind: 'archive', standInFor: () => archiveUrl });
}

function searchFor({ index, value: { title, publisher } }) {
  try {
    return searchFallbackUrl({ title, publisher });
  } catch {
    throw new RewriteError(`sources row ${index + 1} has no title, so there is nothing to search for`);
  }
}

export function searchedEntryText({ text, url }) {
  return standInEntryText({ text, url, kind: 'search', standInFor: searchFor });
}
