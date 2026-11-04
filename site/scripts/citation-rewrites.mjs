import { isDeepStrictEqual } from 'node:util';

import { isSnapshotOf, searchFallbackUrl, standInKind } from '../src/utils/archive-url.mjs';
import {
  applyEdits,
  assertNoLeftover,
  assertRowsAfter,
  assertSpellable,
  codeRanges,
  covered,
  isSearchStandIn,
  occurrences,
  openRowsFor,
  pairOf,
  parseEntry,
  RewriteError,
  spelledValue,
} from './entry-surgery.mjs';

function originalLine({ text, keyStart, valueEnd, spelledUrl }) {
  const lineEnd = text.indexOf('\n', valueEnd);
  const crlf = text[lineEnd - 1] === '\r';
  const at = crlf ? lineEnd - 1 : lineEnd;
  const indent = ' '.repeat(keyStart - (text.lastIndexOf('\n', keyStart - 1) + 1));
  return { start: at, end: at, text: `${crlf ? '\r\n' : '\n'}${indent}original: ${spelledUrl}` };
}

function planRow({ text, row, url, standIn }) {
  const pair = pairOf(row, 'url');
  const { start, end, quote, spelled } = spelledValue({ text, row, pair, name: 'url', address: url });
  return {
    replace: { start, end, text: `${quote}${standIn}${quote}` },
    insert: originalLine({ text, keyStart: row.offset + pair.key.range[0], valueEnd: end, spelledUrl: spelled }),
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
  assertRowsAfter({
    result,
    rows,
    changed: open,
    isSound: (now, row) =>
      now?.url === standIns[open.indexOf(row)] && now.original === url && standInKind(now) === kind,
  });
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

function originalLineEdit({ text, row, pair, valueEnd }) {
  const keyStart = row.offset + pair.key.range[0];
  const lineStart = text.lastIndexOf('\n', keyStart - 1) + 1;
  const lineEnd = text.indexOf('\n', valueEnd);
  const trailing = text.slice(valueEnd, lineEnd).trim();
  if (text.slice(lineStart, keyStart).trim() !== '' || !(trailing === '' || trailing.startsWith('#'))) {
    throw new RewriteError(
      `sources row ${row.index + 1} keeps its original on a line that holds more than the original, so the rewrite cannot remove that line`
    );
  }
  return { start: lineStart, end: lineEnd + 1, text: '' };
}

function restoreEdits({ text, row, original }) {
  const url = spelledValue({ text, row, pair: pairOf(row, 'url'), name: 'url', address: row.value.url });
  const originalPair = pairOf(row, 'original');
  const kept = spelledValue({ text, row, pair: originalPair, name: 'original', address: original });
  return {
    replace: { start: url.start, end: url.end, text: kept.spelled },
    remove: originalLineEdit({ text, row, pair: originalPair, valueEnd: kept.end }),
  };
}

function upgradeEdits({ text, row, archiveUrl }) {
  const pair = pairOf(row, 'url');
  const { start, end, quote } = spelledValue({ text, row, pair, name: 'url', address: row.value.url });
  return { replace: { start, end, text: `${quote}${archiveUrl}${quote}` } };
}

const restsOnSearchFor = (original) => (row) => isSearchStandIn(row) && row.value.original === original;

function searchRowsFor(rows, original, positions) {
  const resting = rows.filter(restsOnSearchFor(original));
  const stray = positions?.find((position) => !resting.includes(rows[position - 1]));
  if (stray !== undefined)
    throw new RewriteError(`sources row ${stray} does not rest on a search link for ${original}`);
  const chosen = positions === undefined ? resting : [...new Set(positions)].map((position) => rows[position - 1]);
  if (chosen.length === 0) throw new RewriteError(`no source row rests on a search link for ${original}`);
  return chosen;
}

function urlSpan(row) {
  const { value: node } = pairOf(row, 'url');
  return { start: row.offset + node.range[0], end: row.offset + node.range[1] };
}

const withoutAddresses = (row) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'url' && key !== 'original'));
const sameBesidesAddresses = (now, before) => isDeepStrictEqual(withoutAddresses(now), withoutAddresses(before));
const editsOf = ({ replace, remove }) => (remove === undefined ? [replace] : [replace, remove]);

function searchRowsEntryText({ text, original, positions, address, rowEdits, isSound }) {
  assertSpellable([original, address]);
  const { rows } = parseEntry(text);
  const chosen = searchRowsFor(rows, original, positions);
  const searches = [...new Set(chosen.map(({ value }) => value.url))];
  assertSpellable(searches);
  const planned = chosen.map((row) => rowEdits({ text, row }));
  const sharing = rows.filter((row) => !chosen.includes(row) && searches.includes(row.value?.url));
  const claimed = [...planned.map(({ replace }) => replace), ...sharing.map(urlSpan)];
  const code = codeRanges(text);
  const prose = searches.flatMap((search) =>
    occurrences(text, search)
      .filter((span) => !covered(claimed, span) && !covered(code, span))
      .map(({ start, end }) => ({ start, end, text: address, search }))
  );
  if (prose.some(({ search }) => sharing.some(({ value }) => value.url === search))) {
    throw new RewriteError(
      'prose links to a search that more than one row rests on, so it cannot say which address it stood for; a person decides'
    );
  }
  const replaced = applyEdits(text, [...planned.map(({ replace }) => replace), ...prose]);
  for (const search of searches) {
    assertNoLeftover(replaced, search, sharing.filter(({ value }) => value.url === search).length);
  }
  const result = applyEdits(text, [...planned.flatMap(editsOf), ...prose]);
  assertRowsAfter({ result, rows, changed: chosen, isSound });
  return result;
}

export function restoredEntryText({ text, original, positions }) {
  return searchRowsEntryText({
    text,
    original,
    positions,
    address: original,
    rowEdits: ({ text: entry, row }) => restoreEdits({ text: entry, row, original }),
    isSound: (now, { value }) =>
      now?.url === original && !Object.hasOwn(now, 'original') && sameBesidesAddresses(now, value),
  });
}

export function upgradedEntryText({ text, original, archiveUrl, positions }) {
  if (!isSnapshotOf(archiveUrl, original)) {
    throw new RewriteError(`${archiveUrl} is not a Wayback snapshot of ${original}`);
  }
  return searchRowsEntryText({
    text,
    original,
    positions,
    address: archiveUrl,
    rowEdits: ({ text: entry, row }) => upgradeEdits({ text: entry, row, archiveUrl }),
    isSound: (now, { value }) =>
      now?.url === archiveUrl &&
      now.original === original &&
      standInKind(now) === 'archive' &&
      sameBesidesAddresses(now, value),
  });
}
