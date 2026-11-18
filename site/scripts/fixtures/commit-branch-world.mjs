import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { CommitError } from '../commit-branch.mjs';

for (const variable of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[variable];
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

export const BRANCH = 'link-repair/2026-11-17';
export const BAND = 'audits/sentence-band.json';
export const ROUTES = 'audits/phase-4.7/dispositions/routes.json';
export const CLAIMED_AT = '2026-11-01T07:00:00.000Z';
export const LEDGER = 'audits/autowriter/2026/11/model-registry.json';

const IDENTITY = { name: 'Test Writer', email: 'writer@example.test' };
const SEED = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', '-c', 'commit.gpgsign=false'];
const directories = [];

export const removeWorlds = () => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
};

export const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

export const ROWS = [
  { target: '/', status: 'verified', reason: 'The home page was re-read.', digest: 'aaaaaaaaaaaa' },
  {
    target: '/blog',
    location: 'head.title',
    status: 'verified',
    reason: 'The title was checked.',
    digest: 'aaaaaaaaaaaa',
  },
];
export const asFile = (rows) => JSON.stringify(rows, null, 2) + '\n';
const BASE = {
  'README.md': 'seed\n',
  [BAND]: '{"low":1}\n',
  'audits/lighthouse-green.json': '{"green":true}\n',
  'audits/phase-4.7/lh-measured.json': '{"tree":"a"}\n',
  [ROUTES]: asFile(ROWS),
  [LEDGER]: '{"attempts":1}\n',
};

export function makeWorld(files = {}) {
  const base = mkdtempSync(join(tmpdir(), 'commit-branch-world-'));
  directories.push(base);
  const remote = join(base, 'remote.git');
  const repo = join(base, 'work');
  git(base, 'init', '--bare', `--initial-branch=${BRANCH}`, remote);
  mkdirSync(repo);
  git(repo, 'init', `--initial-branch=${BRANCH}`);
  for (const [path, text] of Object.entries({ ...BASE, ...files })) put(repo, path, text);
  git(repo, 'add', '--all');
  git(repo, ...SEED, 'commit', '--message', 'seed');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', 'origin', BRANCH);
  return { repo, remote, remoteHead: () => git(remote, 'rev-parse', `refs/heads/${BRANCH}`) };
}

export const request = (repoRoot, overrides = {}) => ({
  repoRoot,
  paths: ['content/a.txt'],
  message: 'Add a',
  identity: IDENTITY,
  ref: BRANCH,
  ...overrides,
});

export const refusedWith =
  (...parts) =>
  (error) =>
    error instanceof CommitError && parts.every((part) => error.message.includes(part));

export function silent() {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    return { status: 0, stdout: '', stderr: '' };
  };
  return { run, calls };
}
