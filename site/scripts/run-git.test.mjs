import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { runGit } from './run-git.mjs';

const directories = [];

after(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

function repository() {
  const directory = mkdtempSync(join(tmpdir(), 'run-git-'));
  directories.push(directory);
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: directory });
  return directory;
}

test('a command that succeeds reports status 0 and what git printed', () => {
  const result = runGit(['rev-parse', '--is-inside-work-tree'], { cwd: repository() });
  assert.deepEqual(result, { status: 0, stdout: 'true\n', stderr: '' });
});

test('a command that fails reports its own status and what git said', () => {
  const result = runGit(['rev-parse', '--verify', 'refs/heads/nothing'], { cwd: repository() });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /fatal|needed a single revision/);
});

test('a directory that does not exist is a failure with the reason, never an exception', () => {
  const result = runGit(['status'], { cwd: join(tmpdir(), 'run-git-no-such-directory') });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /ENOENT/);
});

test('git is never allowed to ask for a password on a terminal', () => {
  const result = runGit(['-c', 'alias.show-env=!env', 'show-env'], { cwd: repository() });
  assert.match(result.stdout, /^GIT_TERMINAL_PROMPT=0$/m);
});
