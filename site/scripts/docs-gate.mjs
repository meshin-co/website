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

const IGNORED_ROOTS = ['audits/', 'node_modules/', 'dist/', '.astro/'];

export function discoverDocs(viaGit, viaWalk) {
  let paths;
  try {
    paths = viaGit();
  } catch {
    paths = viaWalk();
  }
  return paths.filter((path) => !IGNORED_ROOTS.some((root) => path.startsWith(root)));
}
