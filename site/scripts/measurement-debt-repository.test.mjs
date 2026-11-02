import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

import { headFingerprint, staleReason } from './lh-evidence.mjs';
import { CLEAR_COMMAND, treeFingerprint } from './measurement-debt.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const UNLISTED = 'd'.repeat(40);
const MAX_LISTING_BYTES = 64 * 1024 * 1024;

const parseRecord = (record) => {
  const tab = record.indexOf('\t');
  const [mode, type, sha] = record.slice(0, tab).split(' ');
  return { path: record.slice(tab + 1), mode, type, sha };
};

const directoriesOf = (paths) => {
  const found = new Set();
  for (const path of paths) {
    for (let parent = dirname(path); parent !== '.'; parent = dirname(parent)) found.add(parent);
  }
  return [...found].sort().map((path) => ({ path, mode: '040000', type: 'tree', sha: UNLISTED }));
};

function treeEntriesOfHead() {
  const listing = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    maxBuffer: MAX_LISTING_BYTES,
  });
  const files = listing.split('\0').filter(Boolean).map(parseRecord);
  return [...directoriesOf(files.map(({ path }) => path)), ...files];
}

test('the fingerprint of the tree entries GitHub lists is the fingerprint the local run records for HEAD', async () => {
  const entries = treeEntriesOfHead();
  const files = entries.filter(({ type }) => type !== 'tree');

  assert.ok(files.length > 100, `${files.length} files is too few to be this repository`);
  assert.ok(entries.length > files.length, 'no directory entry was listed, so none was proved dropped');
  assert.equal(treeFingerprint(entries), await headFingerprint(REPOSITORY_ROOT));
});

test('that fingerprint is not the one of an empty tree, so the comparison above compared something', () => {
  assert.notEqual(treeFingerprint(treeEntriesOfHead()), treeFingerprint([]));
});

test('the clear command names both commands that staleReason tells the owner to run, when no run was recorded', () => {
  const reason = staleReason(undefined, 'x');

  for (const text of [CLEAR_COMMAND, reason]) {
    assert.match(text, /gate:lh/);
    assert.match(text, /lh:record/);
    assert.ok(text.indexOf('gate:lh') < text.indexOf('lh:record'), text);
  }
});

test('the clear command names both commands that staleReason tells the owner to run, when another tree was measured', () => {
  const reason = staleReason({ fingerprint: 'a'.repeat(64), recordedAt: '2026-10-16T08:00:00.000Z' }, 'x');

  assert.match(reason, /gate:lh/);
  assert.match(reason, /lh:record/);
  assert.ok(CLEAR_COMMAND.includes('GATE_PHASE=<bucket> npm run gate:lh'));
  assert.ok(CLEAR_COMMAND.includes('GATE_PHASE=<bucket> npm run lh:record'));
});
