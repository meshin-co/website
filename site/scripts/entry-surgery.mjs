import { isDeepStrictEqual } from 'node:util';

import { isMap, isSeq, parseDocument } from 'yaml';

import { standInKind } from '../src/utils/archive-url.mjs';

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const YAML_OPTIONS = { customTags: ['timestamp'] };
const QUOTE_OF = { PLAIN: '', QUOTE_SINGLE: "'", QUOTE_DOUBLE: '"' };
const UNSPELLABLE = /[\s'"\\]/;
const BEFORE_ADDRESS = /[\p{L}\p{N}\p{M}\-.:/?#@!$&+,;=%]$/u;
const AFTER_ADDRESS = /^[\p{L}\p{N}\p{M}\-/#@$&+=%([]/u;
const TRAILING_PUNCTUATION = ".,;:!?'*_~";
const FENCE_OPENING = /^[ \t]*(`{3,}(?=[^`]*$)|~{3,})/;
const FENCE_CLOSING = /^[ \t]*(`{3,}|~{3,})$/;
const INLINE_CODE = /(?<!`)(`+)(?!`)(?:(?!\r?\n[ \t]*\r?\n)[\s\S])*?(?<!`)\1(?!`)/g;

export class RewriteError extends Error {
  name = 'RewriteError';
}

export function parseEntry(text) {
  const split = FRONTMATTER.exec(text);
  if (split === null) throw new RewriteError('the entry has no front matter block between --- lines');
  const doc = parseDocument(split[1], YAML_OPTIONS);
  if (doc.errors.length > 0) {
    const [reason] = doc.errors[0].message.split('\n');
    throw new RewriteError(`the front matter does not parse: ${reason.replace(/:$/, '')}`);
  }
  let frontmatter;
  try {
    frontmatter = doc.toJS() ?? {};
  } catch (error) {
    throw new RewriteError(`the front matter does not parse: ${error.message}`);
  }
  const offset = text.indexOf('\n') + 1;
  const nodes = doc.get('sources', true);
  const rows = isSeq(nodes)
    ? nodes.items.map((node, index) => ({ index, node, offset, value: frontmatter.sources[index] }))
    : [];
  return { frontmatter, rows };
}

export const isOpen = ({ value }) => typeof value?.url === 'string' && !Object.hasOwn(value, 'original');
export const citesUrl = (url) => (row) => isOpen(row) && row.value.url === url;
const isArchivedFrom =
  (url) =>
  ({ value }) =>
    value?.original === url || (value?.url === url && Object.hasOwn(value, 'original'));
export const isSearchStandIn = ({ value }) => typeof value?.original === 'string' && standInKind(value) === 'search';

const isAddressStart = (text, start) => !BEFORE_ADDRESS.test(text.slice(Math.max(0, start - 2), start));

function isAddressEnd(text, end) {
  let next = end;
  while (next < text.length && TRAILING_PUNCTUATION.includes(text[next])) next += 1;
  return !AFTER_ADDRESS.test(text.slice(next, next + 2));
}

export function occurrences(text, url) {
  const found = [];
  for (let start = text.indexOf(url); start !== -1; start = text.indexOf(url, start + 1)) {
    const end = start + url.length;
    if (isAddressStart(text, start) && isAddressEnd(text, end)) found.push({ start, end });
  }
  return found;
}

export const covered = (ranges, { start, end }) => ranges.some((range) => range.start <= start && end <= range.end);

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

export const codeRanges = (text) => [
  ...fencedRanges(text),
  ...[...text.matchAll(INLINE_CODE)].map((span) => ({ start: span.index, end: span.index + span[0].length })),
];

function lineAt(text, position) {
  const number = text.slice(0, position).split('\n').length;
  return `line ${number}: ${text.split('\n')[number - 1].trim().slice(0, 120)}`;
}

export function pairOf(row, name) {
  const pair = isMap(row.node) && !row.node.flow ? row.node.items.find(({ key }) => key?.value === name) : undefined;
  if (pair === undefined) {
    throw new RewriteError(
      `sources row ${row.index + 1} is not a block mapping with a ${name} key of its own, so the rewrite cannot edit it in place`
    );
  }
  return pair;
}

export function spelledValue({ text, row, pair, name, address }) {
  const node = pair.value;
  const start = row.offset + node.range[0];
  const end = row.offset + node.range[1];
  const quote = QUOTE_OF[node.type];
  const spelled = text.slice(start, end);
  if (quote === undefined || spelled !== `${quote}${address}${quote}`) {
    throw new RewriteError(
      `sources row ${row.index + 1} spells its ${name} as ${JSON.stringify(spelled)}, which the rewrite cannot replace in place`
    );
  }
  return { start, end, quote, spelled };
}

export const applyEdits = (text, edits) =>
  [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((current, { start, end, text: added }) => current.slice(0, start) + added + current.slice(end), text);

export function assertSpellable(addresses) {
  for (const address of addresses) {
    if (UNSPELLABLE.test(address)) {
      throw new RewriteError(
        `${address} holds whitespace, a quote or a backslash, which YAML spells differently inside different strings`
      );
    }
  }
}

export function openRowsFor(rows, url) {
  if (rows.some(isArchivedFrom(url))) {
    throw new RewriteError(`${url} already has a stand-in in this entry: a source row carries it as original`);
  }
  const open = rows.filter(citesUrl(url));
  if (open.length === 0) throw new RewriteError(`no source row cites ${url}`);
  return open;
}

export function assertNoLeftover(text, url, allowed = 0) {
  const left = occurrences(text, url);
  if (left.length <= allowed) return;
  const where = left.map(({ start }) => lineAt(text, start)).join('; ');
  throw new RewriteError(`${url} is still cited where the rewrite does not change it (${where}); a person decides`);
}

export function assertRowsAfter({ result, rows, changed, isSound }) {
  const after = parseEntry(result).rows;
  if (after.length !== rows.length) throw new RewriteError('the rewrite changed how many sources rows the entry has');
  for (const row of rows) {
    const now = after[row.index].value;
    const sound = changed.includes(row) ? isSound(now, row) : isDeepStrictEqual(now, row.value);
    if (!sound) throw new RewriteError(`sources row ${row.index + 1} reads ${JSON.stringify(now)} after the rewrite`);
  }
}
