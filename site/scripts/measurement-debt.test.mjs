import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { newLedger, validateLedger } from './autowriter-ledger.mjs';
import { affectsBuild } from './build-surface.mjs';
import { fingerprint } from './lh-evidence.mjs';
import { CLEAR_COMMAND, ledgerWithDebt, treeFingerprint } from './measurement-debt.mjs';

const sha = (letter) => letter.repeat(40);
const MERGED = sha('f');
const NOW = new Date('2026-11-02T11:02:25.000Z');

const blob = (path, letter) => ({ path, mode: '100644', type: 'blob', sha: sha(letter), size: 10 });
const directory = (path, letter) => ({ path, mode: '040000', type: 'tree', sha: sha(letter) });

const SHIPPED = 'site/src/pages/index.astro';
const CONFIG = 'site/package.json';
const PROSE = 'docs/PRD.md';

const treeOf = () => [
  directory('site', 'd'),
  directory('site/src', 'e'),
  blob(SHIPPED, 'a'),
  blob(CONFIG, 'b'),
  blob(PROSE, 'c'),
];

const aLedger = () => newLedger({ slug: 'a-slug', runId: '41', pullRequest: 72 });

test('the paths the fingerprint tests use are the kinds they claim to be', () => {
  assert.equal(affectsBuild(SHIPPED), true);
  assert.equal(affectsBuild(CONFIG), true);
  assert.equal(affectsBuild(PROSE), false);
});

test('the clear command is the pair the owner runs in the site directory, in that order', () => {
  assert.equal(
    CLEAR_COMMAND,
    'cd site && GATE_PHASE=<bucket> npm run gate:lh && GATE_PHASE=<bucket> npm run lh:record'
  );
});

test('the blobs of a tree are fingerprinted as the local run fingerprints them, and a directory is not one', () => {
  assert.equal(
    treeFingerprint(treeOf()),
    fingerprint([
      [SHIPPED, sha('a')],
      [CONFIG, sha('b')],
      [PROSE, sha('c')],
    ])
  );
});

test('a directory entry changes nothing, however its hash moves', () => {
  const moved = treeOf().map((entry) => (entry.type === 'tree' ? { ...entry, sha: sha('9') } : entry));

  assert.equal(treeFingerprint(moved), treeFingerprint(treeOf()));
  assert.equal(treeFingerprint(treeOf().filter(({ type }) => type !== 'tree')), treeFingerprint(treeOf()));
});

test('a changed blob of a file that can change the build changes the fingerprint', () => {
  const edited = treeOf().map((entry) => (entry.path === SHIPPED ? { ...entry, sha: sha('1') } : entry));

  assert.notEqual(treeFingerprint(edited), treeFingerprint(treeOf()));
});

test('a changed blob of a prose file does not, because no measurement reads it', () => {
  const edited = treeOf().map((entry) => (entry.path === PROSE ? { ...entry, sha: sha('1') } : entry));

  assert.equal(treeFingerprint(edited), treeFingerprint(treeOf()));
});

test('the order GitHub lists the entries in does not matter', () => {
  assert.equal(treeFingerprint(treeOf().toReversed()), treeFingerprint(treeOf()));
});

test('a submodule counts as git ls-tree counts it, by the commit it pins', () => {
  const pinned = [{ path: 'vendor/engine', mode: '160000', type: 'commit', sha: sha('7') }];

  assert.equal(treeFingerprint(pinned), fingerprint([['vendor/engine', sha('7')]]));
  assert.notEqual(treeFingerprint(pinned), treeFingerprint([]));
});

test('a fingerprint is 64 lowercase hexadecimal characters', () => {
  assert.match(treeFingerprint(treeOf()), /^[0-9a-f]{64}$/);
});

test('a ledger with the debt is merged at the instant it was recorded, and names the tree, the commit and the cure', () => {
  const fingerprintOfTree = treeFingerprint(treeOf());
  const owed = ledgerWithDebt(aLedger(), { mergedCommit: MERGED, fingerprint: fingerprintOfTree, now: NOW });

  assert.deepEqual(owed.verdict, { state: 'merged', reason: null, decidedAt: '2026-11-02T11:02:25.000Z' });
  assert.deepEqual(owed.measurementDebt, {
    mergedCommit: MERGED,
    fingerprint: fingerprintOfTree,
    recordedAt: '2026-11-02T11:02:25.000Z',
    clear: CLEAR_COMMAND,
  });
});

test('a ledger with the debt passes the ledger validator, which refuses a merged verdict without one', () => {
  const owed = ledgerWithDebt(aLedger(), { mergedCommit: MERGED, fingerprint: treeFingerprint(treeOf()), now: NOW });

  assert.equal(owed.verdict.state, 'merged');
  assert.equal(owed.measurementDebt.mergedCommit, MERGED);
  assert.deepEqual(validateLedger(owed), []);
  assert.notDeepEqual(validateLedger({ ...owed, measurementDebt: undefined }), []);
});

test('the debt keeps everything else the ledger recorded, and leaves the ledger it was given untouched', () => {
  const attempt = {
    number: 1,
    judgedCommit: sha('a'),
    recordedAt: '2026-11-01T23:30:00.000Z',
    failingRule: 'gate:content',
    failingPath: null,
    tokens: { input: 120, output: 40 },
    costUsd: 0.5,
  };
  const ledger = {
    ...aLedger(),
    attempts: [attempt],
    spend: { tokens: { input: 120, output: 40 }, costUsd: 0.5 },
  };
  const before = structuredClone(ledger);
  const owed = ledgerWithDebt(ledger, { mergedCommit: MERGED, fingerprint: treeFingerprint(treeOf()), now: NOW });

  assert.deepEqual(ledger, before);
  assert.deepEqual(owed.attempts, ledger.attempts);
  assert.deepEqual(owed.spend, ledger.spend);
  assert.equal(owed.slug, 'a-slug');
  assert.equal(owed.pullRequest, 72);
  assert.equal(owed.measurementDebt.mergedCommit, MERGED);
  assert.deepEqual(validateLedger(owed), []);
});
