import {
  describeRefusal,
  isDispositionFile,
  refusalFor,
  removalRefusalFor,
  sealSignature,
} from './autowriter-refusals.mjs';
import { runGit } from './run-git.mjs';

const MAX_PUSH_ATTEMPTS = 3;
const USERINFO = /:\/\/[^/\s@]+@/g;
const REMOTE_MOVED = /non-fast-forward|fetch first|tip of your current branch is behind|Updates were rejected/i;
const REBASE_CONFLICT = /CONFLICT|could not apply|Resolve all conflicts/i;
const REFERENCE_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const PROTECTED_BRANCH = /^(?:refs\/heads\/)?(?:main|master)$/i;
const WINDOWS_DRIVE = /^[A-Za-z]:/;

export class CommitError extends Error {}

const redact = (text) => String(text).replace(USERINFO, '://***@');

const refusedMessage = (refusal) => `refused ${refusal.path}: ${describeRefusal(refusal)}`;

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
    if (typeof value !== 'string' || !REFERENCE_NAME.test(value))
      throw new CommitError(`${label} ${JSON.stringify(value)} is not a plain git name`);
  }
  if (PROTECTED_BRANCH.test(ref))
    throw new CommitError(
      `commit-branch never commits to ${JSON.stringify(ref)}: the writer writes no file to main or master`
    );
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

async function removalAmong({ run, cwd, paths, names }) {
  if (names.every((path) => removalRefusalFor(path) === null)) return null;
  const removed = await gitStep(run, cwd)('diff', [
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=D',
    '--no-renames',
    '--',
    ...paths,
  ]);
  for (const path of removed.stdout.split('\n').filter(Boolean)) {
    const refusal = removalRefusalFor(path);
    if (refusal !== null) return refusal;
  }
  return null;
}

async function refuseStaged({ run, cwd, paths, names }) {
  const refusal = (await refusalAmong({ run, cwd, names })) ?? (await removalAmong({ run, cwd, paths, names }));
  if (refusal === null) return;
  const unstaged = await run(['reset', '--quiet', '--', ...paths], { cwd });
  const stuck = unstaged.status === 0 ? '' : `; the paths are still staged: ${redact(unstaged.stderr).trim()}`;
  throw new CommitError(`${refusedMessage(refusal)}${stuck}`);
}

export async function commitToBranch({ repoRoot, paths, message, identity, ref, remote = 'origin', run = runGit }) {
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
