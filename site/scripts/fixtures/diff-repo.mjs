import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const GIT_ENVIRONMENT = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};
const IDENTITY = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test'];

export const gitAt = (root, ...args) =>
  execFileSync('git', args, { cwd: root, env: GIT_ENVIRONMENT, encoding: 'utf8' }).trim();

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

export function commitIn(root, { write = {}, remove = [], move = [], message = 'fixture' } = {}) {
  for (const [path, text] of Object.entries(write)) put(root, path, text);
  for (const path of remove) rmSync(join(root, path));
  for (const [from, to] of move) {
    mkdirSync(dirname(join(root, to)), { recursive: true });
    renameSync(join(root, from), join(root, to));
  }
  gitAt(root, 'add', '-A');
  gitAt(root, ...IDENTITY, 'commit', '--quiet', '--allow-empty', '-m', message);
  return gitAt(root, 'rev-parse', 'HEAD');
}

export const SITE_FILES = {
  'site/src/pages/index.astro': '---\n---\n<h1>home</h1>\n',
  'site/public/robots.txt': 'User-agent: *\n',
  'docs/PRD.md': '# PRD\n',
};

export function makeDiffRepo(files = SITE_FILES) {
  const root = mkdtempSync(join(tmpdir(), 'diff-repo-'));
  gitAt(root, 'init', '--quiet', '--initial-branch=main');
  commitIn(root, { write: files, message: 'start' });
  return root;
}

export const removeRepo = (root) => rmSync(root, { recursive: true, force: true });
