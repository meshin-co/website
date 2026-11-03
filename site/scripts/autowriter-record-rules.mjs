import { isDeepStrictEqual } from 'node:util';

import { fileStemProblem } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { citedAddress, claimTableProblems } from './claim-sources.mjs';
import { COLLECTION_OF, parseEntrySource, proseBlocks, proseSentences } from './entry-prose.mjs';
import { validateRecord } from './generation-record.mjs';
import { run as measureBand } from './measure-sentence-band.mjs';
import {
  BAND_FILE,
  BandError,
  REMEASURE_COMMAND,
  bandFor,
  bandProblems,
  entryStats,
  readBandRecord,
} from './sentence-band.mjs';

const BAND_PREFIX = 'SENTENCE-BAND ';
const BAND_VERDICT = `${BAND_PREFIX}the record is out of date`;
const BAND_LINE = new RegExp(`^${BAND_PREFIX}(\\S+) ${BAND_FILE.replaceAll('.', '\\.')}: (.*)$`);

const finding = (rule, path, detail) => ({ rule, path, detail });

function readJson(text) {
  try {
    return { record: JSON.parse(text) };
  } catch (error) {
    return { failure: error.message };
  }
}

function readEntryText({ text, format }) {
  const { frontmatter, body } = parseEntrySource(text);
  const sentences = proseSentences(proseBlocks({ collection: COLLECTION_OF[format], frontmatter, body }));
  return { frontmatter, sentences };
}

function sourcesOf({ frontmatter, claimTable }) {
  const idByUrl = new Map(claimTable.filter((row) => row.source).map(({ source }) => [source.url, source.id]));
  return (frontmatter.sources ?? []).map((source) => ({
    ...source,
    id: source.id ?? idByUrl.get(citedAddress(source)),
  }));
}

const claimsOf = (claimTable) =>
  claimTable.map(({ sentence, marker, source, span }) => ({ sentence, marker, sourceId: source?.id ?? null, span }));

function tableFindings({ path, record, entry }) {
  const sources = sourcesOf({ frontmatter: entry.frontmatter, claimTable: record.claimTable });
  const claims = claimsOf(record.claimTable);
  return claimTableProblems({ claims, sources, sentences: entry.sentences }).map(({ rule, sentence, detail }) =>
    finding(rule, path, `${record.entry.path}, sentence "${sentence}": ${detail}`)
  );
}

function measurementFindings({ path, record, entry, limits }) {
  const measured = entryStats({ sentences: entry.sentences, band: limits });
  const difference = Object.keys(measured)
    .filter((key) => !isDeepStrictEqual(record.band.measured[key], measured[key]))
    .map(
      (key) =>
        `${key} ${record.band.measured[key]} in the record against ${measured[key]} in a measurement of the entry`
    )
    .join(', ');
  return difference === '' ? [] : [finding('band-measurement-differs', path, `${record.entry.path}: ${difference}`)];
}

function bandFindings({ path, record, entry, band }) {
  let limits;
  try {
    limits = bandFor(band, record.entry.format);
  } catch (error) {
    if (!(error instanceof BandError)) throw error;
    return [finding('generation-band-unjudged', path, `${record.entry.path} cannot be judged: ${error.message}`)];
  }
  return [
    ...measurementFindings({ path, record, entry, limits }),
    ...bandProblems({ sentences: entry.sentences, band: limits }).map(({ rule, detail }) =>
      finding(rule, path, `${record.entry.path}: ${detail}`)
    ),
  ];
}

function entryFindings({ path, record, readEntry, band }) {
  const { path: entryPath, format } = record.entry;
  const text = readEntry(entryPath);
  if (text === null)
    return [finding('generation-entry-missing', path, `the entry ${entryPath} the record describes does not exist`)];
  let entry;
  try {
    entry = readEntryText({ text, format });
  } catch (error) {
    return [finding('generation-entry-unreadable', path, `${entryPath} cannot be read: ${error.message}`)];
  }
  return [...tableFindings({ path, record, entry }), ...bandFindings({ path, record, entry, band })];
}

function generationFindings({ path, text }, { readEntry, band }) {
  const { record, failure } = readJson(text);
  if (failure !== undefined) return [finding('generation-unreadable', path, `not readable JSON: ${failure}`)];
  const shape = validateRecord(record);
  if (shape.length > 0) return shape.map((problem) => finding('generation-schema', path, describeProblem(problem)));
  const stem = fileStemProblem(path, record);
  const name = stem === null ? [] : [finding('generation-name', path, stem)];
  return [...name, ...entryFindings({ path, record, readEntry, band })];
}

export const generationReport = ({ records, readEntry, band }) =>
  records.flatMap((record) => generationFindings(record, { readEntry, band }));

function bandOutput(repoRoot) {
  const lines = [];
  measureBand({ write: false, repoRoot, today: '', out: () => {}, err: (line) => lines.push(line) });
  return lines;
}

function bandLineFinding(line) {
  const named = BAND_LINE.exec(line);
  if (named === null) return finding('band-record-unmeasurable', BAND_FILE, line.slice(BAND_PREFIX.length));
  return finding(named[1], BAND_FILE, `${named[2]} (re-measure with: ${REMEASURE_COMMAND})`);
}

export function bandRecordFindings(repoRoot) {
  try {
    return bandOutput(repoRoot)
      .filter((line) => !line.startsWith(BAND_VERDICT))
      .map(bandLineFinding);
  } catch (error) {
    return [finding('band-record-unmeasurable', BAND_FILE, `the corpus cannot be measured: ${error.message}`)];
  }
}

export function committedBand(repoRoot) {
  try {
    return readBandRecord(repoRoot);
  } catch (error) {
    if (error instanceof BandError) return null;
    throw error;
  }
}
