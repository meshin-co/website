import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  INDEX_ROOT,
  MAXIMUM_QUERY_WORDS,
  MAXIMUM_RESULTS,
  MAXIMUM_WORD_LENGTH,
  decodeChunk,
} from '../public/search/index-model.mjs';
import { INDEX_LIMITS, ROW_LIMITS, indexPaths, manifestPath } from '../src/utils/search-index.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

export const FIRST_QUERY_BUDGET_BYTES = 64 * 1024;
export const INDEX_FILE_BUDGET = 4000;

const LEGACY_ARTIFACT = /^search-(?:entries|index(?:-[^/]+)?)\.json$/;
const VERSION = /^[0-9a-f]{10}$/;
const WORD = /^[\p{L}\p{N}]+$/u;
const MANIFEST_FIELDS = ['version', 'documents', 'pageSize', 'lastKeys', 'kindRuns'];
const ROW_FIELD_LIMITS = [ROW_LIMITS.href, ROW_LIMITS.title, ROW_LIMITS.description];
const ROW_SHAPE = `[href, title, description] strings of at most ${ROW_LIMITS.href}, ${ROW_LIMITS.title} and ${ROW_LIMITS.description} characters`;

const problem = (text) => `search-index: ${text}`;
const reported = (checks) => checks.filter(([violated]) => violated).map(([, text]) => problem(text));
const quoted = (text) => JSON.stringify(text);
export const gzippedBytes = (buffer) => gzipSync(buffer).byteLength;

const parsed = (buffer) => {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return undefined;
  }
};

const readIfPresent = (distDir, path) => {
  const file = join(distDir, path);
  return existsSync(file) ? readFileSync(file) : null;
};

export function listIndexFiles(distDir) {
  const root = join(distDir, INDEX_ROOT);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `/${relative(distDir, join(entry.parentPath, entry.name)).split(sep).join('/')}`)
    .sort();
}

const legacyProblems = (distDir) =>
  (existsSync(distDir) ? readdirSync(distDir, { withFileTypes: true }) : [])
    .filter((entry) => entry.isFile() && LEGACY_ARTIFACT.test(entry.name))
    .map(({ name }) => problem(`/${name} is a legacy artifact and must not ship`))
    .sort();

const largestSum = (sizes, count) =>
  [...sizes]
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((total, size) => total + size, 0);

export function firstQueryBreakdown({ manifest, chunks, pages }) {
  const chunkBytes = largestSum(chunks, MAXIMUM_QUERY_WORDS);
  const pageBytes = largestSum(pages, MAXIMUM_RESULTS);
  return { manifest, chunks: chunkBytes, pages: pageBytes, total: manifest + chunkBytes + pageBytes };
}

export function indexFileClasses(manifest) {
  const [manifestFile, ...paths] = indexPaths(manifest);
  return {
    manifest: manifestFile,
    chunks: paths.slice(0, manifest.lastKeys.length),
    pages: paths.slice(manifest.lastKeys.length),
  };
}

function namedFiles(distDir, manifest) {
  const { chunks, pages } = indexFileClasses(manifest);
  const read = (path) => ({ path, buffer: readIfPresent(distDir, path) });
  return { chunks: chunks.map(read), pages: pages.map(read) };
}

const sizesOf = (files) => files.filter(({ buffer }) => buffer !== null).map(({ buffer }) => gzippedBytes(buffer));

const worstCaseOf = (manifestBuffer, { chunks, pages }) =>
  firstQueryBreakdown({ manifest: gzippedBytes(manifestBuffer), chunks: sizesOf(chunks), pages: sizesOf(pages) }).total;

export function firstQueryWorstCase(distDir) {
  const buffer = readFileSync(join(distDir, manifestPath));
  return worstCaseOf(buffer, namedFiles(distDir, parsed(buffer)));
}

const validKindRuns = (runs, documents) =>
  Array.isArray(runs) &&
  runs.length > 0 &&
  runs.every(
    (run, at) =>
      Array.isArray(run) &&
      run.length === 2 &&
      Number.isInteger(run[0]) &&
      typeof run[1] === 'string' &&
      run[1] !== '' &&
      run[0] < documents &&
      (at === 0 ? run[0] === 0 : run[0] > runs[at - 1][0])
  );

function manifestShapeProblems(manifest) {
  const { version, documents, pageSize, lastKeys, kindRuns } = manifest;
  const countable = Number.isInteger(documents) && documents > 0;
  const keyList =
    Array.isArray(lastKeys) && lastKeys.length > 0 && lastKeys.every((key) => typeof key === 'string' && key !== '');
  return [
    ...reported([
      [typeof version !== 'string' || !VERSION.test(version), 'manifest version is not 10 lowercase hex characters'],
      [!countable, 'manifest documents is not a positive whole number'],
      [pageSize !== INDEX_LIMITS.pageDocuments, `manifest pageSize is not ${INDEX_LIMITS.pageDocuments}`],
      [!keyList, 'manifest lastKeys is not a list of non-empty strings'],
      [
        !validKindRuns(kindRuns, countable ? documents : Infinity),
        'manifest kindRuns is not a list of [firstId, kind] pairs that start at 0, ascend and stay below documents',
      ],
    ]),
    ...Object.keys(manifest)
      .filter((field) => !MANIFEST_FIELDS.includes(field))
      .map((field) => problem(`manifest field ${quoted(field)} is not in the contract`)),
  ];
}

function loadManifest(distDir) {
  const buffer = readIfPresent(distDir, manifestPath);
  if (buffer === null) return { problems: [problem(`${manifestPath} is missing`)] };
  const manifest = parsed(buffer);
  if (manifest === undefined) return { problems: [problem(`${manifestPath} is not valid JSON`)] };
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
    return { problems: [problem(`${manifestPath} is not an object`)] };
  const shape = manifestShapeProblems(manifest);
  return shape.length > 0 ? { problems: shape } : { manifest, buffer };
}

function fileSetProblems(found, manifest) {
  const named = indexPaths(manifest);
  const present = new Set(found);
  const wanted = new Set(named);
  return [
    ...named
      .filter((path) => !present.has(path))
      .map((path) => problem(`${path} is named by the manifest but missing`)),
    ...found.filter((path) => !wanted.has(path)).map((path) => problem(`${path} is not named by the manifest`)),
  ];
}

function wellFormed(flat) {
  if (!Array.isArray(flat) || flat.length === 0) return false;
  for (let at = 0; at < flat.length;) {
    const count = flat[at + 1];
    if (typeof flat[at] !== 'string' || !Number.isInteger(count) || count === 0) return false;
    const end = at + 2 + 2 * Math.abs(count);
    if (end > flat.length || !flat.slice(at + 2, end).every(Number.isFinite)) return false;
    at = end;
  }
  return true;
}

const ascendingWholeNumbers = (ids) =>
  ids.every((id, at) => Number.isInteger(id) && id >= 0 && (at === 0 || id > ids[at - 1]));

function entryProblems(path, { key, ids, weights }, documents) {
  const where = `${path} key ${quoted(key)}`;
  const tooLong = key.length > MAXIMUM_WORD_LENGTH;
  return reported([
    [tooLong, `${where} is longer than ${MAXIMUM_WORD_LENGTH} characters`],
    [!tooLong && !(WORD.test(key) && key === key.toLowerCase()), `${where} is not lowercase letters and digits`],
    [ids.length > INDEX_LIMITS.listCap, `${where} has ${ids.length} postings (over ${INDEX_LIMITS.listCap})`],
    [!ascendingWholeNumbers(ids), `${where} has ids that are not strictly ascending whole numbers from 0`],
    [ids.some((id) => id >= documents), `${where} has an id not below the ${documents} documents`],
    [
      !weights.every((weight) => Number.isInteger(weight) && weight > 0),
      `${where} has a weight that is not a positive whole number`,
    ],
  ]);
}

function chunkProblems({ path, buffer }, at, manifest) {
  const flat = parsed(buffer);
  if (!wellFormed(flat)) return [problem(`${path} does not decode`)];

  const entries = decodeChunk(flat);
  const named = manifest.lastKeys[at];
  const last = entries.at(-1).key;
  return [
    ...reported([
      [
        buffer.byteLength > INDEX_LIMITS.chunkBytes && entries.length > 1,
        `${path} is ${buffer.byteLength} bytes raw (over ${INDEX_LIMITS.chunkBytes})`,
      ],
    ]),
    ...reported(
      entries.map(({ key }, index) => {
        const previous = index === 0 ? manifest.lastKeys[at - 1] : entries[index - 1].key;
        return [
          previous !== undefined && key <= previous,
          `${path} key ${quoted(key)} does not ascend after ${quoted(previous)}`,
        ];
      })
    ),
    ...reported([[last !== named, `${path} last key is ${quoted(last)}, the manifest says ${quoted(named)}`]]),
    ...entries.flatMap((entry) => entryProblems(path, entry, manifest.documents)),
  ];
}

const isRow = (row) =>
  Array.isArray(row) &&
  row.length === ROW_FIELD_LIMITS.length &&
  row.every((value, at) => typeof value === 'string' && value.length <= ROW_FIELD_LIMITS[at]);

function pageProblems({ path, buffer }, pageSize) {
  const rows = parsed(buffer);
  if (!Array.isArray(rows)) return [problem(`${path} is not a list of rows`)];
  return [
    ...reported([[rows.length > pageSize, `${path} holds ${rows.length} rows (over ${pageSize})`]]),
    ...reported(rows.map((row, at) => [!isRow(row), `${path} row ${at} is not ${ROW_SHAPE}`])),
  ];
}

function indexProblems(distDir, { manifest, buffer }, found) {
  const named = namedFiles(distDir, manifest);
  const worst = worstCaseOf(buffer, named);
  const readable = (files, check) => files.flatMap((file, at) => (file.buffer === null ? [] : check(file, at)));
  return [
    ...fileSetProblems(found, manifest),
    ...readable(named.chunks, (file, at) => chunkProblems(file, at, manifest)),
    ...readable(named.pages, (file) => pageProblems(file, manifest.pageSize)),
    ...reported([
      [worst > FIRST_QUERY_BUDGET_BYTES, `first query worst case ${worst} bytes gz (over ${FIRST_QUERY_BUDGET_BYTES})`],
    ]),
  ];
}

export function searchIndexProblems(distDir) {
  const found = listIndexFiles(distDir);
  const loaded = loadManifest(distDir);
  return [
    ...legacyProblems(distDir),
    ...(loaded.problems ?? indexProblems(distDir, loaded, found)),
    ...reported([[found.length > INDEX_FILE_BUDGET, `${found.length} files (over ${INDEX_FILE_BUDGET})`]]),
  ];
}

function main(distDir) {
  const problems = searchIndexProblems(distDir);
  if (problems.length > 0) {
    for (const line of problems) console.log(line);
    process.exitCode = 1;
    return;
  }
  const files = listIndexFiles(distDir).length;
  const worst = firstQueryWorstCase(distDir);
  console.log(problem(`${files} files, first query worst case ${worst} bytes gz (cap ${FIRST_QUERY_BUDGET_BYTES})`));
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  main(process.argv[2] ?? 'dist');
}
