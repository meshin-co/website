import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { commitRepair } from './entry-commit.mjs';
import { WriterError } from './writer-error.mjs';
import {
  BOT,
  BRANCH,
  changedGit,
  committedFiles,
  INVALID_REQUESTS,
  MESSAGE,
  onBranch,
  refusedAs,
  scene,
  stateOf,
} from './fixtures/commit-scene.mjs';
import { gitRun } from './fixtures/git-run.mjs';
import { gitIn } from './fixtures/route-repo.mjs';

const cleanup = [];
const open = () => {
  const made = scene();
  cleanup.push(made.root);
  return made;
};
afterEach(() => {
  for (const path of cleanup.splice(0)) rmSync(path, { recursive: true, force: true });
});

const repair = ({ root, files }, run = gitRun(), overrides = {}) =>
  commitRepair({ repoRoot: root, files, message: MESSAGE, run, ...overrides });

test('a repair commit lands on the branch it finds, as one commit, with the bot as author and committer', async () => {
  const made = open();
  onBranch(made);
  const { root, start, listed } = made;
  const result = await repair(made);

  assert.deepEqual(Object.keys(result), ['commit']);
  assert.equal(gitIn(root, 'rev-parse', 'HEAD').trim(), result.commit);
  assert.equal(gitIn(root, 'branch', '--show-current').trim(), BRANCH);
  assert.equal(gitIn(root, 'rev-parse', 'HEAD~1').trim(), start);
  assert.equal(gitIn(root, 'rev-parse', 'main').trim(), start);
  assert.equal(gitIn(root, 'rev-list', '--count', `${start}..HEAD`).trim(), '1');
  assert.deepEqual(gitIn(root, 'branch', '--format=%(refname:short)').split('\n').filter(Boolean).sort(), [
    BRANCH,
    'main',
  ]);
  assert.deepEqual(committedFiles(root), listed);
  assert.equal(gitIn(root, 'log', '-1', '--format=%an|%ae|%cn|%ce').trim(), BOT);
  assert.equal(gitIn(root, 'log', '-1', '--format=%B').trim(), MESSAGE);
});

test('a repair commit on a detached head lands on that head and creates no branch', async () => {
  const made = open();
  gitIn(made.root, 'checkout', '--quiet', '--detach');
  const result = await repair(made);

  assert.equal(gitIn(made.root, 'rev-parse', 'HEAD').trim(), result.commit);
  assert.equal(gitIn(made.root, 'rev-parse', 'HEAD~1').trim(), made.start);
  assert.equal(gitIn(made.root, 'branch', '--show-current').trim(), '');
  assert.equal(gitIn(made.root, 'rev-parse', 'main').trim(), made.start);
  assert.ok(!gitIn(made.root, 'branch', '--format=%(refname:short)').includes(BRANCH));
  assert.deepEqual(committedFiles(made.root), made.listed);
});

test('a repair adds the given paths and nothing broader, and leaves files nobody listed alone', async () => {
  const made = open();
  onBranch(made);
  const run = gitRun();
  await repair(made, run);

  assert.deepEqual(
    run.calls.filter((args) => args.includes('add')),
    [['add', '--', ...made.listed]]
  );
  for (const args of run.calls)
    for (const broad of ['-A', '--all', '.', '-u', '--update']) assert.ok(!args.includes(broad), args.join(' '));
  assert.equal(
    gitIn(made.root, 'status', '--porcelain').split('\n').filter(Boolean).sort().join('|'),
    ' M audits/phase-4.7/dispositions/existing.json|?? scratch.txt'
  );
});

test('a repair takes its identity from the command, not from the machine, and signing is switched off', async () => {
  const made = open();
  onBranch(made);
  const config = join(tmpdir(), `repair-global-${process.pid}.gitconfig`);
  writeFileSync(
    config,
    '[user]\n  name = Someone Else\n  email = else@example.test\n[commit]\n  gpgsign = true\n[gpg]\n  program = /usr/bin/false\n'
  );
  cleanup.push(config);

  await repair(made, gitRun({ env: { GIT_CONFIG_GLOBAL: config } }));

  assert.equal(gitIn(made.root, 'log', '-1', '--format=%an|%ae|%cn|%ce').trim(), BOT);
});

test('an identity forced from the environment is caught, and the repair commit is taken back', async () => {
  const made = open();
  onBranch(made);
  const before = stateOf(made.root);
  const run = gitRun({ env: { GIT_COMMITTER_NAME: 'intruder', GIT_COMMITTER_EMAIL: 'intruder@example.test' } });

  await assert.rejects(repair(made, run), refusedAs(/committer/));
  assert.deepEqual(stateOf(made.root), before);
  assert.equal(gitIn(made.root, 'rev-parse', BRANCH).trim(), made.start);
});

for (const step of ['add', 'commit']) {
  test(`when git ${step} fails in a repair, the head is where it started and every file is as it was`, async () => {
    const made = open();
    onBranch(made);
    const before = stateOf(made.root);
    const run = gitRun({ fail: (args) => args.includes(step) });

    await assert.rejects(repair(made, run), refusedAs(new RegExp(`${step}[^]*injected failure`)));
    assert.deepEqual(stateOf(made.root), before);
  });
}

test('a repair commit that holds a file nobody listed is taken back to the starting commit', async () => {
  const made = open();
  onBranch(made);
  const before = stateOf(made.root);
  const inner = gitRun();
  const run = (command, args, options) => {
    const result = inner(command, args, options);
    return args.includes('diff-tree') ? { ...result, stdout: `${result.stdout}scratch.txt\0` } : result;
  };
  run.calls = inner.calls;

  await assert.rejects(repair(made, run), refusedAs(/scratch\.txt/));
  assert.deepEqual(stateOf(made.root), before);
  assert.equal(gitIn(made.root, 'rev-parse', BRANCH).trim(), made.start);
});

test('a file the repair commit holds no change to is taken back, naming the file', async () => {
  const made = open();
  onBranch(made);
  const before = stateOf(made.root);
  const path = 'site/src/data/post/existing-post.md';
  const unchanged = { path, text: readFileSync(join(made.root, path), 'utf8') };

  await assert.rejects(repair({ ...made, files: [...made.files, unchanged] }), refusedAs(/existing-post\.md/));
  assert.deepEqual(stateOf(made.root), before);
});

test('a failed repair removes the directory it made and brings back a file that was edited by hand', async () => {
  const made = open();
  onBranch(made);
  writeFileSync(join(made.root, 'docs/SEMANTIC-CORE.md'), 'edited by hand before the call\n');
  const before = stateOf(made.root);
  const deeper = { path: 'audits/autowriter/generations/deeper/still/record.json', text: '{}\n' };
  const run = gitRun({ fail: (args) => args.includes('commit') });

  await assert.rejects(repair({ ...made, files: [...made.files, deeper] }, run), WriterError);
  assert.deepEqual(stateOf(made.root), before);
  assert.equal(readFileSync(join(made.root, 'docs/SEMANTIC-CORE.md'), 'utf8'), 'edited by hand before the call\n');
});

test('staged changes nobody listed are refused before a repair touches anything', async () => {
  const made = open();
  onBranch(made);
  gitIn(made.root, 'add', 'scratch.txt');
  const before = stateOf(made.root);
  const run = gitRun();

  await assert.rejects(repair(made, run), refusedAs(/scratch\.txt/));
  assert.deepEqual(stateOf(made.root), before);
  assert.ok(!changedGit(run.calls), 'git changed something');
});

test('repository hooks are not run for a repair commit either', async () => {
  const made = open();
  onBranch(made);
  const hook = join(made.root, '.git/hooks/pre-commit');
  writeFileSync(hook, '#!/bin/sh\necho "edited by a hook" >> site/content-facts.json\ngit add scratch.txt\nexit 1\n');
  chmodSync(hook, 0o755);

  await repair(made);

  assert.deepEqual(committedFiles(made.root), made.listed);
});

for (const [name, { extra, ...overrides }] of Object.entries(INVALID_REQUESTS)) {
  if ('branch' in overrides) continue;
  test(`${name} is refused by a repair before anything is touched`, async () => {
    const made = open();
    onBranch(made);
    const before = stateOf(made.root);
    const run = gitRun();
    const files = extra ? [...made.files, extra] : made.files;

    await assert.rejects(repair({ ...made, files }, run, overrides), refusedAs(/./));
    assert.deepEqual(stateOf(made.root), before);
    assert.ok(!changedGit(run.calls), 'git changed something');
  });
}
