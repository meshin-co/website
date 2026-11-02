import { resolve } from 'node:path';

import { markUnattended } from './human-only.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { createApi } from './pr-github.mjs';
import { RepairStop, exitCodeOf } from './repair-outcome.mjs';
import { createAdapter } from './writer-adapter.mjs';
import { explain, failureOf, keysInEnvironment, runProcess } from './writer-cli.mjs';
import { readWriterConfig } from './writer-config.mjs';
import { WriterError } from './writer-error.mjs';
import { redact, secretsOf } from './writer-redact.mjs';

const SITE_ROOT = resolve(import.meta.dirname, '..');
const REPOSITORY_ROOT = resolve(SITE_ROOT, '..');
const USAGE = 'usage: npm run repair:entry -- --pr <pull request number> --head <40 hex commit sha>';
const FLAGS = ['--pr', '--head'];

class UsageError extends Error {}

const repairLazily = async (request) => (await import('./repair-run.mjs')).repairWithDefaults(request);

function argumentsOf(argv) {
  const options = {};
  for (let at = 0; at < argv.length; at += 2) {
    const value = argv[at + 1];
    if (!FLAGS.includes(argv[at]) || value === undefined || value.startsWith('--')) throw new UsageError(USAGE);
    options[argv[at]] = value;
  }
  if (!/^[1-9][0-9]*$/.test(options['--pr'] ?? '') || !/^[0-9a-f]{40}$/.test(options['--head'] ?? ''))
    throw new UsageError(USAGE);
  return { number: Number(options['--pr']), head: options['--head'] };
}

function requiredVariable(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new WriterError('config', name + ' is not set', { variables: [name] });
  return value;
}

const successLine = ({ commit, slug, attempt, gates, spend }) => ({
  ok: true,
  outcome: 'repaired',
  commit,
  reason: 'repaired ' + slug + ' in attempt ' + attempt,
  slug,
  attempt,
  gates,
  spend,
});

function stopOf(error, secrets) {
  const failure = failureOf(error, secrets);
  const stopped = error instanceof RepairStop;
  const outcome = stopped ? error.outcome : failure.kind === 'credential' ? 'credential' : 'failed';
  const kind = stopped ? error.outcome : failure.kind;
  return {
    failure: { ...failure, kind },
    line: {
      ok: false,
      outcome,
      commit: null,
      reason: failure.message,
      kind,
      variables: failure.variables,
      spend: failure.spend,
    },
  };
}

export async function runCli(argv, io = {}) {
  const {
    env = process.env,
    repoRoot = REPOSITORY_ROOT,
    stdout = console.log,
    stderr = console.error,
    fetch = globalThis.fetch,
    now = () => new Date(),
    run = runProcess,
    repair = repairLazily,
  } = io;
  let secrets = keysInEnvironment(env);
  const say = (write, line) => write(redact(line, secrets));
  try {
    markUnattended(env);
    const config = readWriterConfig(env);
    secrets = secretsOf([config.vendor]);
    const { number, head } = argumentsOf(argv);
    const api = createApi({
      repo: requiredVariable(env, 'GITHUB_REPOSITORY'),
      token: requiredVariable(env, 'GITHUB_TOKEN'),
      fetch,
    });
    const adapter = createAdapter({ vendor: config.vendor, fetch });
    const result = await repair({ api, adapter, repoRoot, number, head, now: now(), run, secrets });
    say(stdout, JSON.stringify(successLine(result)));
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      say(stderr, error.message);
      return 2;
    }
    const { failure, line } = stopOf(error, secrets);
    for (const text of explain('repair:entry', failure, error)) say(stderr, text);
    say(stdout, JSON.stringify(line));
    return exitCodeOf(line.outcome);
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  process.chdir(SITE_ROOT);
  process.exitCode = await runCli(process.argv.slice(2));
}
