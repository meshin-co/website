import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';

import {
  buildFailure,
  ENTRY,
  landedRepo,
  OWN,
  pathsOf,
  put,
  refusedAsDeleted,
  removeRepos,
  removeTemplates,
  repair,
  ROUTES,
  strayRun,
  treeOf,
  UNTOUCHED,
} from './fixtures/repair-repo.mjs';
import { gitIn } from './fixtures/route-repo.mjs';

afterEach(removeRepos);
after(removeTemplates);

const BASE = [OWN, ROUTES, ENTRY];
const sorted = (paths) => [...paths].sort();
const withStray = (root, change, options) => repair(root, strayRun(root, change, options));
const cannedGit = (stdout, status = 0) => ({ git: () => ({ status, stdout, stderr: 'fatal: not a git repository' }) });

test('a tracked file a command changed comes back with the entry, in path order', async () => {
  const root = await landedRepo();
  const result = await withStray(root, () => put(root, UNTOUCHED, 'a command wrote this\n'));

  assert.deepEqual(pathsOf(result), sorted([...BASE, UNTOUCHED]));
  assert.equal(result.files.find(({ path }) => path === UNTOUCHED).text, 'a command wrote this\n');
});

test('a file that is new to git comes back as well, so a stray write is shown and never dropped', async () => {
  const root = await landedRepo();
  const result = await withStray(root, () => put(root, 'site/new-note.txt', 'new\n'));

  assert.deepEqual(pathsOf(result), sorted([...BASE, 'site/new-note.txt']));
});

test('a new directory comes back as the files inside it and never as the directory', async () => {
  const root = await landedRepo();
  const stray = ['site/fresh/deeper/note.txt', 'site/fresh/other.txt'];
  const result = await withStray(root, () => stray.forEach((path) => put(root, path, 'x\n')));

  assert.deepEqual(pathsOf(result), sorted([...BASE, ...stray]));
  assert.ok(pathsOf(result).every((path) => !path.endsWith('/')));
});

test('a path with spaces and accents comes back as written, because git is asked for NUL-separated records', async () => {
  const odd = "site/notes d'été à lire.txt";
  const root = await landedRepo();
  const result = await withStray(root, () => put(root, odd, 'x\n'));

  assert.deepEqual(pathsOf(result), sorted([...BASE, odd]));
});

test('a file deleted from the index is refused as well', async () => {
  const root = await landedRepo();

  await assert.rejects(
    withStray(root, () => gitIn(root, 'rm', '--quiet', UNTOUCHED)),
    refusedAsDeleted(UNTOUCHED)
  );
});

test('a rename comes back as its destination, and the origin that follows it is not read as a record', async () => {
  const root = await landedRepo();
  const reported = [];
  const move = () => {
    gitIn(root, 'mv', UNTOUCHED, 'site/moved.txt');
    reported.push(gitIn(root, 'status', '--porcelain', '-z', '--untracked-files=all'));
  };
  const result = await withStray(root, move);

  assert.ok(reported[0].includes(`R  site/moved.txt\0${UNTOUCHED}\0`));
  assert.deepEqual(pathsOf(result), sorted([...BASE, 'site/moved.txt']));
});

test('a copy comes back as its destination, and the origin that follows it is not read as a record', async () => {
  const root = await landedRepo();
  const git = cannedGit(`C  site/copy.txt\0${UNTOUCHED}\0 M ${ENTRY}\0`);
  const result = await withStray(root, () => put(root, 'site/copy.txt', 'copy\n'), git);

  assert.deepEqual(pathsOf(result), ['site/copy.txt', ENTRY]);
});

for (const stdout of ['surprise\0', ' M\0', '?? \0'])
  test(`git status output of ${JSON.stringify(stdout)} is refused as no porcelain record, and the tree is restored`, async () => {
    const root = await landedRepo();
    const before = treeOf(root);

    await assert.rejects(
      withStray(root, () => {}, cannedGit(stdout)),
      buildFailure('git status')
    );
    assert.deepEqual(treeOf(root), before);
  });

test('a git status that fails is a failure naming the command and what git said, and the tree is restored', async () => {
  const root = await landedRepo();
  const before = treeOf(root);
  const failure = buildFailure('git status', 'exited with status 128', 'fatal: not a git repository');

  await assert.rejects(
    withStray(root, () => {}, cannedGit('', 128)),
    failure
  );
  assert.deepEqual(treeOf(root), before);
});

test('a git status that never finishes is a failure naming the command', async () => {
  const root = await landedRepo();

  await assert.rejects(
    withStray(root, () => {}, cannedGit('', null)),
    buildFailure('git status', 'did not finish')
  );
});
