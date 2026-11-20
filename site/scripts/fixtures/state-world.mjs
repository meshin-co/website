import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { STATE_BRANCH } from '../record-layout.mjs';
import { runGit } from '../run-git.mjs';

for (const variable of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[variable];
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

export const IDENTITY = { name: 'Test Writer', email: 'writer@example.test' };
export { STATE_BRANCH };

const SEED_IDENTITY = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', '-c', 'commit.gpgsign=false'];
const FORCE_FLAGS = /^(--force|--force-with-lease.*|-f|\+.*)$/;
const COMMANDS = [
  'fetch',
  'rev-parse',
  'merge-base',
  'symbolic-ref',
  'read-tree',
  'add',
  'diff',
  'commit',
  'push',
  'pull',
  'rebase',
];
const directories = [];

process.on('exit', () => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

export function seedCommit(cwd, message) {
  git(cwd, ...SEED_IDENTITY, 'commit', '--all', '--message', message);
}

function seedCode(base, remote) {
  const seed = join(base, 'seed');
  mkdirSync(seed);
  git(seed, 'init', '--quiet', '--initial-branch=main');
  put(seed, 'README.md', 'code\n');
  put(seed, '.gitignore', '/state/\n');
  git(seed, 'add', '--all');
  seedCommit(seed, 'code');
  git(seed, 'push', '--quiet', remote, 'main');
  return seed;
}

function seedState(seed, remote) {
  git(seed, 'checkout', '--quiet', '--orphan', STATE_BRANCH);
  git(seed, 'rm', '-rf', '--quiet', '.');
  put(seed, 'ledger/2026/11/first.json', '{}\n');
  git(seed, 'add', '--all');
  seedCommit(seed, 'seed the state');
  git(seed, 'push', '--quiet', remote, STATE_BRANCH);
}

const CHECKOUTS = {
  checkout: (remote, state) => git(dirname(state), 'clone', '--quiet', '--branch', STATE_BRANCH, remote, state),
  code: (remote, state) => git(dirname(state), 'clone', '--quiet', '--branch', 'main', remote, state),
  fresh: (remote, state) => {
    mkdirSync(state, { recursive: true });
    git(state, 'init', '--quiet');
    git(state, 'remote', 'add', 'origin', remote);
  },
  none: (remote, state) => mkdirSync(state, { recursive: true }),
};

export function makeWorld({ branch = true, state = 'checkout' } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'commit-state-'));
  directories.push(base);
  const remote = join(base, 'remote.git');
  git(base, 'init', '--quiet', '--bare', '--initial-branch=main', remote);
  const seed = seedCode(base, remote);
  if (branch) seedState(seed, remote);
  const repo = join(base, 'work');
  git(base, 'clone', '--quiet', '--branch', 'main', remote, repo);
  CHECKOUTS[state](remote, join(repo, 'state'));
  const other = join(base, 'other');
  if (branch) git(base, 'clone', '--quiet', '--branch', STATE_BRANCH, remote, other);
  return {
    remote,
    repo,
    state: join(repo, 'state'),
    other,
    remoteHead: (ref = STATE_BRANCH) => git(remote, 'rev-parse', `refs/heads/${ref}`),
    remoteFiles: (ref = STATE_BRANCH) => git(remote, 'ls-tree', '-r', '--name-only', ref).split('\n'),
  };
}

export function recording(inner = runGit) {
  const calls = [];
  const run = (args, options) => {
    calls.push(args);
    return inner(args, options);
  };
  return { run, calls };
}

export function fakeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'commit-state-fake-'));
  directories.push(root);
  mkdirSync(join(root, 'state', '.git'), { recursive: true });
  return root;
}

export function fakeGit(handlers = {}) {
  const calls = [];
  const places = [];
  const ok = { status: 0, stdout: '', stderr: '' };
  const run = (args, { cwd }) => {
    calls.push(args);
    places.push(cwd);
    const handler = handlers[COMMANDS.find((word) => args.includes(word))];
    return typeof handler === 'function' ? handler(args) : (handler ?? ok);
  };
  return { run, calls, places };
}

export const forced = (calls) => calls.flat().some((argument) => FORCE_FLAGS.test(argument));
export const count = (calls, word) => calls.filter((args) => args.includes(word)).length;
