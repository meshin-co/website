import {
  LENGTH_FILE,
  LengthError,
  REMEASURE_COMMAND,
  lengthFor,
  lengthProblems,
  readLengthRecord,
  recordProblems,
} from './entry-length.mjs';
import { measureRepository } from './measure-entry-length.mjs';
import { generatedSlugs } from './measure-sentence-band.mjs';
import { formatOf } from './sentence-band.mjs';
import { DATA_DIRECTORY } from './writer-tree.mjs';

const finding = (rule, path, detail) => ({ rule, path, detail });

const entryPath = ({ id }) => `${DATA_DIRECTORY}/${id}.md`;

const recordFinding = ({ rule, detail }) =>
  finding(rule, LENGTH_FILE, `${detail} (re-measure with: ${REMEASURE_COMMAND})`);

function entryFindings(entry, record) {
  const path = entryPath(entry);
  try {
    const limits = lengthFor(record, formatOf(entry.collection));
    return lengthProblems({ collection: entry.collection, body: entry.body, limits }).map(({ rule, detail }) =>
      finding(rule, path, detail)
    );
  } catch (error) {
    if (!(error instanceof LengthError)) throw error;
    return [finding('length-unjudged', path, `${entry.id} cannot be judged: ${error.message}`)];
  }
}

function readRecord(repoRoot) {
  try {
    return { record: readLengthRecord(repoRoot) };
  } catch (error) {
    if (!(error instanceof LengthError)) throw error;
    return { failure: finding('length-record-unreadable', LENGTH_FILE, error.message) };
  }
}

export function lengthFindings(repoRoot, { generated = generatedSlugs(repoRoot) } = {}) {
  const { record, failure } = readRecord(repoRoot);
  if (failure !== undefined) return [failure];
  let measured;
  try {
    measured = measureRepository(repoRoot, generated);
  } catch (error) {
    return [finding('length-record-unmeasurable', LENGTH_FILE, `the corpus cannot be measured: ${error.message}`)];
  }
  const stale = recordProblems(record, measured.fresh).map(recordFinding);
  if (record === null) return stale;
  return [...stale, ...measured.left.flatMap((entry) => entryFindings(entry, record))];
}
