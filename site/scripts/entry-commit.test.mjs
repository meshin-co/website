import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { commitRoute } from './entry-commit.mjs';
import { WriterError } from './writer-error.mjs';
import {
  BOT,
  BRANCH,
  committedFiles,
  INVALID_REQUESTS,
  MESSAGE,
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

const commit = ({ root, files }, run = gitRun(), overrides = {}) =>
  commitRoute({ repoRoot: root, branch: BRANCH, files, message: MESSAGE, run, ...overrides });

test('one commit holds exactly the given files, on a new branch, with the bot as author and committer', async () => {
  const made = open();
  const { root, start, listed } = made;
  const { commit: sha, branch } = await commit(made);

  assert.equal(branch, BRANCH);
  assert.equal(gitIn(root, 'rev-parse', 'HEAD').trim(), sha);
  assert.equal(gitIn(root, 'branch', '--show-current').trim(), BRANCH);
  assert.equal(gitIn(root, 'rev-parse', 'HEAD~1').trim(), start);
  assert.equal(gitIn(root, 'rev-parse', 'main').trim(), start);
  assert.equal(gitIn(root, 'rev-list', '--count', `${start}..HEAD`).trim(), '1');
  assert.deepEqual(committedFiles(root), listed);
  assert.equal(gitIn(root, 'log', '-1', '--format=%an|%ae|%cn|%ce').trim(), BOT);
  assert.equal(gitIn(root, 'log', '-1', '--format=%B').trim(), MESSAGE);
});

test('every file is written by the commit, new and changed alike, and the commit holds what is on disk', async () => {
  const made = open();
  await commit(made);

  for (const { path, text } of made.files) {
    assert.equal(readFileSync(join(made.root, path), 'utf8'), text, path);
    assert.equal(gitIn(made.root, 'show', `HEAD:${path}`), text, path);
  }
});

test('files nobody listed stay out of the commit and stay as they were', async () => {
  const made = open();
  await commit(made);

  assert.equal(
    gitIn(made.root, 'status', '--porcelain').split('\n').filter(Boolean).sort().join('|'),
    ' M audits/phase-4.7/dispositions/existing.json|?? scratch.txt'
  );
});

test('it adds the given paths and nothing broader', async () => {
  const made = open();
  const run = gitRun();
  await commit(made, run);

  const adds = run.calls.filter((args) => args.includes('add'));
  assert.equal(adds.length, 1);
  assert.deepEqual(adds[0], ['add', '--', ...made.listed]);
  for (const args of run.calls)
    for (const broad of ['-A', '--all', '.', '-u', '--update']) assert.ok(!args.includes(broad), args.join(' '));
});

test('the identity comes from the command, not from the machine, and signing is switched off', async () => {
  const made = open();
  const config = join(tmpdir(), `route-global-${process.pid}.gitconfig`);
  writeFileSync(
    config,
    '[user]\n  name = Someone Else\n  email = else@example.test\n[commit]\n  gpgsign = true\n[gpg]\n  program = /usr/bin/false\n'
  );
  cleanup.push(config);

  await commit(made, gitRun({ env: { GIT_CONFIG_GLOBAL: config } }));

  assert.equal(gitIn(made.root, 'log', '-1', '--format=%an|%ae|%cn|%ce').trim(), BOT);
});

test('an identity forced from the environment is caught, and the commit is rolled back', async () => {
  const made = open();
  const before = stateOf(made.root);

  await assert.rejects(
    commit(made, gitRun({ env: { GIT_COMMITTER_NAME: 'intruder', GIT_COMMITTER_EMAIL: 'intruder@example.test' } })),
    refusedAs(/committer/)
  );
  assert.deepEqual(stateOf(made.root), before);
});

test('an existing branch is refused, and nothing is written', async () => {
  const made = open();
  gitIn(made.root, 'branch', BRANCH);
  const before = stateOf(made.root);

  await assert.rejects(commit(made), refusedAs(new RegExp(BRANCH)));
  assert.deepEqual(stateOf(made.root), before);
});

for (const step of ['checkout', 'add', 'commit']) {
  test(`when git ${step} fails, the branch is gone, the starting branch is back and every file is as it was`, async () => {
    const made = open();
    const before = stateOf(made.root);
    const run = gitRun({ fail: (args) => args.includes(step) });

    await assert.rejects(commit(made, run), refusedAs(new RegExp(`${step}[^]*injected failure`)));
    assert.deepEqual(stateOf(made.root), before);
  });
}

test('a file the commit holds no change to is rolled back, naming the file', async () => {
  const made = open();
  const before = stateOf(made.root);
  const unchanged = {
    path: 'site/src/data/post/existing-post.md',
    text: readFileSync(join(made.root, 'site/src/data/post/existing-post.md'), 'utf8'),
  };

  await assert.rejects(commit({ ...made, files: [...made.files, unchanged] }), refusedAs(/existing-post\.md/));
  assert.deepEqual(stateOf(made.root), before);
  assert.equal(gitIn(made.root, 'rev-parse', 'main').trim(), made.start);
});

test('repository hooks are not run for the commit, so no hook can change or add to what was verified', async () => {
  const made = open();
  const hook = join(made.root, '.git/hooks/pre-commit');
  writeFileSync(hook, '#!/bin/sh\necho "edited by a hook" >> site/content-facts.json\ngit add scratch.txt\nexit 1\n');
  chmodSync(hook, 0o755);

  await commit(made);

  const facts = made.files.find(({ path }) => path === 'site/content-facts.json');
  assert.deepEqual(committedFiles(made.root), made.listed);
  assert.equal(gitIn(made.root, 'show', 'HEAD:site/content-facts.json'), facts.text);
});

test('a commit that holds a file nobody listed is rolled back, whatever put it there', async () => {
  const made = open();
  const before = stateOf(made.root);
  const inner = gitRun();
  const run = (command, args, options) => {
    const result = inner(command, args, options);
    return args.includes('diff-tree') ? { ...result, stdout: `${result.stdout}scratch.txt\0` } : result;
  };
  run.calls = inner.calls;

  await assert.rejects(commit(made, run), refusedAs(/scratch\.txt/));
  assert.deepEqual(stateOf(made.root), before);
  assert.equal(gitIn(made.root, 'rev-parse', 'main').trim(), made.start);
});

test('staged changes that nobody listed are refused before anything happens', async () => {
  const made = open();
  gitIn(made.root, 'add', 'scratch.txt');
  const before = stateOf(made.root);

  await assert.rejects(commit(made), refusedAs(/scratch\.txt/));
  assert.deepEqual(stateOf(made.root), before);
});

test('a detached starting point is checked out again after a failure, and the commit still lands on its branch', async () => {
  const made = open();
  gitIn(made.root, 'checkout', '--quiet', '--detach');
  const before = stateOf(made.root);

  await assert.rejects(commit(made, gitRun({ fail: (args) => args.includes('commit') })), WriterError);
  assert.deepEqual(stateOf(made.root), before);
  assert.equal(gitIn(made.root, 'rev-parse', 'HEAD').trim(), made.start);

  const { commit: sha } = await commit(made);
  assert.equal(gitIn(made.root, 'rev-parse', `${sha}~1`).trim(), made.start);
});

test('a directory the files need is created, and removed again when the commit fails', async () => {
  const made = open();
  const deeper = { path: 'audits/autowriter/generations/deeper/still/record.json', text: '{}\n' };
  const before = stateOf(made.root);

  await assert.rejects(
    commit({ ...made, files: [...made.files, deeper] }, gitRun({ fail: (args) => args.includes('commit') })),
    WriterError
  );
  assert.deepEqual(stateOf(made.root), before);
});

test('a file that is already modified on disk is overwritten for the commit and brought back when the commit fails', async () => {
  const made = open();
  writeFileSync(join(made.root, 'docs/SEMANTIC-CORE.md'), 'edited by hand before the call\n');
  const before = stateOf(made.root);

  await assert.rejects(commit(made, gitRun({ fail: (args) => args.includes('commit') })), WriterError);
  assert.deepEqual(stateOf(made.root), before);
  assert.equal(readFileSync(join(made.root, 'docs/SEMANTIC-CORE.md'), 'utf8'), 'edited by hand before the call\n');
});

for (const [name, { extra, ...overrides }] of Object.entries(INVALID_REQUESTS)) {
  test(`${name} is refused before anything is touched`, async () => {
    const made = open();
    const before = stateOf(made.root);
    const run = gitRun();
    const files = extra ? [...made.files, extra] : made.files;

    await assert.rejects(commit({ ...made, files }, run, overrides), refusedAs(/./));
    assert.deepEqual(stateOf(made.root), before);
    assert.ok(
      !run.calls.some((args) => ['checkout', 'add', 'commit'].some((word) => args.includes(word))),
      'git changed something'
    );
  });
}
