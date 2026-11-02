import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fileStemProblem, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { runGit } from './commit-to-main.mjs';
import { validateRecord } from './generation-record.mjs';
import { familyOf, recordDirectory, recordFiles } from './record-layout.mjs';
import { chooseVersions } from './spend-sum.mjs';

export const WORKING_TREE = 'working tree';
export const SOURCE_REFS = [
  'refs/heads/autowriter',
  'refs/remotes/origin/autowriter',
  'refs/heads/main',
  'refs/remotes/origin/main',
];

export class SpendDataError extends Error {}

const SPEND_FAMILIES = ['ledger', 'generation'];
const isSpendFile = (path) => SPEND_FAMILIES.includes(familyOf(path));

function git(run, repoRoot, args) {
  const result = run(args, { cwd: repoRoot });
  if (result.status !== 0)
    throw new SpendDataError(
      `git ${args[0]} failed in ${repoRoot}, so the spend cannot be read: ${result.stderr.trim()}`
    );
  return result.stdout;
}

function workingTreeFiles(repoRoot) {
  return SPEND_FAMILIES.flatMap((family) =>
    recordFiles(repoRoot, family).map((path) => ({
      path,
      key: null,
      text: () => readFileSync(join(repoRoot, path), 'utf8'),
    }))
  );
}

function treeFiles({ run, repoRoot, ref, blobs }) {
  const listing = git(run, repoRoot, ['ls-tree', '-r', '-z', ref, '--', recordDirectory('ledger')]);
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
  const isRecord = familyOf(file.path) === 'generation';
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
