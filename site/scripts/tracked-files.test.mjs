import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { TreeUnreadableError, trackedFiles } from './tracked-files.mjs';

const directory = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'tracked-files-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const git = (cwd, ...args) => spawnSync('git', args, { cwd, stdio: 'ignore' });

const refusalOf = (root) => {
  try {
    trackedFiles(root);
  } catch (error) {
    return error;
  }
  return null;
};

test('a directory that is not a git repository is refused with the sentence that names git init', (t) => {
  const root = directory(t);
  writeFileSync(join(root, 'a.txt'), 'a\n');
  const error = refusalOf(root);
  assert.ok(error instanceof TreeUnreadableError, String(error));
  assert.equal(error.rule, 'not-a-repository');
  assert.match(error.message, /not a git repository.*git init && git add -A/);
});

test('a repository with nothing staged is refused with the sentence that names git add', (t) => {
  const root = directory(t);
  writeFileSync(join(root, 'a.txt'), 'a\n');
  git(root, 'init', '-q');
  const error = refusalOf(root);
  assert.ok(error instanceof TreeUnreadableError, String(error));
  assert.equal(error.rule, 'nothing-tracked');
  assert.match(error.message, /git add -A/);
  assert.doesNotMatch(error.message, /git init/);
});

test('a directory that does not exist is refused as missing, never as a missing git', (t) => {
  const error = refusalOf(join(directory(t), 'absent'));
  assert.ok(error instanceof TreeUnreadableError, String(error));
  assert.equal(error.rule, 'root-missing');
});

test('a tracked file is listed, a tracked file deleted from the working tree is not', (t) => {
  const root = directory(t);
  mkdirSync(join(root, 'dir'));
  writeFileSync(join(root, 'dir', 'kept.txt'), 'k\n');
  writeFileSync(join(root, 'gone.txt'), 'g\n');
  writeFileSync(join(root, 'untracked.txt'), 'u\n');
  git(root, 'init', '-q');
  git(root, 'add', 'dir/kept.txt', 'gone.txt');
  rmSync(join(root, 'gone.txt'));
  assert.deepEqual(trackedFiles(root), ['dir/kept.txt']);
});

test('a machine with no git on the path is refused with a sentence that says so', (t) => {
  const root = directory(t);
  const module = JSON.stringify(new URL('./tracked-files.mjs', import.meta.url).href);
  const script = `import { trackedFiles } from ${module};
try { trackedFiles(${JSON.stringify(root)}); } catch (error) { console.log(error.rule); }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { PATH: '' },
  });
  assert.equal(result.stdout.trim(), 'git-missing', result.stderr);
});
