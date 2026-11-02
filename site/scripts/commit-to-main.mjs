import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describeRefusal, isDispositionFile, refusalFor, sealSignature } from './autowriter-refusals.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';

const USAGE =
  'Usage: node scripts/commit-to-main.mjs --message <text> --path <repo-relative> [--path ...] [--ref main]';
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const MAX_PUSH_ATTEMPTS = 3;
const USERINFO = /:\/\/[^/\s@]+@/g;
const REMOTE_MOVED = /non-fast-forward|fetch first|tip of your current branch is behind|Updates were rejected/i;
const REBASE_CONFLICT = /CONFLICT|could not apply|Resolve all conflicts/i;
const REFERENCE_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const WINDOWS_DRIVE = /^[A-Za-z]:/;
const FLAGS = new Map([
  ['--message', 'message'],
  ['--path', 'paths'],
  ['--ref', 'ref'],
]);

export class CommitError extends Error {}

class UsageError extends Error {}

const redact = (text) => String(text).replace(USERINFO, '://***@');

const refusedMessage = (refusal) => `refused ${refusal.path}: ${describeRefusal(refusal)}`;

export function runGit(args, { cwd }) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr || result.error?.message || '',
  };
}

function isUnsafePath(path) {
  if (typeof path !== 'string' || path.trim() === '') return true;
  if (path.startsWith('/') || path.startsWith('\\') || WINDOWS_DRIVE.test(path)) return true;
  return path.split(/[\\/]/).includes('..');
}

function validateRequest({ paths, message, identity, ref, remote }) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new CommitError('paths must be a non-empty array of repo-relative file paths; got none');
  }
  const unsafe = paths.find(isUnsafePath);
  if (unsafe !== undefined) {
    throw new CommitError(`paths must be repo-relative with no ".." segment; refused ${JSON.stringify(unsafe)}`);
  }
  for (const path of paths) {
    const refusal = refusalFor(path);
    if (refusal !== null) throw new CommitError(refusedMessage(refusal));
  }
  if (typeof message !== 'string' || message.trim() === '') throw new CommitError('message must be a non-empty string');
  if (!identity?.name || !identity?.email) throw new CommitError('identity must carry both name and email');
  for (const [label, value] of [
    ['ref', ref],
    ['remote', remote],
  ]) {
    if (!REFERENCE_NAME.test(value)) throw new CommitError(`${label} ${JSON.stringify(value)} is not a plain git name`);
  }
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

async function rebaseOntoRemote({ run, cwd, remote, ref, flags }) {
  const pulled = await run([...flags, 'pull', '--rebase', '--autostash', remote, ref], { cwd });
  if (pulled.status === 0) return;
  const output = redact(`${pulled.stdout}\n${pulled.stderr}`).trim();
  if (!REBASE_CONFLICT.test(output)) throw new CommitError(`git pull --rebase ${remote} ${ref} failed: ${output}`);
  await run(['rebase', '--abort'], { cwd });
  throw new CommitError(
    `rebase onto ${remote}/${ref} hit a conflict; the rebase was aborted and nothing was pushed or forced: ${output}`
  );
}

async function pushWithRebase(context) {
  const { run, cwd, remote, ref } = context;
  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt += 1) {
    const pushed = await run(['push', remote, `HEAD:refs/heads/${ref}`], { cwd });
    if (pushed.status === 0) return;
    if (!REMOTE_MOVED.test(pushed.stderr)) {
      throw new CommitError(`git push to ${remote} ${ref} failed: ${redact(pushed.stderr).trim()}`);
    }
    if (attempt < MAX_PUSH_ATTEMPTS) await rebaseOntoRemote(context);
  }
  throw new CommitError(
    `push to ${remote} ${ref} was rejected ${MAX_PUSH_ATTEMPTS} times because the remote kept moving; nothing was forced`
  );
}

async function shownText(run, cwd, revision) {
  const shown = await run(['show', revision], { cwd });
  return shown.status === 0 ? shown.stdout : null;
}

async function sealIn({ run, cwd, path }) {
  if (!isDispositionFile(path)) return null;
  const before = await shownText(run, cwd, `HEAD:${path}`);
  const after = await shownText(run, cwd, `:${path}`);
  return sealSignature({ path, before, after });
}

async function refusalAmong({ run, cwd, names }) {
  for (const path of names) {
    const refusal = refusalFor(path) ?? (await sealIn({ run, cwd, path }));
    if (refusal !== null) return refusal;
  }
  return null;
}

async function refuseStaged({ run, cwd, paths, names }) {
  const refusal = await refusalAmong({ run, cwd, names });
  if (refusal === null) return;
  const unstaged = await run(['reset', '--quiet', '--', ...paths], { cwd });
  const stuck = unstaged.status === 0 ? '' : `; the paths are still staged: ${redact(unstaged.stderr).trim()}`;
  throw new CommitError(`${refusedMessage(refusal)}${stuck}`);
}

export async function commitAndPush({
  repoRoot,
  paths,
  message,
  identity,
  ref = 'main',
  remote = 'origin',
  run = runGit,
}) {
  validateRequest({ paths, message, identity, ref, remote });
  const step = gitStep(run, repoRoot);
  const flags = identityFlags(identity);
  await step('add', ['add', '--', ...paths]);
  const staged = await step('diff', ['diff', '--cached', '--name-only', '--no-renames', '--', ...paths]);
  if (staged.stdout.trim() === '') return { committed: false, commit: null };
  await refuseStaged({ run, cwd: repoRoot, paths, names: staged.stdout.split('\n').filter(Boolean) });
  await step('commit', [...flags, 'commit', '--message', message, '--', ...paths]);
  await pushWithRebase({ run, cwd: repoRoot, remote, ref, flags });
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
  { repoRoot = REPOSITORY_ROOT, out = console.log, err = console.error, commit = commitAndPush } = {}
) {
  try {
    const { message, paths, ref = 'main' } = parseArguments(argv);
    const identity = { name: BOT_NAME, email: BOT_EMAIL };
    const result = await commit({ repoRoot, paths, message, identity, ref });
    out(result.committed ? `committed ${result.commit}` : 'nothing to commit');
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      err(`commit-to-main: ${error.message}\n${USAGE}`);
      return 2;
    }
    err(`commit-to-main: ${redact(error.message)}`);
    return 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
