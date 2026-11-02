import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ledgerFile, newLedger, readLedger, writeLedger } from './autowriter-ledger.mjs';
import { variable } from './escalate-channels.mjs';
import { EscalationError, escalate } from './escalate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { BOT_EMAIL, classifyPullRequest, slugOfBranch } from './pr-classify.mjs';
import {
  GitHubError,
  createApi,
  dispatchSuccessor,
  mergePullRequest,
  putLedger,
  readSnapshot,
  tickProblem,
} from './pr-github.mjs';

export const SECRET = 'AUTOWRITER_PAT';
export const TICK_ENVIRONMENT = 'autowriter-tick';
export const TICK_MINUTES = 10;
export const WORKFLOW = 'watch-pr.yml';

const USAGE = 'Usage: node scripts/pr-watch.mjs --pr <number> [--observed <token>]';
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const BOT_IDENTITY = { name: 'autowriter-bot', email: BOT_EMAIL };
const GITHUB = { createApi, readSnapshot, mergePullRequest, dispatchSuccessor, putLedger, tickProblem };
const FLAGS = new Map([
  ['--pr', 'number'],
  ['--observed', 'observed'],
]);
const PULL_REQUEST_NUMBER = /^[1-9][0-9]{0,8}$/;
const OBSERVATION = /^[A-Za-z0-9:._-]{0,200}$/;

const REQUIRED_VARIABLES = [
  ['GITHUB_REPOSITORY', 'GITHUB_REPOSITORY is not set; Actions sets it, and a run by hand passes owner/name'],
  ['GITHUB_TOKEN', 'GITHUB_TOKEN is not set; the workflow passes secrets.GITHUB_TOKEN, and every read uses it'],
  [
    SECRET,
    `${SECRET} is not set; create a fine-grained personal access token for the bot account and store it as the repository secret ${SECRET}`,
  ],
];

const STATEMENTS = {
  'not-a-content-gate': 'a job that is not a content gate failed, so the loop may not repair it',
  'content-gate': 'a content gate failed, and this phase repairs nothing yet',
  'attempt-cap': 'the attempt cap is spent and the checks are still red',
  'inconclusive-cancel': 'the CI run was cancelled twice with no failed job to explain it',
  'skipped-gate': 'a required job was skipped, and GitHub counts a skipped job as passed',
  'missing-check': 'a required check never appeared on the head commit',
  'unexpected-conclusion': 'a required job ended in a conclusion the watcher does not read as green',
  'approval-required': 'the CI run waits for a person to approve it, so the push started no CI',
  'run-without-jobs': 'the CI run finished without creating a job',
  'no-pull-request-run': 'the head commit has checks, but none from the pull-request run',
  'no-checks': 'the head commit has no check runs',
  'chain-too-old': 'the watcher has been waiting longer than a pull request may take to settle',
};

export class WatchError extends Error {}

class UsageError extends Error {}

export function parseArguments(argv) {
  const found = {};
  for (let at = 0; at < argv.length; at += 2) {
    if (!FLAGS.has(argv[at]) || at + 1 >= argv.length)
      throw new UsageError(`${USAGE}\nunexpected argument ${argv[at]}`);
    found[FLAGS.get(argv[at])] = argv[at + 1];
  }
  if (!PULL_REQUEST_NUMBER.test(found.number ?? '')) throw new UsageError(`${USAGE}\n--pr needs a whole number`);
  const observed = found.observed ?? '';
  if (!OBSERVATION.test(observed)) throw new UsageError(`${USAGE}\n--observed holds only letters, digits and : . _ -`);
  return { number: Number(found.number), observed };
}

function connect({ env, fetch, io }) {
  const missing = REQUIRED_VARIABLES.filter(([name]) => variable(env, name) === '').map(([, hint]) => hint);
  if (missing.length > 0) throw new WatchError(missing.join('; '));
  const repo = variable(env, 'GITHUB_REPOSITORY');
  return {
    reader: io.createApi({ repo, token: variable(env, 'GITHUB_TOKEN'), fetch }),
    writer: io.createApi({ repo, token: variable(env, SECRET), fetch }),
  };
}

const pullRequestUrl = ({ env, number }) =>
  `${variable(env, 'GITHUB_SERVER_URL') || 'https://github.com'}/${variable(env, 'GITHUB_REPOSITORY')}/pull/${number}`;

function findingFor({ result, number, env }, kind) {
  const { head, failing = [], jobs = [] } = result.evidence;
  const named = failing.map(({ job, gate }) => (gate ? `${job} (${gate})` : job));
  const lines = [
    `The watcher judged head ${head}: ${result.verdict}, ${result.reason}.`,
    ...(named.length > 0 ? [`Failing: ${named.join(', ')}.`] : []),
    ...(jobs.length > 0 ? [`Jobs: ${jobs.join(', ')}.`] : []),
    `Pull request: ${pullRequestUrl({ env, number })}`,
  ];
  return {
    kind,
    title: `Autowriter pull request #${number}: ${STATEMENTS[result.reason] ?? result.reason}`,
    detail: lines.join('\n'),
  };
}

function credentialFinding({ number }, error) {
  return {
    kind: 'credential',
    title: `${SECRET} was refused by GitHub while handling pull request #${number}`,
    detail: [
      `GitHub answered ${error.status} to ${error.method} ${error.path}: ${error.body?.message ?? error.message}.`,
      `Create a fine-grained personal access token for the bot account with Contents, Pull requests and Actions write access to this repository,`,
      `store it as the repository secret ${SECRET}, then run the Watch PR workflow again for pull request #${number}.`,
    ].join(' '),
  };
}

const isCredentialFailure = ({ status, body }) =>
  status === 401 || (status === 403 && !/rate limit/i.test(body?.message ?? ''));

async function asBot(step, write) {
  try {
    return await write();
  } catch (error) {
    if (!(error instanceof GitHubError) || !isCredentialFailure(error)) throw error;
    await raise(step, credentialFinding(step, error), { publish: false });
    throw error;
  }
}

function stageLedger({ snapshot, workdir, number, env }) {
  const slug = slugOfBranch(snapshot.pullRequest.head.ref);
  const path = ledgerFile(slug);
  const runId = variable(env, 'GITHUB_RUN_ID') || 'local';
  const ledgerPath = join(workdir, path);
  writeLedger(ledgerPath, snapshot.ledger?.value ?? newLedger({ slug, runId, pullRequest: number }));
  return { slug, path, ledgerPath };
}

async function deliver({ env, fetch, now, ledgerPath }, { kind, title, detail }) {
  try {
    await escalate({ ledgerPath, kind, title, detail, env, fetch, now });
    return null;
  } catch (error) {
    if (error instanceof EscalationError) return error;
    throw error;
  }
}

function recordVerdict({ ledgerPath, reason, now }) {
  const ledger = readLedger(ledgerPath);
  writeLedger(ledgerPath, { ...ledger, verdict: { state: 'escalated', reason, decidedAt: now().toISOString() } });
}

function pushLedger({ io, writer, snapshot }, { slug, path, ledgerPath }) {
  return io.putLedger(writer, {
    path,
    text: readFileSync(ledgerPath, 'utf8'),
    blobSha: snapshot.ledger?.blobSha ?? null,
    branch: snapshot.pullRequest.head.ref,
    message: `chore(autowriter): record the escalation of ${slug}`,
    identity: BOT_IDENTITY,
  });
}

async function raise(step, finding, { publish = true } = {}) {
  const staged = stageLedger(step);
  const undelivered = await deliver({ ...step, ledgerPath: staged.ledgerPath }, finding);
  recordVerdict({ ledgerPath: staged.ledgerPath, reason: finding.title, now: step.now });
  if (publish) await asBot(step, () => pushLedger(step, staged));
  if (undelivered) throw undelivered;
  return 'escalated';
}

async function continueChain(step) {
  const { number, result, reader, writer, env, io } = step;
  const problem = await io.tickProblem(reader, { environment: TICK_ENVIRONMENT, minutes: TICK_MINUTES });
  if (problem !== null) throw new WatchError(problem);
  const ref = variable(env, 'GITHUB_REF_NAME');
  if (ref === '')
    throw new WatchError('GITHUB_REF_NAME is not set; the successor needs the branch that holds the workflow');
  const inputs = { pr: String(number), observed: result.observe };
  await asBot(step, () => io.dispatchSuccessor(writer, { workflow: WORKFLOW, ref, inputs }));
  return 'successor';
}

async function merge(step) {
  const { number, result, writer, io } = step;
  const outcome = await asBot(step, () => io.mergePullRequest(writer, { number, head: result.evidence.head }));
  if (outcome.merged) return 'merged';
  if (outcome.reason === 'head-moved') return continueChain(step);
  return raise(step, {
    kind: 'hard-stop',
    title: `Autowriter pull request #${number}: GitHub refused the merge`,
    detail: `GitHub answered: ${outcome.message}. The checks were green and the quarantine had passed, so a repository rule or a conflict stops it, and only a person can read that.`,
  });
}

const ACTIONS = {
  merge,
  unsettled: continueChain,
  repairable: (step) => raise(step, findingFor(step, 'unrepairable')),
  escalate: (step) => raise(step, findingFor(step, step.result.kind)),
  'blocked-by-human': async () => 'stopped',
  done: async () => 'stopped',
};

function writeSummary({ env, number, result, action }) {
  const target = variable(env, 'GITHUB_STEP_SUMMARY');
  if (target === '') return;
  const rows = [
    ['Verdict', result.verdict],
    ['Reason', result.reason],
    ['Action', action],
    ['Head judged', result.evidence.head],
  ];
  const table = rows.map(([label, value]) => `| ${label} | \`${value}\` |`);
  appendFileSync(target, [`### Watch pull request #${number}`, '', '| | |', '| --- | --- |', ...table, ''].join('\n'));
}

export async function watch({
  number,
  observed = '',
  env = process.env,
  fetch = globalThis.fetch,
  io = GITHUB,
  workdir = REPOSITORY_ROOT,
  now = () => new Date(),
}) {
  const step = { number, env, fetch, io, workdir, now, ...connect({ env, fetch, io }) };
  const snapshot = await io.readSnapshot(step.reader, number);
  const ledger = snapshot.ledger?.value ?? null;
  const result = classifyPullRequest({ ...snapshot, ledger, previous: observed, now: now() });
  let action = 'failed';
  try {
    action = await ACTIONS[result.verdict]({ ...step, snapshot, result });
    return { result, action };
  } finally {
    writeSummary({ env, number, result, action });
  }
}

export async function runCli(argv, { stdout = console.log, stderr = console.error, ...options } = {}) {
  try {
    const { number, observed } = parseArguments(argv);
    const { result, action } = await watch({ number, observed, ...options });
    stdout(`pr-watch: pull request #${number} ${result.verdict} (${result.reason}), ${action}`);
    return 0;
  } catch (error) {
    stderr(`pr-watch: ${error.message}`);
    return error instanceof UsageError ? 2 : 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
