import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { markUnattended } from './human-only.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { explain, failureOf, keysInEnvironment, runProcess } from './writer-cli.mjs';
import { readWriterConfig } from './writer-config.mjs';
import { WriterError } from './writer-error.mjs';
import { redact, secretsOf } from './writer-redact.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const USAGE = 'usage: npm run write:entry -- --decision <path>';

class UsageError extends Error {}

const generateLazily = async (request) => (await import('./write-run.mjs')).generateRun(request);

function decisionPathOf(argv) {
  const at = argv.indexOf('--decision');
  const value = at === -1 ? undefined : argv[at + 1];
  if (!value || value.startsWith('--')) throw new UsageError(USAGE);
  return value;
}

function readDecision(path) {
  let decision;
  try {
    decision = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new WriterError('decision', `the decision file ${path} is not readable JSON: ${error.message}`);
  }
  if (decision?.decision !== 'write')
    throw new WriterError(
      'decision',
      `the decision file ${path} says ${JSON.stringify(decision?.decision)}, not "write"`
    );
  return decision;
}

export async function runCli(argv, io = {}) {
  const {
    env = process.env,
    repoRoot = REPOSITORY_ROOT,
    cwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    fetch = globalThis.fetch,
    now = () => new Date(),
    run = runProcess,
    generate = generateLazily,
  } = io;
  let secrets = keysInEnvironment(env);
  const say = (write, line) => write(redact(line, secrets));
  try {
    markUnattended(env);
    const config = readWriterConfig(env);
    secrets = secretsOf([config.vendor]);
    const decision = readDecision(resolve(cwd, decisionPathOf(argv)));
    const summary = await generate({ decision, config, repoRoot, now, fetch, run });
    say(stdout, JSON.stringify(summary));
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      say(stderr, error.message);
      return 2;
    }
    const failure = failureOf(error, secrets);
    for (const line of explain('write:entry', failure, error)) say(stderr, line);
    say(stdout, JSON.stringify(failure));
    return 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
