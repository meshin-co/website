import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MONTHLY_SPEND_CEILING_USD } from './autowriter-ledger.mjs';
import { runGit } from './commit-to-main.mjs';
import { variable } from './escalate-channels.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { noticeFile, noticePosted, raiseNotice } from './spend-notice.mjs';
import { readLedgers } from './spend-sources.mjs';
import { microOf, monthOf, monthlySpend, spendWarnings } from './spend-sum.mjs';

export { monthOf, monthlySpend };

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const MICRO = 1e6;
const FLAGS = ['repo-root', 'now'];
const USAGE =
  'Usage: node scripts/spend-ceiling.mjs [--repo-root <dir>] [--now <UTC instant, such as 2026-11-01T00:00:00Z>]';

class UsageError extends Error {}

export function inspect({
  repoRoot = REPOSITORY_ROOT,
  now = new Date(),
  run = runGit,
  ceilingUsd = MONTHLY_SPEND_CEILING_USD,
}) {
  const month = monthOf(now);
  const ledgers = readLedgers({ repoRoot, run });
  const spentMicro = monthlySpend({ ledgers, month });
  return {
    status: {
      month,
      spentMicro,
      spentUsd: spentMicro / MICRO,
      ceilingUsd,
      reached: spentMicro >= microOf(ceilingUsd),
      noticePosted: noticePosted({ repoRoot, month }),
    },
    warnings: spendWarnings({ ledgers }),
    read: { ledgers: ledgers.length, records: ledgers.filter(({ record }) => record !== null).length },
  };
}

export const ceilingStatus = (options) => inspect(options).status;

function parseArguments(argv) {
  const options = {};
  for (let at = 0; at < argv.length; at += 2) {
    const name = argv[at].startsWith('--') ? argv[at].slice(2) : null;
    if (!FLAGS.includes(name)) throw new UsageError(`unknown argument ${argv[at]}`);
    if (argv[at + 1] === undefined) throw new UsageError(`${argv[at]} needs a value`);
    options[name] = argv[at + 1];
  }
  if (options.now !== undefined) {
    try {
      monthOf(options.now);
    } catch (error) {
      throw new UsageError(`--now: ${error.message}`, { cause: error });
    }
  }
  return options;
}

async function settleNotice({ status, repoRoot, env, fetch, now }) {
  if (!status.reached) return 'none';
  if (status.noticePosted) return 'exists';
  const { month, spentUsd, ceilingUsd } = status;
  await raiseNotice({ repoRoot, month, spentUsd, ceilingUsd, env, fetch, now });
  return 'written';
}

function summaryOf({ status, notice }) {
  const { month, spentUsd, ceilingUsd, reached } = status;
  const verdict = reached
    ? 'The ceiling is reached, so the write job is skipped.'
    : 'The ceiling is not reached, so the write job may run.';
  return [
    `### Spend ceiling for ${month}`,
    '',
    '| Month (UTC) | Spent (USD) | Ceiling (USD) | Reached | Notice |',
    '| --- | --- | --- | --- | --- |',
    `| ${month} | ${spentUsd} | ${ceilingUsd} | ${reached} | ${notice} |`,
    '',
    'No model was called by this job.',
    verdict,
    '',
  ].join('\n');
}

function appendTo(env, name, text) {
  const path = variable(env, name);
  if (path !== '') appendFileSync(path, text);
}

export async function runCli(argv, io = {}) {
  const { env = process.env, fetch = globalThis.fetch, now = () => new Date(), run = runGit } = io;
  const { ceilingUsd = MONTHLY_SPEND_CEILING_USD, stdout = console.log, stderr = console.error } = io;
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    stderr(`spend-ceiling: ${error.message}\n${USAGE}`);
    return 2;
  }
  const repoRoot = options['repo-root'] === undefined ? REPOSITORY_ROOT : resolve(options['repo-root']);
  const at = options.now === undefined ? now() : new Date(options.now);
  try {
    const { status, warnings, read } = inspect({ repoRoot, now: at, run, ceilingUsd });
    warnings.forEach((warning) => stderr(`warning: ${warning}`));
    const notice = await settleNotice({ status, repoRoot, env, fetch, now: () => at });
    const lines = [`stopped=${status.reached}`, `notice=${notice}`, `ledger=${noticeFile(status.month)}`];
    appendTo(env, 'GITHUB_OUTPUT', `${lines.join('\n')}\n`);
    appendTo(env, 'GITHUB_STEP_SUMMARY', summaryOf({ status, notice }));
    const { month, spentUsd, reached } = status;
    stdout(JSON.stringify({ month, spentUsd, ceilingUsd, reached, notice, ...read }));
    return 0;
  } catch (error) {
    stderr(`spend-ceiling: ${error.message}`);
    return 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
