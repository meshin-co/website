import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { MAXIMUM_QUERY_WORDS, MAXIMUM_RESULTS, decodeChunk } from '../public/search/index-model.mjs';
import { KINDS } from '../public/search/shards.mjs';
import { INDEX_LIMITS, manifestPath } from '../src/utils/search-index.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { WRITE_TIMES_UTC } from './schedule-workflow.mjs';
import {
  FIRST_QUERY_BUDGET_BYTES,
  INDEX_FILE_BUDGET,
  firstQueryBreakdown,
  gzippedBytes,
  indexFileClasses,
  listIndexFiles,
} from './search-budget.mjs';

const USAGE = 'usage: node scripts/measure-search.mjs <dist directory> [--per-day <articles>] [--today <YYYY-MM-DD>]';
const ARTICLE_KIND = KINDS.post;
const HORIZON_YEARS = 5;
const LONGEST_PROJECTION_YEARS = 100;
const DAY_MILLISECONDS = 86_400_000;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const COMMA = 1;
const HEADER = ['class', 'files', 'bytes gz', 'largest'];

const sum = (numbers) => numbers.reduce((total, number) => total + number, 0);
const maximum = (numbers) => numbers.reduce((most, number) => Math.max(most, number), 0);
const digits = (number) => String(number).length;
const calendarDay = (date) => date.toISOString().slice(0, 10);
const summarised = (sizes) => ({ files: sizes.length, gz: sum(sizes), largest: maximum(sizes) });

function requiredText(files, path, absence) {
  const text = files.get(path);
  if (text === undefined) throw new Error(`${path} is ${absence}`);
  return text;
}

function jsonOf(path, text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

function articleFlags({ documents, kindRuns }) {
  const flags = new Uint8Array(documents);
  kindRuns.forEach(([first, kind], at) => {
    if (kind === ARTICLE_KIND.label) flags.fill(1, first, kindRuns[at + 1]?.[0] ?? documents);
  });
  return flags;
}

const pairBytes = (step, weight) => digits(step) + COMMA + digits(weight) + COMMA;
const keyBytes = (key) => Buffer.byteLength(JSON.stringify(key)) + COMMA;
const ownedKeyBytes = (key) => keyBytes(key) + digits(1) + COMMA;

function articlePostings({ key, ids, weights }, isArticle) {
  let previous = 0;
  let carriers = 0;
  let bytes = 0;
  ids.forEach((id, at) => {
    if (isArticle[id]) {
      carriers++;
      bytes += pairBytes(id - previous, weights[at]);
    }
    previous = id;
  });
  return { carriers, bytes: ids.length === 1 && carriers === 1 ? bytes + ownedKeyBytes(key) : bytes };
}

const articlesUntilCap = ({ postings, carriers }, articles) =>
  ((INDEX_LIMITS.listCap - postings) * articles) / carriers;

function scanChunks(chunks, isArticle, articles) {
  let bytes = 0;
  let cut = 0;
  let soonest = null;
  for (const chunk of chunks) {
    for (const entry of decodeChunk(chunk)) {
      if (entry.truncated) {
        cut++;
        continue;
      }
      const posted = articlePostings(entry, isArticle);
      bytes += posted.bytes;
      const list = { key: entry.key, postings: entry.ids.length, carriers: posted.carriers };
      if (
        list.carriers > 0 &&
        (soonest === null || articlesUntilCap(list, articles) < articlesUntilCap(soonest, articles))
      )
        soonest = list;
    }
  }
  return { bytes, cut, soonest };
}

function growthPerArticle({ bytes, articles, manifest }) {
  const postingBytes = bytes / articles;
  const chunks = postingBytes / INDEX_LIMITS.chunkBytes;
  const bytesPerChunk = sum(manifest.lastKeys.map(keyBytes)) / manifest.lastKeys.length;
  return { postingBytes, chunks, files: chunks + 1 / manifest.pageSize, manifestBytes: chunks * bytesPerChunk };
}

function missingParts(chunkSizes, pageSizes) {
  const chunks = Math.max(0, MAXIMUM_QUERY_WORDS - chunkSizes.length);
  const pages = Math.max(0, MAXIMUM_RESULTS - pageSizes.length);
  const meanPage = sum(pageSizes) / Math.max(1, pageSizes.length);
  return { chunks, pages, bytes: Math.round(chunks * maximum(chunkSizes) + pages * meanPage) };
}

export function measureSearchIndex(files) {
  const manifestText = requiredText(files, manifestPath, 'missing');
  const manifest = jsonOf(manifestPath, manifestText);
  const named = indexFileClasses(manifest);
  const textOf = (path) => requiredText(files, path, 'named by the manifest but missing');
  const chunkTexts = named.chunks.map(textOf);
  const chunkSizes = chunkTexts.map(gzippedBytes);
  const pageSizes = named.pages.map(textOf).map(gzippedBytes);
  const manifestSize = gzippedBytes(manifestText);
  const known = new Set([named.manifest, ...named.chunks, ...named.pages]);
  const otherSizes = [...files].filter(([path]) => !known.has(path)).map(([, text]) => gzippedBytes(text));
  const isArticle = articleFlags(manifest);
  const articles = isArticle.reduce((count, flag) => count + flag, 0);
  const scan = scanChunks(
    named.chunks.map((path, at) => jsonOf(path, chunkTexts[at])),
    isArticle,
    articles
  );
  return {
    files: files.size,
    gz: manifestSize + sum(chunkSizes) + sum(pageSizes) + sum(otherSizes),
    manifest: summarised([manifestSize]),
    chunks: summarised(chunkSizes),
    pages: summarised(pageSizes),
    others: summarised(otherSizes),
    documents: manifest.documents,
    articles,
    kindRuns: manifest.kindRuns.length,
    worst: firstQueryBreakdown({ manifest: manifestSize, chunks: chunkSizes, pages: pageSizes }),
    unfilled: missingParts(chunkSizes, pageSizes),
    growth: articles === 0 ? null : growthPerArticle({ bytes: scan.bytes, articles, manifest }),
    lists: { cut: scan.cut, soonest: scan.soonest },
  };
}

const addDays = (day, days) => calendarDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MILLISECONDS));

function addYears(day, years) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return calendarDay(date);
}

export function projectReach({ headroom, growth, perDay, today }) {
  if (headroom < 0) return { kind: 'over', by: -headroom };
  if (!(growth > 0)) return { kind: 'never' };
  const articles = Math.ceil(headroom / growth);
  const days = Math.ceil(articles / perDay);
  if (days > LONGEST_PROJECTION_YEARS * 365) return { kind: 'far' };
  const date = addDays(today, days);
  return { kind: 'date', articles, days, date, inside: date <= addYears(today, HORIZON_YEARS) };
}

function reachText(result, perDay, unit) {
  if (result.kind === 'over') return `already over by ${result.by} ${unit}`;
  if (result.kind === 'never') return 'not reached, it does not grow with an article';
  if (result.kind === 'far') return `not reached within ${LONGEST_PROJECTION_YEARS} years`;
  const { articles, days, date, inside } = result;
  const horizon = `${inside ? 'inside' : 'beyond'} ${HORIZON_YEARS} years`;
  return `after ${articles} more articles, in ${days} days, on ${date}, at ${perDay} articles a day, ${horizon}`;
}

function table({ manifest, chunks, pages, others }) {
  const classes = [
    ['manifest', manifest],
    ['term chunks', chunks],
    ['document pages', pages],
    ...(others.files > 0 ? [['other files', others]] : []),
  ];
  const rows = classes.map(([name, { files, gz, largest }]) => [name, files, gz, largest].map(String));
  const widths = HEADER.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column].length)));
  const line = (cells) =>
    cells.map((cell, column) => (column === 0 ? cell.padEnd(widths[0]) : cell.padStart(widths[column]))).join('  ');
  return [line(HEADER), ...rows.map(line)];
}

function listCapLines({ cut, soonest }, articles, reachOf) {
  const cap = `list cap (${INDEX_LIMITS.listCap} postings)`;
  const lines = [];
  if (cut > 0) lines.push(`${cap}: ${cut} lists are cut already and keep their best ${INDEX_LIMITS.listCap} documents`);
  if (soonest !== null) {
    const holds = `${JSON.stringify(soonest.key)} holds ${soonest.postings}, carried by ${soonest.carriers} of ${articles} ${ARTICLE_KIND.plural}`;
    const reach = reachOf(INDEX_LIMITS.listCap - soonest.postings, soonest.carriers / articles, 'postings');
    lines.push(`${cap}: ${holds}; ${reach}`);
  } else if (cut === 0) {
    lines.push(`${cap}: no list holds an ${ARTICLE_KIND.singular}`);
  }
  return lines;
}

function limitLines({ articles, files, growth, lists, unfilled, worst }, options) {
  const reachOf = (headroom, rate, unit) =>
    reachText(projectReach({ headroom, growth: rate, ...options }), options.perDay, unit);
  const firstQuery = reachOf(FIRST_QUERY_BUDGET_BYTES - worst.total - unfilled.bytes, growth.manifestBytes, 'bytes gz');
  return [
    `first query budget (${FIRST_QUERY_BUDGET_BYTES} bytes gz): ${firstQuery}`,
    `file budget (${INDEX_FILE_BUDGET} files): ${reachOf(INDEX_FILE_BUDGET - files, growth.files, 'files')}`,
    ...listCapLines(lists, articles, reachOf),
  ];
}

const growthLine = ({ postingBytes, chunks, files, manifestBytes }) =>
  `one more ${ARTICLE_KIND.singular} adds about ${Math.round(postingBytes)} bytes of chunk text: ` +
  `${chunks.toFixed(2)} chunks, ${files.toFixed(2)} files and ${manifestBytes.toFixed(1)} bytes of manifest ` +
  `(raw, gzip assumed to save nothing), estimated from the postings and keys the ${ARTICLE_KIND.plural} own`;

export function renderMeasurement(measured, options) {
  const { worst, unfilled, growth } = measured;
  const spare = FIRST_QUERY_BUDGET_BYTES - worst.total;
  const chunkCount = Math.min(MAXIMUM_QUERY_WORDS, measured.chunks.files);
  const pageCount = Math.min(MAXIMUM_RESULTS, measured.pages.files);
  const lines = [
    `search index: ${measured.files} files, ${measured.gz} bytes gz`,
    ...table(measured),
    '',
    `documents: ${measured.documents}, of which ${measured.articles} ${ARTICLE_KIND.label} ${ARTICLE_KIND.plural}; ${measured.kindRuns} kind runs`,
    `first query worst case: ${worst.total} bytes gz of ${FIRST_QUERY_BUDGET_BYTES} ` +
      `(manifest ${worst.manifest} + ${chunkCount} largest chunks ${worst.chunks} + ${pageCount} largest pages ${worst.pages}), ` +
      `${Math.abs(spare)} ${spare >= 0 ? 'to spare' : 'over the budget'}`,
  ];
  if (unfilled.bytes > 0)
    lines.push(
      `still to fill: ${unfilled.bytes} bytes gz, the pages and chunks a query can fetch that do not exist yet (pages ${unfilled.pages}, chunks ${unfilled.chunks})`
    );
  if (growth === null)
    return [
      ...lines,
      `no ${ARTICLE_KIND.label} ${ARTICLE_KIND.plural} in the index, so there is no growth per article to project`,
    ];
  return [...lines, growthLine(growth), ...limitLines(measured, options)];
}

function isCalendarDay(day) {
  const time = Date.parse(`${day}T00:00:00Z`);
  return CALENDAR_DAY.test(day) && !Number.isNaN(time) && calendarDay(new Date(time)) === day;
}

function readOptions(argv) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: { 'per-day': { type: 'string' }, today: { type: 'string' } },
    });
    const perDay = values['per-day'] === undefined ? undefined : Number(values['per-day']);
    const today = values.today ?? calendarDay(new Date());
    const rated = perDay === undefined || (Number.isFinite(perDay) && perDay > 0);
    return positionals.length === 1 && rated && isCalendarDay(today)
      ? { directory: positionals[0], perDay, today }
      : null;
  } catch {
    return null;
  }
}

const readIndexFiles = (distDir) =>
  new Map(listIndexFiles(distDir).map((path) => [path, readFileSync(join(distDir, path), 'utf8')]));

function main(argv) {
  const options = readOptions(argv);
  if (options === null) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const distDir = resolve(options.directory);
  try {
    const perDay = options.perDay ?? WRITE_TIMES_UTC.length;
    const measured = measureSearchIndex(readIndexFiles(distDir));
    for (const line of renderMeasurement(measured, { perDay, today: options.today })) console.log(line);
  } catch (error) {
    console.error(`MEASURE-SEARCH ${distDir}: ${error.message}`);
    process.exitCode = 2;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
