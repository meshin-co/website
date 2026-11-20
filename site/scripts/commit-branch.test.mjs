import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { CommitError, commitToBranch } from './commit-branch.mjs';
import { runGit } from './run-git.mjs';

for (const variable of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[variable];
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

const IDENTITY = { name: 'Test Writer', email: 'writer@example.test' };
const SEED_IDENTITY = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', '-c', 'commit.gpgsign=false'];
const FORCE_FLAGS = /^(--force|--force-with-lease.*|-f|\+.*)$/;
const BRANCH = 'link-repair/2026-11-17';
const directories = [];

after(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function seedCommit(cwd, message) {
  git(cwd, ...SEED_IDENTITY, 'commit', '--all', '--message', message);
}

function makeWorld() {
  const base = mkdtempSync(join(tmpdir(), 'commit-branch-'));
  directories.push(base);
  const remote = join(base, 'remote.git');
  const seed = join(base, 'seed');
  git(base, 'init', '--bare', `--initial-branch=${BRANCH}`, remote);
  mkdirSync(seed);
  git(seed, 'init', `--initial-branch=${BRANCH}`);
  put(seed, 'README.md', 'seed\n');
  git(seed, 'add', '--all');
  seedCommit(seed, 'seed');
  git(seed, 'push', remote, BRANCH);
  const repo = join(base, 'work');
  const other = join(base, 'other');
  git(base, 'clone', remote, repo);
  git(base, 'clone', remote, other);
  return { remote, repo, other, remoteHead: () => git(remote, 'rev-parse', `refs/heads/${BRANCH}`) };
}

function recording(inner = runGit) {
  const calls = [];
  const run = (args, options) => {
    calls.push(args);
    return inner(args, options);
  };
  return { run, calls };
}

function request(repoRoot, overrides = {}) {
  return { repoRoot, paths: ['content/a.txt'], message: 'Add a', identity: IDENTITY, ref: BRANCH, ...overrides };
}

const forced = (calls) => calls.flat().some((argument) => FORCE_FLAGS.test(argument));
const count = (calls, word) => calls.filter((args) => args.includes(word)).length;

function fakeGit(handlers) {
  const calls = [];
  const ok = { status: 0, stdout: '', stderr: '' };
  const run = (args) => {
    calls.push(args);
    const name = ['add', 'diff', 'commit', 'push', 'pull', 'rev-parse', 'rebase'].find((word) => args.includes(word));
    const handler = handlers[name];
    return typeof handler === 'function' ? handler(args) : (handler ?? ok);
  };
  return { run, calls };
}

const staged = { status: 0, stdout: 'content/a.txt\n', stderr: '' };
const moved = { status: 1, stdout: '', stderr: '! [rejected] HEAD -> link-repair/2026-11-17 (fetch first)' };
const head = { status: 0, stdout: 'a'.repeat(40) + '\n', stderr: '' };

test('a new file is committed as the identity and pushed to the branch', async () => {
  const world = makeWorld();
  put(world.repo, 'content/a.txt', 'alpha\n');
  const result = await commitToBranch(request(world.repo));
  assert.equal(result.committed, true);
  assert.match(result.commit, /^[0-9a-f]{40}$/);
  assert.equal(world.remoteHead(), result.commit);
  const stamp = git(world.remote, 'log', '-1', '--format=%an|%ae|%cn|%ce|%s', `refs/heads/${BRANCH}`);
  assert.equal(stamp, 'Test Writer|writer@example.test|Test Writer|writer@example.test|Add a');
});

test('only the listed paths are committed and an unlisted modified file is left alone', async () => {
  const world = makeWorld();
  put(world.repo, 'content/a.txt', 'alpha\n');
  put(world.repo, 'README.md', 'changed locally\n');
  const result = await commitToBranch(request(world.repo));
  assert.equal(git(world.remote, 'show', '--name-only', '--format=', result.commit), 'content/a.txt');
  assert.equal(git(world.repo, 'status', '--porcelain'), 'M README.md');
});

test('an unchanged file returns committed false, creates no commit and never pushes', async () => {
  const world = makeWorld();
  put(world.repo, 'content/a.txt', 'alpha\n');
  await commitToBranch(request(world.repo));
  const before = { local: git(world.repo, 'rev-parse', 'HEAD'), remote: world.remoteHead() };
  const spy = recording();
  const result = await commitToBranch(request(world.repo, { run: spy.run }));
  assert.deepEqual(result, { committed: false, commit: null });
  assert.equal(git(world.repo, 'rev-parse', 'HEAD'), before.local);
  assert.equal(world.remoteHead(), before.remote);
  assert.equal(count(spy.calls, 'push') + count(spy.calls, 'commit'), 0);
});

test('a remote that moved is rebased onto, pushed without force, and history stays linear', async () => {
  const world = makeWorld();
  put(world.other, 'content/b.txt', 'bravo\n');
  git(world.other, 'add', '--all');
  seedCommit(world.other, 'Add b');
  git(world.other, 'push', 'origin', BRANCH);
  const movedHead = world.remoteHead();
  put(world.repo, 'content/a.txt', 'alpha\n');
  const spy = recording();
  const result = await commitToBranch(request(world.repo, { run: spy.run }));
  assert.equal(result.committed, true);
  assert.equal(world.remoteHead(), result.commit);
  git(world.remote, 'merge-base', '--is-ancestor', movedHead, result.commit);
  assert.equal(git(world.remote, 'rev-list', '--count', '--merges', `refs/heads/${BRANCH}`), '0');
  assert.equal(git(world.remote, 'rev-list', '--count', `refs/heads/${BRANCH}`), '3');
  const files = git(world.remote, 'ls-tree', '-r', '--name-only', `refs/heads/${BRANCH}`).split('\n');
  assert.deepEqual(files, ['README.md', 'content/a.txt', 'content/b.txt']);
  assert.equal(forced(spy.calls), false);
});

test('a rebase conflict is aborted, named in the error, and leaves the remote untouched', async () => {
  const world = makeWorld();
  put(world.other, 'README.md', 'remote wording\n');
  seedCommit(world.other, 'Reword README remotely');
  git(world.other, 'push', 'origin', BRANCH);
  const movedHead = world.remoteHead();
  put(world.repo, 'README.md', 'local wording\n');
  await assert.rejects(
    commitToBranch(request(world.repo, { paths: ['README.md'], message: 'Reword README' })),
    (error) => error instanceof CommitError && /conflict/i.test(error.message) && error.message.includes('README.md')
  );
  assert.equal(world.remoteHead(), movedHead);
  assert.equal(existsSync(join(world.repo, '.git', 'rebase-merge')), false);
  assert.equal(existsSync(join(world.repo, '.git', 'rebase-apply')), false);
});

test('a push rejected three times throws, says nothing was forced, and never passes a force flag', async () => {
  const fake = fakeGit({ diff: staged, push: moved, 'rev-parse': head });
  await assert.rejects(
    commitToBranch(request('/repo', { run: fake.run })),
    (error) =>
      error instanceof CommitError && /rejected 3 times/.test(error.message) && /nothing was forced/.test(error.message)
  );
  assert.equal(count(fake.calls, 'push'), 3);
  assert.equal(count(fake.calls, 'pull'), 2);
  assert.equal(forced(fake.calls), false);
});

test('a push that fails for another reason throws at once without a rebase', async () => {
  const denied = { status: 1, stdout: '', stderr: 'remote: Permission denied to bot.\nfatal: unable to push' };
  const fake = fakeGit({ diff: staged, push: denied });
  await assert.rejects(
    commitToBranch(request('/repo', { run: fake.run })),
    (error) => error instanceof CommitError && /Permission denied/.test(error.message)
  );
  assert.equal(count(fake.calls, 'push'), 1);
  assert.equal(count(fake.calls, 'pull'), 0);
});

test('git is given the identity through -c flags, the exact paths, and the ref', async () => {
  const fake = fakeGit({ diff: staged, 'rev-parse': head });
  const paths = ['content/a.txt', 'audits/ledger.json'];
  const result = await commitToBranch(request('/repo', { paths, ref: 'release', remote: 'upstream', run: fake.run }));
  assert.deepEqual(result, { committed: true, commit: 'a'.repeat(40) });
  const commit = fake.calls.find((args) => args.includes('commit'));
  const flags = '-c user.name=Test Writer -c user.email=writer@example.test -c commit.gpgsign=false';
  assert.equal(commit.slice(0, 6).join(' '), flags);
  assert.deepEqual(fake.calls[0], ['add', '--', 'content/a.txt', 'audits/ledger.json']);
  assert.deepEqual(
    fake.calls.find((args) => args.includes('push')),
    ['push', 'upstream', 'HEAD:refs/heads/release']
  );
});

for (const [label, paths] of [
  ['an absolute path', ['/etc/passwd']],
  ['a parent segment', ['content/../../secret']],
  ['a bare parent segment', ['..']],
  ['an empty list', []],
  ['an empty string', ['']],
  ['a non-string entry', [42]],
]) {
  test('refuses ' + label + ' before git is called', async () => {
    const fake = fakeGit({});
    await assert.rejects(
      commitToBranch(request('/repo', { paths, run: fake.run })),
      (error) => error instanceof CommitError && /paths/.test(error.message)
    );
    assert.equal(fake.calls.length, 0);
  });
}

for (const [label, stderr, secret] of [
  ['a token', 'fatal: unable to access https://x-access-token@github.com/o/r.git/: 403', 'x-access-token'],
  ['a user and password', 'fatal: unable to access https://bot:hunter2@github.com/o/r.git/: 403', 'hunter2'],
]) {
  test('a credential in git stderr is redacted: ' + label, async () => {
    const failing = { status: 1, stdout: '', stderr };
    for (const handlers of [{ add: failing }, { diff: staged, push: failing }]) {
      const fake = fakeGit(handlers);
      await assert.rejects(
        commitToBranch(request('/repo', { run: fake.run })),
        (error) =>
          error instanceof CommitError && !error.message.includes(secret) && error.message.includes('://***@github.com')
      );
    }
  });
}

for (const ref of ['main', 'master', 'refs/heads/main', 'refs/heads/master', 'Main', 'MASTER']) {
  test(`refuses ${ref} by name before git is called, because the writer writes no file to main`, async () => {
    const fake = fakeGit({ diff: staged, 'rev-parse': head });
    await assert.rejects(
      commitToBranch(request('/repo', { ref, run: fake.run })),
      (error) =>
        error instanceof CommitError &&
        error.message.includes(JSON.stringify(ref)) &&
        /never commits to/.test(error.message)
    );
    assert.equal(fake.calls.length, 0);
  });
}

test('a branch whose name only contains main is not refused', async () => {
  const fake = fakeGit({ diff: staged, 'rev-parse': head });
  const result = await commitToBranch(request('/repo', { ref: 'link-repair/main-street', run: fake.run }));
  assert.equal(result.committed, true);
  assert.deepEqual(
    fake.calls.find((args) => args.includes('push')),
    ['push', 'origin', 'HEAD:refs/heads/link-repair/main-street']
  );
});

for (const ref of [undefined, null, '', 42, 'two words']) {
  test(`refuses a ref that is not a plain git name (${String(ref)}), so no default can name main`, async () => {
    const fake = fakeGit({});
    await assert.rejects(
      commitToBranch(request('/repo', { ref, run: fake.run })),
      (error) => error instanceof CommitError && /ref .* is not a plain git name/.test(error.message)
    );
    assert.equal(fake.calls.length, 0);
  });
}
