import './no-network.mjs';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import {
  BOT,
  HUMAN,
  branchCommit,
  commitAs,
  gitIn,
  initRepo,
  mergeAs,
  removeRepos,
  shallowClone,
} from './history-repo.mjs';

const made = [];
after(() => removeRepos(...made));
const fresh = () => {
  const root = initRepo();
  made.push(root);
  return root;
};

test('a commit names the person given as author and committer, and keeps the message as written', () => {
  const root = fresh();
  const message = 'feat(autowriter): write x\n\nProvenance: audits/autowriter/generations/x.json';
  const sha = commitAs(root, BOT, { write: { 'a.txt': 'a\n' }, message });
  assert.equal(gitIn(root, ['rev-parse', 'HEAD']).trim(), sha);
  assert.equal(
    gitIn(root, ['log', '-1', '--format=%an|%ae|%cn|%ce']).trim(),
    [BOT.name, BOT.email, BOT.name, BOT.email].join('|')
  );
  assert.equal(gitIn(root, ['log', '-1', '--format=%B']).trim(), message);
});

test('a commit without a person is the owner, and a removed file is gone from the tree it makes', () => {
  const root = fresh();
  commitAs(root, HUMAN, { write: { 'a.txt': 'a\n', 'b.txt': 'b\n' }, message: 'chore(fixture): start' });
  commitAs(root, HUMAN, { remove: ['b.txt'], message: 'chore(fixture): drop b' });
  assert.equal(gitIn(root, ['log', '-1', '--format=%ae']).trim(), HUMAN.email);
  assert.deepEqual(gitIn(root, ['ls-tree', '-r', '--name-only', 'HEAD']).trim().split('\n'), ['a.txt']);
});

test('a branch commit leaves main checked out, and a merge of it has two parents', () => {
  const root = fresh();
  commitAs(root, HUMAN, { write: { 'a.txt': 'a\n' }, message: 'chore(fixture): start' });
  const side = branchCommit(root, 'side', BOT, { write: { 'side.txt': 's\n' }, message: 'feat(x): side' });
  commitAs(root, HUMAN, { write: { 'main.txt': 'm\n' }, message: 'chore(fixture): main' });
  assert.equal(gitIn(root, ['branch', '--show-current']).trim(), 'main');
  assert.equal(existsSync(join(root, 'side.txt')), false);
  mergeAs(root, 'side', HUMAN, 'chore(fixture): merge side');
  assert.equal(gitIn(root, ['rev-list', '--parents', '-1', 'HEAD']).trim().split(' ').length, 3);
  assert.equal(gitIn(root, ['merge-base', '--is-ancestor', side, 'HEAD']), '');
});

test('a shallow clone reports itself shallow and holds one commit', () => {
  const root = fresh();
  commitAs(root, HUMAN, { write: { 'a.txt': 'a\n' }, message: 'chore(fixture): one' });
  commitAs(root, HUMAN, { write: { 'a.txt': 'b\n' }, message: 'chore(fixture): two' });
  const clone = shallowClone(root);
  made.push(clone);
  assert.equal(gitIn(clone, ['rev-parse', '--is-shallow-repository']).trim(), 'true');
  assert.equal(gitIn(clone, ['rev-list', '--count', 'HEAD']).trim(), '1');
  assert.equal(gitIn(root, ['rev-parse', '--is-shallow-repository']).trim(), 'false');
});

test('a location variable left in the environment of the test does not move the repository the helpers work on', () => {
  const root = fresh();
  const other = fresh();
  commitAs(other, HUMAN, { write: { 'other.txt': 'o\n' }, message: 'chore(fixture): other' });
  const kept = process.env.GIT_DIR;
  process.env.GIT_DIR = join(other, '.git');
  try {
    commitAs(root, HUMAN, { write: { 'a.txt': 'a\n' }, message: 'chore(fixture): mine' });
    assert.deepEqual(gitIn(root, ['ls-tree', '-r', '--name-only', 'HEAD']).trim().split('\n'), ['a.txt']);
  } finally {
    if (kept === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = kept;
  }
});
