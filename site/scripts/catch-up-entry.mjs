import { resolve } from 'node:path';

import { catchUp } from './catch-up.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { exitCodeOf } from './repair-outcome.mjs';
import { runProcess } from './writer-cli.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const USAGE = 'Usage: node scripts/catch-up-entry.mjs --head <commit> [--base <ref>]';
const FLAGS = new Map([
  ['--head', 'head'],
  ['--base', 'base'],
]);
const COMMIT = /^[0-9a-f]{40}$/;
const OUTCOME_OF = {
  'caught-up': 'repaired',
  current: 'stale',
  conflict: 'conflict',
  'lost-rows': 'unconverged',
  'out-of-scope': 'unconverged',
  unconverged: 'unconverged',
};

class UsageError extends Error {}

export function parseArguments(argv) {
  const found = {};
  for (let at = 0; at < argv.length; at += 2) {
    if (!FLAGS.has(argv[at]) || at + 1 >= argv.length)
      throw new UsageError(`${USAGE}\nunexpected argument ${argv[at]}`);
    found[FLAGS.get(argv[at])] = argv[at + 1];
  }
  if (!COMMIT.test(found.head ?? '')) throw new UsageError(`${USAGE}\n--head needs a 40 character commit hash`);
  return { head: found.head, base: found.base ?? 'origin/main' };
}

export async function runCli(
  argv,
  {
    stdout = console.log,
    stderr = console.error,
    run = runProcess,
    repoRoot = REPOSITORY_ROOT,
    catchUpOn = catchUp,
  } = {}
) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    stderr(error.message);
    return 2;
  }
  try {
    const result = await catchUpOn({ repoRoot, ...options, run });
    const outcome = OUTCOME_OF[result.outcome];
    const commit = result.commit === undefined ? {} : { commit: result.commit };
    stdout(JSON.stringify({ outcome, ...commit, detail: result.outcome, paths: result.paths ?? [] }));
    return exitCodeOf(outcome);
  } catch (error) {
    stderr(`catch-up: ${error.message}`);
    stdout(JSON.stringify({ outcome: 'failed', detail: error.message, paths: [] }));
    return 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
