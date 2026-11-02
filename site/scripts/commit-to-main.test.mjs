import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { CommitError, commitAndPush, runCli, runGit } from './commit-to-main.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';

for (const variable of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[variable];
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

const IDENTITY = { name: 'Test Writer', email: 'writer@example.test' };
const SEED_IDENTITY = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', '-c', 'commit.gpgsign=false'];
const FORCE_FLAGS = /^(--force|--force-with-lease.*|-f|\+.*)$/;
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
  const base = mkdtempSync(join(tmpdir(), 'commit-to-main-'));
  directories.push(base);
  const remote = join(base, 'remote.git');
  const seed = join(base, 'seed');
  git(base, 'init', '--bare', '--initial-branch=main', remote);
  mkdirSync(seed);
  git(seed, 'init', '--initial-branch=main');
  put(seed, 'README.md', 'seed\n');
  git(seed, 'add', '--all');
  seedCommit(seed, 'seed');
  git(seed, 'push', remote, 'main');
  const repo = join(base, 'work');
  const other = join(base, 'other');
  git(base, 'clone', remote, repo);
  git(base, 'clone', remote, other);
  return { remote, repo, other, remoteHead: () => git(remote, 'rev-parse', 'refs/heads/main') };
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
  return { repoRoot, paths: ['content/a.txt'], message: 'Add a', identity: IDENTITY, ...overrides };
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
const moved = { status: 1, stdout: '', stderr: '! [rejected] main -> main (fetch first)' };
const head = { status: 0, stdout: 'a'.repeat(40) + '\n', stderr: '' };

test('a new file is committed as the identity and pushed to main', async () => {
  const world = makeWorld();
  put(world.repo, 'content/a.txt', 'alpha\n');
  const result = await commitAndPush(request(world.repo));
  assert.equal(result.committed, true);
  assert.match(result.commit, /^[0-9a-f]{40}$/);
  assert.equal(world.remoteHead(), result.commit);
  const stamp = git(world.remote, 'log', '-1', '--format=%an|%ae|%cn|%ce|%s', 'refs/heads/main');
  assert.equal(stamp, 'Test Writer|writer@example.test|Test Writer|writer@example.test|Add a');
});

test('only the listed paths are committed and an unlisted modified file is left alone', async () => {
  const world = makeWorld();
  put(world.repo, 'content/a.txt', 'alpha\n');
  put(world.repo, 'README.md', 'changed locally\n');
  const result = await commitAndPush(request(world.repo));
  assert.equal(git(world.remote, 'show', '--name-only', '--format=', result.commit), 'content/a.txt');
  assert.equal(git(world.repo, 'status', '--porcelain'), 'M README.md');
});

test('an unchanged file returns committed false, creates no commit and never pushes', async () => {
  const world = makeWorld();
  put(world.repo, 'content/a.txt', 'alpha\n');
  await commitAndPush(request(world.repo));
  const before = { local: git(world.repo, 'rev-parse', 'HEAD'), remote: world.remoteHead() };
  const spy = recording();
  const result = await commitAndPush(request(world.repo, { run: spy.run }));
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
  git(world.other, 'push', 'origin', 'main');
  const movedHead = world.remoteHead();
  put(world.repo, 'content/a.txt', 'alpha\n');
  const spy = recording();
  const result = await commitAndPush(request(world.repo, { run: spy.run }));
  assert.equal(result.committed, true);
  assert.equal(world.remoteHead(), result.commit);
  git(world.remote, 'merge-base', '--is-ancestor', movedHead, result.commit);
  assert.equal(git(world.remote, 'rev-list', '--count', '--merges', 'refs/heads/main'), '0');
  assert.equal(git(world.remote, 'rev-list', '--count', 'refs/heads/main'), '3');
  const files = git(world.remote, 'ls-tree', '-r', '--name-only', 'refs/heads/main').split('\n');
  assert.deepEqual(files, ['README.md', 'content/a.txt', 'content/b.txt']);
  assert.equal(forced(spy.calls), false);
});

test('a rebase conflict is aborted, named in the error, and leaves the remote untouched', async () => {
  const world = makeWorld();
  put(world.other, 'README.md', 'remote wording\n');
  seedCommit(world.other, 'Reword README remotely');
  git(world.other, 'push', 'origin', 'main');
  const movedHead = world.remoteHead();
  put(world.repo, 'README.md', 'local wording\n');
  await assert.rejects(
    commitAndPush(request(world.repo, { paths: ['README.md'], message: 'Reword README' })),
    (error) => error instanceof CommitError && /conflict/i.test(error.message) && error.message.includes('README.md')
  );
  assert.equal(world.remoteHead(), movedHead);
  assert.equal(existsSync(join(world.repo, '.git', 'rebase-merge')), false);
  assert.equal(existsSync(join(world.repo, '.git', 'rebase-apply')), false);
});

test('a push rejected three times throws, says nothing was forced, and never passes a force flag', async () => {
  const fake = fakeGit({ diff: staged, push: moved, 'rev-parse': head });
  await assert.rejects(
    commitAndPush(request('/repo', { run: fake.run })),
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
    commitAndPush(request('/repo', { run: fake.run })),
    (error) => error instanceof CommitError && /Permission denied/.test(error.message)
  );
  assert.equal(count(fake.calls, 'push'), 1);
  assert.equal(count(fake.calls, 'pull'), 0);
});

test('git is given the identity through -c flags, the exact paths, and the ref', async () => {
  const fake = fakeGit({ diff: staged, 'rev-parse': head });
  const paths = ['content/a.txt', 'audits/ledger.json'];
  const result = await commitAndPush(request('/repo', { paths, ref: 'release', remote: 'upstream', run: fake.run }));
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
      commitAndPush(request('/repo', { paths, run: fake.run })),
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
        commitAndPush(request('/repo', { run: fake.run })),
        (error) =>
          error instanceof CommitError && !error.message.includes(secret) && error.message.includes('://***@github.com')
      );
    }
  });
}

const ARGUMENTS = ['--message', 'Refresh report', '--path', 'audits/report.md', '--path', 'audits/ledger.json'];
const refuse = async () => assert.fail('commit must not run');

async function cli(argv, options = {}) {
  const lines = { out: [], err: [] };
  const sinks = { out: (text) => lines.out.push(text), err: (text) => lines.err.push(text) };
  const code = await runCli(argv, { repoRoot: '/repo', commit: refuse, ...sinks, ...options });
  return { code, out: lines.out, err: lines.err.join('\n') };
}

test('the CLI exits 2 and names the flag when --message or --path is missing, unknown or valueless', async () => {
  for (const [argv, flag] of [
    [['--path', 'a.txt'], '--message'],
    [['--message', 'x'], '--path'],
    [[...ARGUMENTS, '--force'], '--force'],
    [['--message'], '--message'],
  ]) {
    const result = await cli(argv);
    assert.equal(result.code, 2);
    assert.match(result.err, new RegExp(flag));
  }
});

test('the CLI prints the sha on success and passes the bot identity, paths and ref', async () => {
  const seen = [];
  const commit = async (options) => {
    seen.push(options);
    return { committed: true, commit: 'b'.repeat(40) };
  };
  const result = await cli([...ARGUMENTS, '--ref', 'trunk'], { commit });
  assert.equal(result.code, 0);
  assert.deepEqual(result.out, ['committed ' + 'b'.repeat(40)]);
  assert.deepEqual(seen, [
    {
      repoRoot: '/repo',
      paths: ['audits/report.md', 'audits/ledger.json'],
      message: 'Refresh report',
      identity: { name: BOT_NAME, email: BOT_EMAIL },
      ref: 'trunk',
    },
  ]);
});

test('the CLI prints nothing to commit and exits 0 when there is no change', async () => {
  const result = await cli(ARGUMENTS, { commit: async () => ({ committed: false, commit: null }) });
  assert.equal(result.code, 0);
  assert.deepEqual(result.out, ['nothing to commit']);
});

test('the CLI exits 1 and prints the message when the commit fails', async () => {
  const commit = async () => {
    throw new CommitError('push to origin main was rejected 3 times; nothing was forced');
  };
  const result = await cli(ARGUMENTS, { commit });
  assert.equal(result.code, 1);
  assert.match(result.err, /rejected 3 times/);
});

test('the CLI commits for real into a repository and pushes with the bot identity', async () => {
  const world = makeWorld();
  put(world.repo, 'audits/report.md', 'report\n');
  const result = await cli(['--message', 'Refresh report', '--path', 'audits/report.md'], {
    repoRoot: world.repo,
    commit: undefined,
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.out, ['committed ' + world.remoteHead()]);
  assert.equal(git(world.remote, 'log', '-1', '--format=%ae|%ce', 'refs/heads/main'), BOT_EMAIL + '|' + BOT_EMAIL);
});
