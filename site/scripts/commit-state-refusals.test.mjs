import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { REFUSED_PATHS, STATE_RECORD } from './autowriter-refusals.mjs';
import { CommitError, commitState } from './commit-state.mjs';
import { IDENTITY, STATE_BRANCH, count, fakeGit, fakeRoot, forced } from './fixtures/state-world.mjs';

const A = 'state/claims/2026/11/a.json';
const staged = { status: 0, stdout: 'claims/2026/11/a.json\n', stderr: '' };
const moved = { status: 1, stdout: '', stderr: '! [rejected] HEAD -> autowriter-state (fetch first)' };
const head = { status: 0, stdout: 'a'.repeat(40) + '\n', stderr: '' };
const absent = { status: 128, stdout: '', stderr: "fatal: couldn't find remote ref autowriter-state" };
const noHead = { status: 1, stdout: '', stderr: '' };

const request = (root, overrides = {}) => ({
  repoRoot: root,
  paths: [A],
  message: 'record a',
  identity: IDENTITY,
  ...overrides,
});

const refused =
  (fake, expected) =>
  async (overrides, pattern = expected) => {
    await assert.rejects(
      commitState(request(fakeRoot(), { run: fake.run, ...overrides })),
      (error) => error instanceof CommitError && pattern.test(error.message)
    );
    assert.equal(fake.calls.length, 0);
  };

const UNDER_STATE = /commits only paths under state\//;

for (const [label, paths] of [
  ['a path outside state', ['audits/spend-report.md']],
  ['a source file', ['src/content/blog/x/post.md']],
  ['a workflow', ['.github/workflows/ci.yml']],
  ['the state directory itself', ['state']],
  ['the state directory with a slash', ['state/']],
  ['a lookalike directory', ['statement/x.json']],
  ['a nested state directory', ['src/state/x.json']],
  ['an absolute path', ['/state/x.json']],
  ['a parent segment', ['state/../README.md']],
  ['a parent segment that returns to state', ['state/a/../../state/b.json']],
  ['a bare parent segment', ['..']],
  ['a current directory segment', ['state/./x.json']],
  ['an empty segment', ['state//x.json']],
  ['a backslash', ['state\\x.json']],
  ['one state path beside one outside path', [A, 'README.md']],
])
  test(`refuses ${label} before git is called`, async () => {
    await refused(fakeGit(), UNDER_STATE)({ paths });
  });

for (const [label, paths] of [
  ['an empty list', []],
  ['a missing list', undefined],
  ['an empty string', ['']],
  ['a non-string entry', [42]],
])
  test(`refuses ${label} before git is called`, async () => {
    await refused(fakeGit(), /paths|refused/)({ paths });
  });

for (const { id } of REFUSED_PATHS.filter(({ id: refused }) => refused !== STATE_RECORD)) {
  const path = {
    'sentence-band': 'audits/sentence-band.json',
    'entry-length': 'audits/entry-length.json',
    'lighthouse-record': 'audits/lighthouse-green.json',
    'lighthouse-stamp': 'audits/phase-7/lh-measured.json',
    'lighthouse-report': 'audits/phase-7/lh-mobile/report.json',
  }[id];
  test(`a path no run may commit is refused with its reason: ${id}`, async () => {
    await refused(fakeGit(), new RegExp(`refused .*${id}: `))({ paths: [path] });
  });
}

for (const ref of [
  'main',
  'master',
  'HEAD',
  'refs/heads/main',
  'autowriter-state-old',
  'autowriter/some-slug',
  'release',
  '',
])
  test(`refuses the ref "${ref}" before git is called, because only ${STATE_BRANCH} may be written`, async () => {
    await refused(fakeGit(), /commit-state writes only to autowriter-state/)({ ref });
  });

test('the refusal of main names main and the state branch', async () => {
  const fake = fakeGit();
  await assert.rejects(
    commitState(request(fakeRoot(), { run: fake.run, ref: 'main' })),
    (error) => error.message.includes('"main"') && error.message.includes(STATE_BRANCH)
  );
});

for (const remote of ['https://x-access-token@github.com/o/r.git', '--upload-pack=x', '', 'a b', 7])
  test(`refuses the remote ${String(remote)} because only a plain remote name is allowed`, async () => {
    await refused(fakeGit(), /remote .* is not a plain git remote name/)({ remote });
  });

for (const [label, message] of [
  ['an empty message', ''],
  ['a blank message', '  '],
  ['a missing message', undefined],
])
  test(`refuses ${label}`, async () => {
    await refused(fakeGit(), /message must be a non-empty string/)({ message });
  });

for (const identity of [undefined, { name: 'x' }, { email: 'x@example.test' }, { name: '', email: 'x@example.test' }])
  test(`refuses the identity ${JSON.stringify(identity)}`, async () => {
    await refused(fakeGit(), /identity must carry both name and email/)({ identity });
  });

test('every git call runs inside the state checkout, never in the code repository around it', async () => {
  const root = fakeRoot();
  const fake = fakeGit({ diff: staged, 'rev-parse': head });
  await commitState(request(root, { run: fake.run }));
  assert.ok(fake.places.length > 0);
  assert.ok(
    fake.places.every((place) => place === join(root, 'state')),
    fake.places.join(', ')
  );
});

test('git is given the identity through -c flags, the paths relative to the state checkout, and the state branch', async () => {
  const fake = fakeGit({ diff: staged, 'rev-parse': head });
  const paths = [A, 'state/spend-report.md'];
  const result = await commitState(request(fakeRoot(), { paths, run: fake.run }));
  assert.deepEqual(result, { committed: true, commit: 'a'.repeat(40) });
  const commit = fake.calls.find((args) => args.includes('commit'));
  const flags = '-c user.name=Test Writer -c user.email=writer@example.test -c commit.gpgsign=false';
  assert.equal(commit.slice(0, 6).join(' '), flags);
  assert.deepEqual(commit.slice(6), [
    'commit',
    '--message',
    'record a',
    '--',
    'claims/2026/11/a.json',
    'spend-report.md',
  ]);
  assert.deepEqual(
    fake.calls.find((args) => args.includes('add')),
    ['add', '--', 'claims/2026/11/a.json', 'spend-report.md']
  );
  assert.deepEqual(
    fake.calls.find((args) => args.includes('push')),
    ['push', 'origin', `HEAD:refs/heads/${STATE_BRANCH}`]
  );
  assert.equal(forced(fake.calls), false);
});

test('a push rejected three times throws, says nothing was forced, and never passes a force flag', async () => {
  const fake = fakeGit({ diff: staged, push: moved, 'rev-parse': head });
  await assert.rejects(
    commitState(request(fakeRoot(), { run: fake.run })),
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
    commitState(request(fakeRoot(), { run: fake.run })),
    (error) => error instanceof CommitError && /Permission denied/.test(error.message)
  );
  assert.equal(count(fake.calls, 'push'), 1);
  assert.equal(count(fake.calls, 'pull'), 0);
});

test('a fetch that fails for a reason other than a missing branch throws before anything is staged', async () => {
  const unreachable = { status: 128, stdout: '', stderr: 'fatal: unable to access the remote: Could not resolve host' };
  const fake = fakeGit({ fetch: unreachable });
  await assert.rejects(
    commitState(request(fakeRoot(), { run: fake.run })),
    (error) => error instanceof CommitError && /git fetch origin autowriter-state failed/.test(error.message)
  );
  assert.equal(count(fake.calls, 'add'), 0);
});

const switchedToOrphan = (calls) =>
  calls.some((args) => args.includes('symbolic-ref') && args.includes(`refs/heads/${STATE_BRANCH}`));

test('a code branch checked out in state is made an orphan branch with an empty index when the remote has none', async () => {
  const fake = fakeGit({
    fetch: absent,
    diff: staged,
    'rev-parse': head,
    'symbolic-ref': (args) =>
      args.includes('--short') ? { status: 0, stdout: 'main\n', stderr: '' } : { status: 0, stdout: '', stderr: '' },
  });
  await commitState(request(fakeRoot(), { run: fake.run }));
  assert.equal(switchedToOrphan(fake.calls), true);
  const order = fake.calls.map((args) =>
    args.find((word) => ['symbolic-ref', 'read-tree', 'add', 'commit', 'push'].includes(word))
  );
  assert.deepEqual(order.filter(Boolean), ['symbolic-ref', 'symbolic-ref', 'read-tree', 'add', 'commit', 'push']);
  assert.deepEqual(
    fake.calls.find((args) => args.includes('read-tree')),
    ['read-tree', '--empty']
  );
});

test('a checkout with no commit yet needs no orphan switch, because its first commit is already a root commit', async () => {
  const fake = fakeGit({
    fetch: absent,
    diff: staged,
    'rev-parse': (args) => (args.includes('--verify') ? noHead : head),
  });
  await commitState(request(fakeRoot(), { run: fake.run }));
  assert.equal(count(fake.calls, 'read-tree'), 0);
  assert.equal(switchedToOrphan(fake.calls), false);
});

test('a state branch that already carries unpushed local commits is kept, not replaced by a fresh orphan', async () => {
  const fake = fakeGit({
    fetch: absent,
    diff: staged,
    'rev-parse': head,
    'symbolic-ref': { status: 0, stdout: 'autowriter-state\n', stderr: '' },
  });
  await commitState(request(fakeRoot(), { run: fake.run }));
  assert.equal(count(fake.calls, 'read-tree'), 0);
});

test('an unrelated history is refused when the remote has the branch', async () => {
  const fake = fakeGit({ 'merge-base': { status: 1, stdout: '', stderr: '' }, 'rev-parse': head });
  await assert.rejects(
    commitState(request(fakeRoot(), { run: fake.run })),
    (error) => error instanceof CommitError && /not a checkout of autowriter-state/.test(error.message)
  );
  assert.equal(count(fake.calls, 'add'), 0);
  assert.equal(count(fake.calls, 'push'), 0);
});

for (const [label, text, secret, mask] of [
  [
    'a token',
    'fatal: unable to access https://x-access-token@github.com/o/r.git/: 403',
    'x-access-token',
    '://***@github.com',
  ],
  [
    'a user and password',
    'fatal: unable to access https://bot:hunter2@github.com/o/r.git/: 403',
    'hunter2',
    '://***@github.com',
  ],
  [
    'an authorization header',
    'remote: Authorization: basic eC1hY2Nlc3MtdG9rZW46c2VjcmV0',
    'eC1hY2Nlc3MtdG9rZW46c2VjcmV0',
    'Authorization: ***',
  ],
  ['a bearer header in any case', 'AUTHORIZATION: Bearer s3cr3t-value-123', 's3cr3t-value-123', 'AUTHORIZATION: ***'],
  [
    'a GitHub token',
    'fatal: bad credentials ghs_0123456789abcdefghijklmnopqrstuvwxyz',
    'ghs_0123456789abcdefghijklmnopqrstuvwxyz',
    'bad credentials ***',
  ],
  [
    'a fine grained token',
    'denied github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstu',
    'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstu',
    'denied ***',
  ],
]) {
  test(`a credential in git stderr is redacted: ${label}`, async () => {
    const failing = { status: 1, stdout: '', stderr: text };
    for (const handlers of [
      { fetch: failing },
      { add: failing },
      { diff: staged, commit: failing },
      { diff: staged, push: failing },
    ]) {
      const fake = fakeGit(handlers);
      await assert.rejects(
        commitState(request(fakeRoot(), { run: fake.run })),
        (error) => error instanceof CommitError && !error.message.includes(secret) && error.message.includes(mask)
      );
    }
  });
}
