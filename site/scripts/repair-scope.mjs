import { refusalFor } from './autowriter-refusals.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { familyOf, layoutProblem, recordPath } from './record-layout.mjs';
import { REPORT_PATH } from './spend-report-text.mjs';

const DATA_DIRECTORY = 'site/src/data';
const { formats } = readEngineConfig().content;
const SEMANTIC_CORE = 'docs/SEMANTIC-CORE.md';
const UNSAFE = /\\|^\/|(^|\/)\.\.(\/|$)|\/\//;
const isRestatedDisposition = (path) => familyOf(path) === 'disposition' && layoutProblem(path) === null;

const entryFile = ({ format, slug }) => `${DATA_DIRECTORY}/${formats[format].collection}/${slug}.md`;

const requiredPaths = ({ format, slug, claimedAt }) => [
  entryFile({ format, slug }),
  recordPath('ledger', slug, claimedAt),
  recordPath('generation', slug, claimedAt),
];

export const ownPaths = (entry) => [
  ...requiredPaths(entry),
  recordPath('disposition', entry.slug, entry.claimedAt),
  SEMANTIC_CORE,
  REPORT_PATH,
];

const problem = (path, message) => ({ path, problem: message });

function pathProblem(path, own) {
  if (typeof path !== 'string' || path === '' || UNSAFE.test(path))
    return problem(String(path), 'is not a plain repository-relative path');
  const refused = refusalFor(path);
  if (refused !== null) return problem(path, `is refused as ${refused.id}: ${refused.why}`);
  if (own.includes(path) || isRestatedDisposition(path)) return null;
  return problem(path, 'is outside the entry and the files the entry derives');
}

export function scopeProblems({ slug, format, claimedAt, paths }) {
  const entry = { slug, format, claimedAt };
  const own = ownPaths(entry);
  const outside = paths.map((path) => pathProblem(path, own)).filter(Boolean);
  const missing = requiredPaths(entry)
    .filter((path) => !paths.includes(path))
    .map((path) => problem(path, 'is missing, and a repair shows itself in the entry, its ledger and its record'));
  return [...outside, ...missing];
}
