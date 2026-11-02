import { ledgerFile } from './autowriter-ledger.mjs';
import { DISPOSITION_DIRECTORY, refusalFor } from './autowriter-refusals.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { generationFile } from './generation-record.mjs';

const DATA_DIRECTORY = 'site/src/data';
const { formats } = readEngineConfig().content;
const SEMANTIC_CORE = 'docs/SEMANTIC-CORE.md';
const UNSAFE = /\\|^\/|(^|\/)\.\.(\/|$)|\/\//;
const RESTATED_DISPOSITION = new RegExp(`^${DISPOSITION_DIRECTORY}/[^/]+\\.json$`);

const entryFile = ({ format, slug }) => `${DATA_DIRECTORY}/${formats[format].collection}/${slug}.md`;

const requiredPaths = (entry) => [entryFile(entry), ledgerFile(entry.slug), generationFile(entry.slug)];

export const ownPaths = (entry) => [
  ...requiredPaths(entry),
  `${DISPOSITION_DIRECTORY}/generated-${entry.slug}.json`,
  SEMANTIC_CORE,
];

const problem = (path, message) => ({ path, problem: message });

function pathProblem(path, own) {
  if (typeof path !== 'string' || path === '' || UNSAFE.test(path))
    return problem(String(path), 'is not a plain repository-relative path');
  const refused = refusalFor(path);
  if (refused !== null) return problem(path, `is refused as ${refused.id}: ${refused.why}`);
  if (own.includes(path) || RESTATED_DISPOSITION.test(path)) return null;
  return problem(path, 'is outside the entry and the files the entry derives');
}

export function scopeProblems({ slug, format, paths }) {
  const entry = { slug, format };
  const own = ownPaths(entry);
  const outside = paths.map((path) => pathProblem(path, own)).filter(Boolean);
  const missing = requiredPaths(entry)
    .filter((path) => !paths.includes(path))
    .map((path) => problem(path, 'is missing, and a repair shows itself in the entry, its ledger and its record'));
  return [...outside, ...missing];
}
