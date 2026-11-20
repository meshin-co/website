import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';

import { NOT_CHECKED_OUT, legacyLayoutFindings, stateFindings } from './autowriter-state-rules.mjs';

const directories = [];

function repository(files = []) {
  const root = mkdtempSync(join(tmpdir(), 'state-rules-'));
  directories.push(root);
  for (const path of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), '{}\n');
  }
  return root;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test('a checkout without the state refuses by name, so the rules that read it never judge no file as a pass', () => {
  const found = stateFindings(repository(['audits/routes.json']));

  assert.equal(found.length, 1);
  assert.equal(found[0].rule, 'state-missing');
  assert.equal(found[0].path, 'state');
  assert.match(found[0].detail, /the folder is absent/);
  assert.match(found[0].detail, /judge no file/);
  assert.ok(found[0].detail.endsWith(NOT_CHECKED_OUT));
});

test('the refusal tells a reader how to check the branch out', () => {
  assert.match(NOT_CHECKED_OUT, /autowriter-state/);
  assert.match(NOT_CHECKED_OUT, /git worktree add state autowriter-state/);
});

test('a state that is a file is as missing as an absent one', () => {
  const root = repository(['state']);

  assert.deepEqual(
    stateFindings(root).map(({ rule }) => rule),
    ['state-missing']
  );
});

test('a state folder, even an empty one, is present, and nothing is said', () => {
  const root = repository();
  mkdirSync(join(root, 'state'));

  assert.deepEqual(stateFindings(root), []);
});

test('a tree with no old-layout file has no legacy finding', () => {
  const root = repository([
    'state/ledger/2026/11/a-post.json',
    'state/claims/2026/11/a-post.json',
    'state/spend-report.md',
    'audits/autowriter/generations/2026/11/a-post.json',
    'audits/routes.json',
  ]);

  assert.deepEqual(legacyLayoutFindings(root), []);
});

const LEGACY = [
  'audits/autowriter/2026/11/a-post.json',
  'audits/autowriter/a-post.json',
  'audits/autowriter/claims/2026/11/a-post.json',
  'audits/autowriter/claims/a-post.json',
  'audits/spend-report.md',
  'audits/search-demand.md',
  'audits/keyword-demand.md',
];

for (const path of LEGACY) {
  test(`${path} is filed in the old layout, so the tree is refused by name`, () => {
    const found = legacyLayoutFindings(repository([path]));

    assert.equal(found.length, 1);
    assert.equal(found[0].rule, 'legacy-layout-present');
    assert.equal(found[0].path, path);
    assert.match(found[0].detail, /predates the branch autowriter-state/);
  });
}

test('every old-layout file is reported, sorted by path', () => {
  const found = legacyLayoutFindings(repository([...LEGACY].reverse()));

  assert.deepEqual(
    found.map(({ path }) => path),
    [...LEGACY].sort()
  );
});

test('a generation record under audits/autowriter is not old layout, because it stays in the tree', () => {
  const root = repository([
    'audits/autowriter/generations/2026/11/a-post.json',
    'audits/autowriter/generations/a-post.json',
  ]);

  assert.deepEqual(legacyLayoutFindings(root), []);
});

test('a non-record file under audits/autowriter is not old layout', () => {
  assert.deepEqual(legacyLayoutFindings(repository(['audits/autowriter/README.md'])), []);
});

test('an old-layout file is refused whether or not the state is checked out', () => {
  const root = repository(['audits/autowriter/2026/11/a-post.json']);
  mkdirSync(join(root, 'state'));

  assert.deepEqual(stateFindings(root), []);
  assert.equal(legacyLayoutFindings(root).length, 1);
});
