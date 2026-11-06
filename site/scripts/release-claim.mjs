import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { readClaim, writeClaim } from './autowriter-claim-store.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const USAGE =
  'usage: node scripts/release-claim.mjs --decision <file written by npm run pick:topic> [--repo-root <dir>]';
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');

class UsageError extends Error {}

function parse(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { decision: { type: 'string' }, 'repo-root': { type: 'string' } },
      strict: true,
    }));
  } catch (error) {
    throw new UsageError(`${error.message}. ${USAGE}`);
  }
  if (values.decision === undefined) throw new UsageError(`--decision is required. ${USAGE}`);
  return values;
}

export function claimPathsOf(decisionFile) {
  let decision;
  try {
    decision = JSON.parse(readFileSync(decisionFile, 'utf8'));
  } catch (error) {
    throw new Error(`${decisionFile} is not readable JSON: ${error.message}`, { cause: error });
  }
  const entries = Array.isArray(decision.entries) ? decision.entries : [];
  return entries.map(({ claimPath }) => claimPath).filter((path) => typeof path === 'string' && path !== '');
}

export function releaseClaims({ decisionFile, repoRoot }) {
  return claimPathsOf(decisionFile).map((path) => {
    const file = resolve(repoRoot, path);
    const claim = readClaim(file);
    if (claim.status !== 'claimed') return { path, released: false, status: claim.status };
    writeClaim(file, { ...claim, status: 'abandoned' });
    return { path, released: true, status: 'abandoned' };
  });
}

export function runCli(argv, io = {}) {
  const { stdout = console.log, stderr = console.error } = io;
  let outcomes;
  try {
    const values = parse(argv);
    const repoRoot =
      values['repo-root'] === undefined ? (io.repoRoot ?? REPOSITORY_ROOT) : resolve(values['repo-root']);
    outcomes = releaseClaims({ decisionFile: resolve(values.decision), repoRoot });
  } catch (error) {
    stderr(`release-claim: ${error.message}`);
    return error instanceof UsageError ? 2 : 1;
  }
  for (const { path, released, status } of outcomes)
    stdout(
      released ? `release-claim: ${path} is abandoned` : `release-claim: ${path} is already ${status}, left alone`
    );
  for (const { path, released } of outcomes) if (released) stdout(`path=${path}`);
  return 0;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = runCli(process.argv.slice(2));
