import { posix } from 'node:path';

import { describeRefusal, isDispositionFile, refusalFor, refusalOf } from './autowriter-refusals.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';
import { fileTransaction, outputTail } from './route-transaction.mjs';
import { WriterError } from './writer-error.mjs';

const BRANCH_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const IDENTITY = `${BOT_NAME} <${BOT_EMAIL}>`;
const COMMIT_FLAGS = [
  '-c',
  `user.name=${BOT_NAME}`,
  '-c',
  `user.email=${BOT_EMAIL}`,
  '-c',
  'commit.gpgsign=false',
  '-c',
  'core.hooksPath=/dev/null',
];
const BOT_ON_BOTH_SIDES = [BOT_NAME, BOT_EMAIL, BOT_NAME, BOT_EMAIL].join('|');

function refuse(message) {
  throw new WriterError('commit', message);
}

const isPlainRepositoryPath = (path) =>
  typeof path === 'string' &&
  path !== '' &&
  !path.includes('\\') &&
  !path.endsWith('/') &&
  !posix.isAbsolute(path) &&
  posix.normalize(path) === path &&
  !path.split('/').some((part) => ['.', '..', '.git'].includes(part));

const refusedMessage = (refusal) =>
  `${refusal.path} may not be committed by the pipeline (${describeRefusal(refusal)})`;

function checkedBranch(branch) {
  if (typeof branch !== 'string' || !BRANCH_NAME.test(branch))
    refuse(`"${branch}" is not a branch name the writer will create`);
}

function checkedFiles({ files, message }) {
  if (typeof message !== 'string' || message.trim() === '') refuse('the commit message is empty');
  if (!Array.isArray(files) || files.length === 0) refuse('there is nothing to commit');
  const seen = new Set();
  for (const { path, text } of files.map((file) => file ?? {})) {
    if (!isPlainRepositoryPath(path)) refuse(`"${path}" is not a plain file path inside the repository`);
    const refusal = refusalFor(path);
    if (refusal !== null) refuse(refusedMessage(refusal));
    if (typeof text !== 'string') refuse(`the file ${path} has no text`);
    if (seen.has(path)) refuse(`${path} is listed twice`);
    seen.add(path);
  }
  return [...seen].sort();
}

function gitIn(run, repoRoot) {
  return async (subcommand, args = [], { prefix = [], tolerate = false } = {}) => {
    const result = await run('git', [...prefix, subcommand, ...args], { cwd: repoRoot });
    if (result.status !== 0 && !tolerate)
      refuse(`git ${subcommand} exited with status ${result.status}:\n${outputTail(result)}`);
    return result;
  };
}

async function startingPoint(git) {
  const commit = (await git('rev-parse', ['HEAD'])).stdout.trim();
  const named = await git('symbolic-ref', ['--quiet', '--short', 'HEAD'], { tolerate: true });
  return { commit, ref: named.status === 0 ? named.stdout.trim() : commit };
}

async function refuseDirtyIndex(git) {
  const staged = (await git('diff', ['--cached', '--name-only'])).stdout.trim();
  if (staged) refuse(`the index already holds staged changes (${staged.split('\n').slice(0, 3).join(', ')})`);
}

async function refuseUnsuitableRepository(git, branch) {
  if ((await git('check-ref-format', [`refs/heads/${branch}`], { tolerate: true })).status !== 0)
    refuse(`"${branch}" is not a valid branch name`);
  if ((await git('show-ref', ['--verify', '--quiet', `refs/heads/${branch}`], { tolerate: true })).status === 0)
    refuse(`the branch ${branch} already exists`);
  await refuseDirtyIndex(git);
}

async function committedText(git, path) {
  const held = (await git('ls-tree', ['--name-only', 'HEAD', '--', path])).stdout.trim();
  return held === '' ? null : (await git('show', [`HEAD:${path}`])).stdout;
}

async function refuseMovedDigests(git, files) {
  for (const { path, text } of files.filter((file) => isDispositionFile(file.path))) {
    const moved = refusalOf({ path, before: await committedText(git, path), after: text });
    if (moved !== null) refuse(refusedMessage(moved));
  }
}

async function verifyCommit(git, listed) {
  const diff = await git('diff-tree', ['--no-commit-id', '--name-only', '-r', '-z', '--no-renames', 'HEAD']);
  const committed = diff.stdout.split('\0').filter(Boolean).sort();
  const absent = listed.find((path) => !committed.includes(path));
  if (absent) refuse(`${absent} is listed but the commit holds no change to it`);
  const extra = committed.find((path) => !listed.includes(path));
  if (extra) refuse(`${extra} is in the commit but was not listed`);

  const named = (await git('log', ['-1', '--format=%an|%ae|%cn|%ce'])).stdout.trim();
  if (named !== BOT_ON_BOTH_SIDES)
    refuse(
      `the commit names author and committer as "${named}", not ${IDENTITY} for both; unset GIT_AUTHOR_* and GIT_COMMITTER_*`
    );
}

async function rollback({ error, undo, transaction }) {
  const problems = [];
  for (const [what, step] of [...undo, ['restoring the files', () => transaction.restore()]]) {
    try {
      await step();
    } catch (failure) {
      problems.push(`${what}: ${failure.message}`);
    }
  }
  return problems.length === 0
    ? error
    : new WriterError('commit', `${error.message}\nrollback incomplete: ${problems.join('; ')}`);
}

async function recordCommit({ git, listed, message }) {
  await git('add', ['--', ...listed]);
  await git('commit', ['--quiet', `--author=${IDENTITY}`, '-m', message, '--', ...listed], { prefix: COMMIT_FLAGS });
  await verifyCommit(git, listed);
  return (await git('rev-parse', ['HEAD'])).stdout.trim();
}

export async function commitRoute({ repoRoot, branch, files, message, run }) {
  checkedBranch(branch);
  const listed = checkedFiles({ files, message });
  const git = gitIn(run, repoRoot);
  const start = await startingPoint(git);
  await refuseUnsuitableRepository(git, branch);
  await refuseMovedDigests(git, files);

  const transaction = fileTransaction(repoRoot);
  let created = false;
  try {
    for (const { path, text } of files) transaction.write(path, text);
    await git('checkout', ['-b', branch]);
    created = true;
    return { commit: await recordCommit({ git, listed, message }), branch };
  } catch (error) {
    const undo = [
      ['unstaging', () => git('reset', ['--quiet', '--', ...listed])],
      ['returning to the starting point', () => git('checkout', ['--quiet', start.ref, '--'])],
      ...(created ? [['deleting the branch', () => git('branch', ['-D', branch])]] : []),
    ];
    throw await rollback({ error, undo, transaction });
  }
}

export async function commitRepair({ repoRoot, files, message, run }) {
  const listed = checkedFiles({ files, message });
  const git = gitIn(run, repoRoot);
  const start = await startingPoint(git);
  await refuseDirtyIndex(git);
  await refuseMovedDigests(git, files);

  const transaction = fileTransaction(repoRoot);
  try {
    for (const { path, text } of files) transaction.write(path, text);
    return { commit: await recordCommit({ git, listed, message }) };
  } catch (error) {
    const undo = [['returning to the starting commit', () => git('reset', ['--quiet', start.commit, '--'])]];
    throw await rollback({ error, undo, transaction });
  }
}
