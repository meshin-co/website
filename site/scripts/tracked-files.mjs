import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const NOT_A_REPOSITORY = /not a git repository/;

export class TreeUnreadableError extends Error {
  constructor(rule, message) {
    super(message);
    this.name = 'TreeUnreadableError';
    this.rule = rule;
  }
}

function git(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: { ...process.env, LC_ALL: 'C' },
  });
  if (result.error?.code === 'ENOENT') {
    throw new TreeUnreadableError(
      'git-missing',
      'git is not on PATH, and the files git tracks are what this command reads; install git, then run it again'
    );
  }
  if (result.error) throw result.error;
  return result;
}

function refuseUnlessRepository(root) {
  const { status, stdout, stderr } = git(root, ['rev-parse', '--is-inside-work-tree']);
  if (status === 0 && stdout.trim() === 'true') return;
  if (status === 0 || NOT_A_REPOSITORY.test(stderr)) {
    throw new TreeUnreadableError(
      'not-a-repository',
      'git tracks the files this command reads, and this directory is not a git repository; run "git init && git add -A" here, then run it again'
    );
  }
  throw new TreeUnreadableError('git-failed', `git could not open this directory: ${stderr.trim()}`);
}

export function trackedFiles(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new TreeUnreadableError('root-missing', `${root} is not a directory`);
  }
  refuseUnlessRepository(root);
  const listing = git(root, ['ls-files', '-z']);
  if (listing.status !== 0) {
    throw new TreeUnreadableError('git-failed', `git ls-files failed: ${listing.stderr.trim()}`);
  }
  const files = listing.stdout.split('\0').filter((file) => file !== '' && existsSync(join(root, file)));
  if (files.length === 0) {
    throw new TreeUnreadableError(
      'nothing-tracked',
      'git tracks no file here, so there is nothing to read; run "git add -A" here, then run it again'
    );
  }
  return files;
}
