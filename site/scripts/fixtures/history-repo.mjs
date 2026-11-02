import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { repositoryGit } from '../autowriter-refusal-rules.mjs';
import { BOT_EMAIL, BOT_NAME } from '../pr-classify.mjs';

export const HUMAN = { name: 'Owner', email: 'owner@example.test' };
export const BOT = { name: BOT_NAME, email: BOT_EMAIL };

const FLAGS = ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null'];

const environment = ({ name, email }) => ({
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: name,
  GIT_AUTHOR_EMAIL: email,
  GIT_COMMITTER_NAME: name,
  GIT_COMMITTER_EMAIL: email,
});

export const gitIn = (root, args, who = HUMAN) => repositoryGit(root, environment(who))([...FLAGS, ...args]);

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

export function initRepo(root = mkdtempSync(join(tmpdir(), 'autowriter-history-'))) {
  gitIn(root, ['init', '--quiet', '--initial-branch=main']);
  return root;
}

export function commitAs(root, who, { write = {}, remove = [], message }) {
  for (const [path, text] of Object.entries(write)) put(root, path, text);
  for (const path of remove) rmSync(join(root, path));
  gitIn(root, ['add', '-A'], who);
  gitIn(root, ['commit', '--quiet', '--allow-empty', '-m', message], who);
  return gitIn(root, ['rev-parse', 'HEAD'], who).trim();
}

export function branchCommit(root, branch, who, change) {
  gitIn(root, ['checkout', '--quiet', '-b', branch], who);
  const sha = commitAs(root, who, change);
  gitIn(root, ['checkout', '--quiet', 'main'], who);
  return sha;
}

export const mergeAs = (root, branch, who, message) =>
  gitIn(root, ['merge', '--quiet', '--no-ff', '-m', message, branch], who);

export function shallowClone(root) {
  const clone = mkdtempSync(join(tmpdir(), 'autowriter-history-clone-'));
  gitIn(clone, ['clone', '--quiet', '--depth', '1', pathToFileURL(root).href, clone]);
  return clone;
}

export const removeRepos = (...roots) => roots.forEach((root) => rmSync(root, { recursive: true, force: true }));
