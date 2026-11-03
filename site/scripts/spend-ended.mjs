import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { readLedger } from './autowriter-ledger.mjs';
import { issueLink, runLink } from './github-links.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { deliverNotice } from './slack-notice.mjs';
import { ceilingStatus } from './spend-ceiling.mjs';
import { noticeFile } from './spend-notice.mjs';
import { endedMessage } from './spend-slack.mjs';
import { ledgerStemOf, microOf } from './spend-sum.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const COMMAND_FLAGS = { ceiling: [], pick: ['decision'], write: ['decision', 'result'] };
const USAGE = [
  'Usage: node scripts/spend-ended.mjs ceiling [--repo-root <dir>]',
  '       node scripts/spend-ended.mjs pick --decision <file the pick step wrote> [--repo-root <dir>]',
  '       node scripts/spend-ended.mjs write --decision <file the pick step wrote> --result <file the write step wrote> [--repo-root <dir>]',
].join('\n');

class UsageError extends Error {}

const oneLine = (text) => text.replace(/\s+/g, ' ').trim();

function parseArguments(argv) {
  const [command, ...pairs] = argv;
  if (!Object.hasOwn(COMMAND_FLAGS, command ?? '')) throw new UsageError(`unknown ending ${command ?? '(none)'}`);
  const allowed = ['repo-root', ...COMMAND_FLAGS[command]];
  const options = {};
  for (let at = 0; at < pairs.length; at += 2) {
    const name = pairs[at].startsWith('--') ? pairs[at].slice(2) : null;
    if (!allowed.includes(name)) throw new UsageError(`unknown argument ${pairs[at]}`);
    if (pairs[at + 1] === undefined) throw new UsageError(`${pairs[at]} needs a value`);
    options[name] = pairs[at + 1];
  }
  const missing = COMMAND_FLAGS[command].filter((name) => options[name] === undefined);
  if (missing.length > 0) throw new UsageError(`${command} needs ${missing.map((name) => `--${name}`).join(' and ')}`);
  return { command, options };
}

function readDecision(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path} is not readable JSON: ${error.message}`, { cause: error });
  }
}

const readResult = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

const ledgerMicro = ({ generation, attempts }) =>
  attempts.reduce((total, { costUsd }) => total + microOf(costUsd), microOf(generation?.costUsd ?? 0));

const escalationIssue = ({ escalations }) =>
  escalations
    .flatMap(({ receipts }) => receipts)
    .filter(({ channel, delivered }) => channel === 'issue' && delivered)
    .at(-1)?.issue ?? null;

function pickEnding(decisionFile) {
  const { decision, reason, choice } = readDecision(decisionFile);
  if (decision === 'write') throw new UsageError(`${decisionFile} says write, so this is not a day without an entry`);
  if (decision === 'none' && typeof reason === 'string')
    return { reason: `the picker chose nothing to write: ${reason}`, runMicro: 0, issue: null };
  if (decision === 'strengthen' && typeof choice === 'string')
    return { reason: `the picker chose to strengthen a page and wrote nothing: ${choice}`, runMicro: 0, issue: null };
  throw new Error(`${decisionFile} does not say why nothing was picked: decision ${JSON.stringify(decision)}`);
}

function skippedReason(skipped) {
  if (!Array.isArray(skipped) || skipped.length === 0)
    return 'the write ended with no entry and named no skipped draft';
  const named = skipped.map(({ format, slug, reason }) => `${format} ${slug} was skipped (${oneLine(reason)})`);
  return `the write ended with no entry, because ${named.join('; ')}`;
}

function stoppedReason({ slug, result }) {
  const kind = result?.ok === false && typeof result.kind === 'string' ? result.kind : null;
  return kind === null
    ? `the write stopped on ${slug} and the writer printed no result`
    : `the write stopped on ${slug} (${kind})`;
}

function writeEnding({ decisionFile, resultFile, repoRoot }) {
  const decision = readDecision(decisionFile);
  if (decision.decision !== 'write' || typeof decision.ledgerPath !== 'string')
    throw new UsageError(`${decisionFile} is not the decision of a write: it must say write and name a ledgerPath`);
  const result = readResult(resultFile);
  const wrote = result?.ok === true && Array.isArray(result.entries);
  if (wrote && result.entries.length > 0)
    throw new UsageError(`${resultFile} lists entries, so this is not a day without an entry`);
  const ledger = readLedger(join(repoRoot, decision.ledgerPath));
  const slug = ledgerStemOf(decision.ledgerPath);
  return {
    reason: wrote ? skippedReason(result.skipped) : stoppedReason({ slug, result }),
    runMicro: ledgerMicro(ledger),
    issue: escalationIssue(ledger),
  };
}

const noticeIssue = ({ repoRoot, month }) => {
  const path = join(repoRoot, noticeFile(month));
  return existsSync(path) ? escalationIssue(readLedger(path)) : null;
};

const endingOf = ({ command, options, repoRoot, status }) => {
  if (command === 'ceiling')
    return {
      reason: "the month's spend reached the ceiling, so the writer did not run",
      runMicro: 0,
      issue: noticeIssue({ repoRoot, month: status.month }),
    };
  if (command === 'pick') return pickEnding(resolve(options.decision));
  return writeEnding({ decisionFile: resolve(options.decision), resultFile: resolve(options.result), repoRoot });
};

export async function runCli(argv, io = {}) {
  const { env = process.env, fetch = globalThis.fetch, now = () => new Date() } = io;
  const { stdout = console.log, stderr = console.error } = io;
  try {
    const { command, options } = parseArguments(argv);
    const repoRoot = options['repo-root'] === undefined ? REPOSITORY_ROOT : resolve(options['repo-root']);
    const instant = now();
    const status = ceilingStatus({ repoRoot, now: instant });
    const { reason, runMicro, issue } = endingOf({ command, options, repoRoot, status });
    const message = endedMessage({
      date: instant.toISOString().slice(0, 10),
      reason,
      runMicro,
      status,
      links: { run: runLink(env), issue: issueLink(env, issue) },
    });
    await deliverNotice({ label: 'spend ended', message, env, fetch, instant, stdout, stderr });
    return 0;
  } catch (error) {
    if (!(error instanceof UsageError)) {
      stderr(`spend ended: ${error.message}`);
      return 1;
    }
    stderr(`spend ended: ${error.message}\n${USAGE}`);
    return 2;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
