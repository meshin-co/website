import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { LEDGER_DIR, fileStemProblem, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { runGit } from './commit-to-main.mjs';
import { GENERATION_DIR, validateRecord } from './generation-record.mjs';
import { chooseVersions } from './spend-sum.mjs';

export const WORKING_TREE = 'working tree';
export const SOURCE_REFS = [
  'refs/heads/autowriter',
  'refs/remotes/origin/autowriter',
  'refs/heads/main',
  'refs/remotes/origin/main',
];

export class SpendDataError extends Error {}

const POSIX_SEPARATOR = '/';
const isJsonIn = (path, directory) => path.endsWith('.json') && dirname(path) === directory;
const isSpendFile = (path) => isJsonIn(path, LEDGER_DIR) || isJsonIn(path, GENERATION_DIR);

function git(run, repoRoot, args) {
  const result = run(args, { cwd: repoRoot });
  if (result.status !== 0)
    throw new SpendDataError(
      `git ${args[0]} failed in ${repoRoot}, so the spend cannot be read: ${result.stderr.trim()}`
    );
  return result.stdout;
}

function workingTreeFiles(repoRoot) {
  return [LEDGER_DIR, GENERATION_DIR].flatMap((directory) => {
    const absolute = join(repoRoot, directory);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => ({
        path: [directory, entry.name].join(POSIX_SEPARATOR),
        key: null,
        text: () => readFileSync(join(absolute, entry.name), 'utf8'),
      }));
  });
}

function treeFiles({ run, repoRoot, ref, blobs }) {
  const listing = git(run, repoRoot, ['ls-tree', '-r', '-z', ref, '--', LEDGER_DIR]);
  return listing
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      return { path: line.slice(tab + 1), key: line.slice(0, tab).split(' ')[2] };
    })
    .filter(({ path }) => isSpendFile(path))
    .map(({ path, key }) => ({
      path,
      key,
      text: () => {
        if (!blobs.has(key)) blobs.set(key, git(run, repoRoot, ['cat-file', 'blob', key]));
        return blobs.get(key);
      },
    }));
}

const refsOf = (run, repoRoot) =>
  git(run, repoRoot, ['for-each-ref', '--format=%(refname)', ...SOURCE_REFS])
    .split('\n')
    .filter(Boolean);

const fail = (label, path, message) => new SpendDataError(`${path} (${label}) ${message}`);

function parseFile({ label, file, check }) {
  let value;
  try {
    value = JSON.parse(file.text());
  } catch (error) {
    if (error instanceof SpendDataError) throw error;
    throw fail(label, file.path, `is not readable JSON: ${error.message}`);
  }
  const problems = check(value).map(describeProblem);
  if (problems.length > 0) throw fail(label, file.path, `is not valid: ${problems.slice(0, 3).join('; ')}`);
  const stem = fileStemProblem(file.path, value);
  if (stem !== null) throw fail(label, file.path, `is not valid: ${stem}`);
  return value;
}

function load({ label, file, parsed }) {
  const isRecord = isJsonIn(file.path, GENERATION_DIR);
  const cacheKey = file.key === null ? null : `${isRecord ? 'record' : 'ledger'}:${file.key}`;
  if (cacheKey !== null && parsed.has(cacheKey)) return { isRecord, value: parsed.get(cacheKey) };
  const value = parseFile({ label, file, check: isRecord ? validateRecord : validateLedger });
  if (cacheKey !== null) parsed.set(cacheKey, value);
  return { isRecord, value };
}

function candidatesOf({ label, files, parsed }) {
  const ledgers = [];
  const records = new Map();
  for (const file of files) {
    const { isRecord, value } = load({ label, file, parsed });
    if (isRecord) records.set(value.slug, value);
    else ledgers.push(value);
  }
  return ledgers.map((ledger) => ({ source: label, ledger, record: records.get(ledger.slug) ?? null }));
}

export function readLedgers({ repoRoot, run = runGit }) {
  const parsed = new Map();
  const blobs = new Map();
  const refs = refsOf(run, repoRoot);
  const sources = [
    { label: WORKING_TREE, files: workingTreeFiles(repoRoot) },
    ...refs.map((ref) => ({ label: ref, files: treeFiles({ run, repoRoot, ref, blobs }) })),
  ];
  return chooseVersions(sources.flatMap(({ label, files }) => candidatesOf({ label, files, parsed })));
}
