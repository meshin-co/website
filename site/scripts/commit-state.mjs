import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { STATE_RECORD, describeRefusal, refusalFor } from './autowriter-refusals.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';
import { STATE_BRANCH, STATE_DIRECTORY, isStatePath } from './record-layout.mjs';
import { runGit } from './run-git.mjs';

const USAGE = `Usage: node scripts/commit-state.mjs --message <text> --path ${STATE_DIRECTORY}/<file> [--path ...] [--ref ${STATE_BRANCH}]`;
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const MAX_PUSH_ATTEMPTS = 3;
const REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const REMOTE_MOVED = /non-fast-forward|fetch first|tip of your current branch is behind|Updates were rejected/i;
const REBASE_CONFLICT = /CONFLICT|could not apply|Resolve all conflicts/i;
const BRANCH_ABSENT = /couldn't find remote ref/i;
const SECRETS = [
  [/:\/\/[^/\s@]+@/g, '://***@'],
  [/(authorization:\s*)(?:basic|bearer|token)\s+\S+/gi, '$1***'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})\b/g, '***'],
];
const FLAGS = new Map([
  ['--message', 'message'],
  ['--path', 'paths'],
  ['--ref', 'ref'],
]);

export class CommitError extends Error {}

class UsageError extends Error {}

export const redact = (text) => SECRETS.reduce((clean, [pattern, mask]) => clean.replace(pattern, mask), String(text));

function refusePath(path) {
  if (isStatePath(path)) return;
  const refusal = typeof path === 'string' ? refusalFor(path) : null;
  const named = refusal === null || refusal.id === STATE_RECORD ? null : describeRefusal(refusal);
  const why = named ?? `commit-state commits only paths under ${STATE_DIRECTORY}/`;
  throw new CommitError(`refused ${JSON.stringify(path)}: ${why}`);
}

function validateRequest({ paths, message, identity, ref, remote }) {
  if (!Array.isArray(paths) || paths.length === 0)
    throw new CommitError(`paths must be a non-empty array of paths under ${STATE_DIRECTORY}/; got none`);
  paths.forEach(refusePath);
  if (ref !== STATE_BRANCH)
    throw new CommitError(`commit-state writes only to ${STATE_BRANCH}, never to ${JSON.stringify(ref)}`);
  if (typeof message !== 'string' || message.trim() === '') throw new CommitError('message must be a non-empty string');
  if (!identity?.name || !identity?.email) throw new CommitError('identity must carry both name and email');
  if (typeof remote !== 'string' || !REMOTE_NAME.test(remote))
    throw new CommitError(`remote ${JSON.stringify(remote)} is not a plain git remote name`);
}

const identityFlags = ({ name, email }) => [
  '-c',
  `user.name=${name}`,
  '-c',
  `user.email=${email}`,
  '-c',
  'commit.gpgsign=false',
];

const gitStep = (run, cwd) => async (label, args) => {
  const result = await run(args, { cwd });
  if (result.status !== 0) throw new CommitError(`git ${label} failed in ${cwd}: ${redact(result.stderr).trim()}`);
  return result;
};

async function alignWithRemote({ run, step, cwd, remote }) {
  const fetched = await run(['fetch', remote, STATE_BRANCH], { cwd });
  const remoteHasBranch = fetched.status === 0;
  if (!remoteHasBranch && !BRANCH_ABSENT.test(fetched.stderr))
    throw new CommitError(`git fetch ${remote} ${STATE_BRANCH} failed in ${cwd}: ${redact(fetched.stderr).trim()}`);
  const hasHistory = (await run(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd })).status === 0;
  if (!hasHistory) return;
  if (remoteHasBranch) {
    const related = await run(['merge-base', 'HEAD', 'FETCH_HEAD'], { cwd });
    if (related.status === 0) return;
    throw new CommitError(
      `${STATE_DIRECTORY} is not a checkout of ${STATE_BRANCH}: its history shares no commit with ${remote}/${STATE_BRANCH}; nothing was committed or pushed`
    );
  }
  const current = await run(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd });
  if (current.stdout.trim() === STATE_BRANCH) return;
  await step('symbolic-ref', ['symbolic-ref', 'HEAD', `refs/heads/${STATE_BRANCH}`]);
  await step('read-tree', ['read-tree', '--empty']);
}

async function rebaseOntoRemote({ run, cwd, remote, flags }) {
  const pulled = await run([...flags, 'pull', '--rebase', '--autostash', remote, STATE_BRANCH], { cwd });
  if (pulled.status === 0) return;
  const output = redact(`${pulled.stdout}\n${pulled.stderr}`).trim();
  if (!REBASE_CONFLICT.test(output))
    throw new CommitError(`git pull --rebase ${remote} ${STATE_BRANCH} failed: ${output}`);
  await run(['rebase', '--abort'], { cwd });
  throw new CommitError(
    `rebase onto ${remote}/${STATE_BRANCH} hit a conflict; the rebase was aborted and nothing was pushed or forced: ${output}`
  );
}

async function pushWithRebase(context) {
  const { run, cwd, remote } = context;
  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt += 1) {
    const pushed = await run(['push', remote, `HEAD:refs/heads/${STATE_BRANCH}`], { cwd });
    if (pushed.status === 0) return;
    if (!REMOTE_MOVED.test(pushed.stderr))
      throw new CommitError(`git push to ${remote} ${STATE_BRANCH} failed: ${redact(pushed.stderr).trim()}`);
    if (attempt < MAX_PUSH_ATTEMPTS) await rebaseOntoRemote(context);
  }
  throw new CommitError(
    `push to ${remote} ${STATE_BRANCH} was rejected ${MAX_PUSH_ATTEMPTS} times because the remote kept moving; nothing was forced`
  );
}

const insideState = (path) => path.slice(STATE_DIRECTORY.length + 1);

export async function commitState({
  repoRoot,
  paths,
  message,
  identity,
  ref = STATE_BRANCH,
  remote = 'origin',
  run = runGit,
}) {
  validateRequest({ paths, message, identity, ref, remote });
  const cwd = join(repoRoot, STATE_DIRECTORY);
  if (!existsSync(join(cwd, '.git')))
    throw new CommitError(
      `${STATE_DIRECTORY} is not a git checkout of ${STATE_BRANCH}, so nothing can be committed there; check the branch out at ${STATE_DIRECTORY}/ first`
    );
  const step = gitStep(run, cwd);
  const flags = identityFlags(identity);
  const files = paths.map(insideState);
  await alignWithRemote({ run, step, cwd, remote });
  await step('add', ['add', '--', ...files]);
  const staged = await step('diff', ['diff', '--cached', '--name-only', '--no-renames', '--', ...files]);
  if (staged.stdout.trim() === '') return { committed: false, commit: null };
  await step('commit', [...flags, 'commit', '--message', message, '--', ...files]);
  await pushWithRebase({ run, cwd, remote, flags });
  const head = await step('rev-parse', ['rev-parse', 'HEAD']);
  return { committed: true, commit: head.stdout.trim() };
}

function parseArguments(argv) {
  const parsed = { paths: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const key = FLAGS.get(flag);
    if (!key) throw new UsageError(`unknown flag ${flag}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} needs a value`);
    if (key === 'paths') parsed.paths.push(value);
    else if (key in parsed) throw new UsageError(`${flag} was given twice`);
    else parsed[key] = value;
  }
  if (parsed.message === undefined) throw new UsageError('--message is required');
  if (parsed.paths.length === 0) throw new UsageError('--path is required, once per file');
  return parsed;
}

export async function runCli(
  argv,
  { repoRoot = REPOSITORY_ROOT, out = console.log, err = console.error, commit = commitState } = {}
) {
  try {
    const { message, paths, ref = STATE_BRANCH } = parseArguments(argv);
    const identity = { name: BOT_NAME, email: BOT_EMAIL };
    const result = await commit({ repoRoot, paths, message, identity, ref });
    out(result.committed ? `committed ${result.commit}` : 'nothing to commit');
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      err(`commit-state: ${error.message}\n${USAGE}`);
      return 2;
    }
    err(`commit-state: ${redact(error.message)}`);
    return 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
