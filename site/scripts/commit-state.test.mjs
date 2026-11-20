import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { CommitError, commitState } from './commit-state.mjs';
import { IDENTITY, STATE_BRANCH, count, forced, git, makeWorld, put, recording } from './fixtures/state-world.mjs';

const A = 'state/claims/2026/11/a.json';

const request = (world, overrides = {}) => ({
  repoRoot: world.repo,
  paths: [A],
  message: 'record a',
  identity: IDENTITY,
  ...overrides,
});

const writeA = (world, text = '{"a":1}\n') => put(world.repo, A, text);

test('a new state file is committed as the identity and pushed to the state branch, and main is not touched', async () => {
  const world = makeWorld();
  const main = world.remoteHead('main');
  writeA(world);
  const result = await commitState(request(world));
  assert.equal(result.committed, true);
  assert.match(result.commit, /^[0-9a-f]{40}$/);
  assert.equal(world.remoteHead(), result.commit);
  const stamp = git(world.remote, 'log', '-1', '--format=%an|%ae|%cn|%ce|%s', `refs/heads/${STATE_BRANCH}`);
  assert.equal(stamp, 'Test Writer|writer@example.test|Test Writer|writer@example.test|record a');
  assert.equal(world.remoteHead('main'), main);
});

test('the branch keeps the state files at its root, and the code checkout around state is left as it was', async () => {
  const world = makeWorld();
  const code = git(world.repo, 'rev-parse', 'HEAD');
  writeA(world);
  await commitState(request(world));
  assert.deepEqual(world.remoteFiles(), ['claims/2026/11/a.json', 'ledger/2026/11/first.json']);
  assert.equal(git(world.repo, 'rev-parse', 'HEAD'), code);
  assert.equal(git(world.repo, 'status', '--porcelain'), '');
});

test('only the listed paths are committed and an unlisted modified state file is left alone', async () => {
  const world = makeWorld();
  writeA(world);
  put(world.repo, 'state/ledger/2026/11/first.json', 'changed locally\n');
  const result = await commitState(request(world));
  assert.equal(git(world.remote, 'show', '--name-only', '--format=', result.commit), 'claims/2026/11/a.json');
  assert.equal(git(world.state, 'status', '--porcelain'), 'M ledger/2026/11/first.json');
});

test('several paths are committed together as one commit', async () => {
  const world = makeWorld();
  writeA(world);
  put(world.repo, 'state/spend-report.md', '# Spend\n');
  const paths = [A, 'state/spend-report.md'];
  const result = await commitState(request(world, { paths }));
  const names = git(world.remote, 'show', '--name-only', '--format=', result.commit).split('\n');
  assert.deepEqual(names, ['claims/2026/11/a.json', 'spend-report.md']);
});

test('an unchanged file returns committed false, makes no commit and never pushes', async () => {
  const world = makeWorld();
  writeA(world);
  await commitState(request(world));
  const before = { local: git(world.state, 'rev-parse', 'HEAD'), remote: world.remoteHead() };
  const spy = recording();
  const result = await commitState(request(world, { run: spy.run }));
  assert.deepEqual(result, { committed: false, commit: null });
  assert.equal(git(world.state, 'rev-parse', 'HEAD'), before.local);
  assert.equal(world.remoteHead(), before.remote);
  assert.equal(count(spy.calls, 'push') + count(spy.calls, 'commit'), 0);
});

test('a remote that moved is rebased onto, pushed without force, and history stays linear', async () => {
  const world = makeWorld();
  put(world.other, 'escalations/demand-refresh.json', '{}\n');
  git(world.other, 'add', '--all');
  git(world.other, '-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', 'commit', '--message', 'other run');
  git(world.other, 'push', '--quiet', 'origin', STATE_BRANCH);
  const moved = world.remoteHead();
  writeA(world);
  const spy = recording();
  const result = await commitState(request(world, { run: spy.run }));
  assert.equal(world.remoteHead(), result.commit);
  git(world.remote, 'merge-base', '--is-ancestor', moved, result.commit);
  assert.equal(git(world.remote, 'rev-list', '--count', '--merges', `refs/heads/${STATE_BRANCH}`), '0');
  assert.deepEqual(world.remoteFiles(), [
    'claims/2026/11/a.json',
    'escalations/demand-refresh.json',
    'ledger/2026/11/first.json',
  ]);
  assert.equal(forced(spy.calls), false);
});

test('a rebase conflict is aborted, named in the error, and leaves the remote untouched', async () => {
  const world = makeWorld();
  put(world.other, 'ledger/2026/11/first.json', 'remote wording\n');
  git(world.other, '-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', 'commit', '--all', '--message', 'x');
  git(world.other, 'push', '--quiet', 'origin', STATE_BRANCH);
  const moved = world.remoteHead();
  const path = 'state/ledger/2026/11/first.json';
  put(world.repo, path, 'local wording\n');
  await assert.rejects(
    commitState(request(world, { paths: [path] })),
    (error) => error instanceof CommitError && /conflict/i.test(error.message) && error.message.includes('first.json')
  );
  assert.equal(world.remoteHead(), moved);
  assert.equal(existsSync(join(world.state, '.git', 'rebase-merge')), false);
  assert.equal(existsSync(join(world.state, '.git', 'rebase-apply')), false);
});

test('every push goes to the state branch alone and none is forced', async () => {
  const world = makeWorld();
  writeA(world);
  const spy = recording();
  await commitState(request(world, { run: spy.run }));
  const pushes = spy.calls.filter((args) => args.includes('push'));
  assert.deepEqual(pushes, [['push', 'origin', `HEAD:refs/heads/${STATE_BRANCH}`]]);
  assert.equal(forced(spy.calls), false);
});

for (const [label, state] of [
  ['a checkout that git initialised and could not fetch into', 'fresh'],
  ['a checkout of the code branch', 'code'],
]) {
  test(`the state branch is created as an orphan when the remote has none: ${label}`, async () => {
    const world = makeWorld({ branch: false, state });
    const main = world.remoteHead('main');
    writeA(world);
    const result = await commitState(request(world));
    assert.equal(world.remoteHead(), result.commit);
    assert.equal(git(world.remote, 'rev-list', '--max-parents=0', `refs/heads/${STATE_BRANCH}`), result.commit);
    assert.equal(git(world.remote, 'rev-list', '--count', `refs/heads/${STATE_BRANCH}`), '1');
    assert.deepEqual(world.remoteFiles(), ['claims/2026/11/a.json']);
    assert.equal(world.remoteHead('main'), main);
    assert.throws(() => git(world.remote, 'merge-base', 'refs/heads/main', `refs/heads/${STATE_BRANCH}`));
  });
}

test('the second commit on a branch that was just created is an ordinary child commit', async () => {
  const world = makeWorld({ branch: false, state: 'fresh' });
  writeA(world);
  const first = await commitState(request(world));
  put(world.repo, 'state/spend-report.md', '# Spend\n');
  const second = await commitState(request(world, { paths: ['state/spend-report.md'], message: 'report' }));
  assert.equal(git(world.remote, 'rev-parse', `${second.commit}^`), first.commit);
  assert.deepEqual(world.remoteFiles(), ['claims/2026/11/a.json', 'spend-report.md']);
});

test('a code checkout in state is refused when the state branch exists, because its history is unrelated', async () => {
  const world = makeWorld({ state: 'code' });
  const before = world.remoteHead();
  writeA(world);
  await assert.rejects(
    commitState(request(world)),
    (error) => error instanceof CommitError && /not a checkout of autowriter-state/.test(error.message)
  );
  assert.equal(world.remoteHead(), before);
});

test('a checkout with no commit yet is rebased onto the branch another run created first', async () => {
  const world = makeWorld({ state: 'fresh' });
  writeA(world);
  const result = await commitState(request(world));
  assert.equal(world.remoteHead(), result.commit);
  assert.deepEqual(world.remoteFiles(), ['claims/2026/11/a.json', 'ledger/2026/11/first.json']);
});

test('a state directory that is no git checkout is refused, and git never runs in the code repository around it', async () => {
  const world = makeWorld({ state: 'none' });
  const before = {
    code: git(world.repo, 'rev-parse', 'HEAD'),
    main: world.remoteHead('main'),
    state: world.remoteHead(),
  };
  writeA(world);
  const spy = recording();
  await assert.rejects(
    commitState(request(world, { run: spy.run })),
    (error) => error instanceof CommitError && /not a git checkout/.test(error.message)
  );
  assert.equal(spy.calls.length, 0);
  assert.equal(git(world.repo, 'rev-parse', 'HEAD'), before.code);
  assert.equal(world.remoteHead('main'), before.main);
  assert.equal(world.remoteHead(), before.state);
});

test('a missing state directory is refused the same way', async () => {
  const world = makeWorld({ state: 'none' });
  await assert.rejects(
    commitState(request(world, { repoRoot: join(world.repo, 'missing') })),
    (error) => error instanceof CommitError && /not a git checkout/.test(error.message)
  );
});
