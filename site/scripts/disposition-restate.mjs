import { GENERATED_STATUS } from './route-derive.mjs';
import { WriterError } from './writer-error.mjs';

const SCRIPT = 'scripts/stale-dispositions.mjs';
const FILE_NAME = /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.json$/;
const DIGEST = /^[0-9a-f]{12}$/;

function fail(message) {
  throw new WriterError('build', message);
}

const joined = (items) => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

const layoutOf = (entries) => `${JSON.stringify(entries, null, 2)}\n`;

const OPENING = 'The text of this target changed in the run in which the unattended writer added ';
const EARLIER_REVIEW =
  'Whatever review the previous reason of this entry recorded covers the text that was there before; ' +
  'that reason is in the git history of this file.';

const isCount = (value) => Number.isInteger(value) && value >= 1;

export const restatedReason = ({ routes, generationPaths }) =>
  `${OPENING}${joined(routes)} ` +
  `(generation record${generationPaths.length === 1 ? '' : 's'} ${joined(generationPaths)}). ` +
  `The text the writer added was written by a model, and no human has read it. ${EARLIER_REVIEW}`;

export function repairedReason({ route, generationPath, attempt }) {
  if (!isCount(attempt?.number) || !isCount(attempt?.of) || attempt.number > attempt.of)
    fail(`a repair attempt is { number, of } with 1 <= number <= of, not ${JSON.stringify(attempt)}`);
  return (
    `${OPENING}a repair of ${route} (generation record ${generationPath}), ` +
    `attempt ${attempt.number} of ${attempt.of}. ` +
    `The text the repair wrote was written by a model, and no human has read it. ${EARLIER_REVIEW}`
  );
}

function problemWith(item) {
  if (item === null || typeof item !== 'object') return 'is not an object';
  if (typeof item.file !== 'string' || !FILE_NAME.test(item.file)) return 'has no plain .json file name';
  if (!Number.isInteger(item.index) || item.index < 0) return 'has no entry position';
  if (typeof item.target !== 'string' || item.target === '') return 'has no target';
  if (typeof item.digest !== 'string' || !DIGEST.test(item.digest)) return 'has no twelve hex digit digest';
  return null;
}

export function parseStale(stdout) {
  let list;
  try {
    list = JSON.parse(stdout);
  } catch {
    fail(`${SCRIPT} printed something that is not JSON: "${String(stdout).trim().slice(0, 60)}"`);
  }
  if (!Array.isArray(list)) fail(`${SCRIPT} printed JSON that is not a list`);
  const seen = new Set();
  list.forEach((item, position) => {
    const problem = problemWith(item);
    if (problem) fail(`${SCRIPT} item ${position} ${problem}`);
    const key = `${item.file} entry ${item.index}`;
    if (seen.has(key)) fail(`${SCRIPT} names ${key} twice`);
    seen.add(key);
  });
  return list.map(({ file, index, target, digest }) => ({ file, index, target, digest }));
}

function entriesOf(file, text) {
  let entries;
  try {
    entries = JSON.parse(text);
  } catch {
    fail(`${file} is not JSON`);
  }
  if (!Array.isArray(entries)) fail(`${file} is not a list of dispositions`);
  if (layoutOf(entries) !== text)
    fail(
      `${file} is not laid out as two-space JSON and a newline, so restating it would reformat entries nobody changed`
    );
  return entries;
}

export function restateFile({ file, text, stale, reason }) {
  const entries = entriesOf(file, text);
  for (const { index, target, digest } of stale) {
    const entry = entries[index];
    if (entry?.target !== target)
      fail(`${file} entry ${index} names ${entry?.target ?? 'nothing'}, but the stale list names ${target}`);
    entries[index] = { ...entry, status: GENERATED_STATUS, reason, digest };
  }
  return layoutOf(entries);
}
