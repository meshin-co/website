const BACKTICKED = /`([^`\n]+)`/g;
const REPO_PATH = /^[a-zA-Z0-9_.@-]+(?:\/[a-zA-Z0-9_.@[\]-]+)+\.[a-z]{2,4}$/;
const PLACEHOLDER = /phase-N|<[^>]+>|\{[^}]+\}|\*/;
const NPM_COMMAND = /npm run ([a-z][a-z0-9:-]*)/g;
const ROW_RANGE = /\bL1[-–]L(\d+)\b/g;
const EXTERNAL_ROOTS = ['.omp-perfect-coder/', '.perfect-coder/', 'extensions/', 'node_modules/'];

export function citedPaths(text) {
  const found = [];
  for (const [, inner] of text.matchAll(BACKTICKED)) {
    if (!REPO_PATH.test(inner)) continue;
    if (PLACEHOLDER.test(inner)) continue;
    found.push(inner);
  }
  return found;
}

export function citedCommands(text) {
  return [...text.matchAll(NPM_COMMAND)].map(([, script]) => script);
}

export function lockedRowClaims(text) {
  return [...text.matchAll(ROW_RANGE)].map(([, highest]) => Number(highest));
}

export function isExternal(path) {
  return EXTERNAL_ROOTS.some((root) => path.startsWith(root));
}

const BUILD_OUTPUT_ROOTS = ['dist/', 'site/dist/'];

export function isBuildOutput(path) {
  return BUILD_OUTPUT_ROOTS.some((root) => path.startsWith(root));
}

const RECORD_FRONT_MATTER = /^---\nrecord: true\n---(?:\n|$)/;

export function isRecord(text) {
  return RECORD_FRONT_MATTER.test(text);
}

const RECORD_ROOT = 'investigation/';
const RECORD_INDEX = 'investigation/00-INDEX.md';

export function mayBeRecord(doc) {
  return doc.startsWith(RECORD_ROOT) && doc !== RECORD_INDEX;
}

export function parseIgnoreReport(output) {
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();
  const ignored = new Map();
  for (let at = 0; at + 4 <= fields.length; at += 4) {
    const [source, line, pattern, path] = fields.slice(at, at + 4);
    if (!pattern.startsWith('!')) ignored.set(path, { source, line, pattern });
  }
  return ignored;
}

export function ignoredCitation(cited, present, report) {
  const rules = present.map((candidate) => report.get(candidate));
  if (rules.length === 0 || rules.includes(undefined)) return null;
  const [candidate] = present;
  const { source, line, pattern } = rules[0];
  const where = candidate === cited ? cited : `${cited} as ${candidate}`;
  return `${where} exists on disk, but ${source}:${line} (${pattern}) ignores it, so a clean checkout does not hold it`;
}

export function summaryLine({
  fileCount,
  findingCount,
  skippedBuildOutputCount,
  recordCount = 0,
  ignoreCheckSkipped = false,
}) {
  const skipped =
    skippedBuildOutputCount > 0
      ? `, ${skippedBuildOutputCount} build-output citation${skippedBuildOutputCount === 1 ? '' : 's'} unverified (no build present)`
      : '';
  const exempt = recordCount > 0 ? `, ${recordCount} record${recordCount === 1 ? '' : 's'} exempt (record: true)` : '';
  const unchecked = ignoreCheckSkipped ? ', ignored-path check skipped (git could not answer)' : '';
  return `docs: ${fileCount} files checked, ${findingCount} findings${skipped}${exempt}${unchecked}`;
}

export function resolveCandidates(path, citingDoc) {
  const directory = citingDoc.includes('/') ? citingDoc.slice(0, citingDoc.lastIndexOf('/')) : '';
  const beside = directory ? `${directory}/${path}` : path;
  return [...new Set([beside, path, `site/${path}`])];
}

const ROW_REFERENCE = 'docs/plan/reference/locked-decisions.md';

export function enforcesRowRange(doc) {
  if (doc.endsWith('.done.md') || doc.endsWith('.dropped.md')) return false;
  return doc !== ROW_REFERENCE;
}

const IGNORED_ROOTS = ['audits/', 'node_modules/', 'dist/', '.astro/', 'site/src/data/'];

function isIgnoredRoot(path) {
  return IGNORED_ROOTS.some((root) => path.startsWith(root) || path.startsWith(`site/${root}`));
}

export function discoverDocs(viaGit, viaWalk) {
  let paths;
  try {
    paths = viaGit();
  } catch {
    paths = viaWalk();
  }
  return paths.filter((path) => !isIgnoredRoot(path));
}

export function emptyDiscoveryFinding(count) {
  if (count > 0) return null;
  return { doc: '(discovery)', rule: 'no-docs-discovered', detail: 'discovered 0 markdown files to check' };
}
