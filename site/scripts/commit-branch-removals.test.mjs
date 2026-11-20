import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { isGenerationRecord, removalRefusalFor } from './autowriter-refusals.mjs';
import { commitToBranch } from './commit-branch.mjs';
import {
  BRANCH,
  CLAIMED_AT,
  LEDGER,
  git,
  makeWorld,
  put,
  refusedWith,
  removeWorlds,
  request,
} from './fixtures/commit-branch-world.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';

const GENERATED = recordPath('disposition', 'model-registry', CLAIMED_AT);
const GENERATIONS = recordDirectory('generation');
const RECORD = recordPath('generation', 'model-registry', CLAIMED_AT);
const FLAT_RECORD = `${GENERATIONS}/model-registry.json`;
const DEEP_RECORD = `${GENERATIONS}/2026/11/extra/model-registry.json`;
const RECORD_PLACEMENTS = [FLAT_RECORD, RECORD, DEEP_RECORD];
const RECORD_TEXT = '{"slug":"model-registry"}\n';
const REMOVED = `generation-record-removed: ${removalRefusalFor(FLAT_RECORD).why}`;
const MOVED_OUT = 'audits/autowriter/moved-model-registry.json';
const CLAIM = 'audits/autowriter/claims/2026/11/model-registry.json';

after(removeWorlds);

function worldWithRecord(record = RECORD) {
  return makeWorld({ [record]: RECORD_TEXT, 'content/a.txt': 'alpha\n' });
}

function moveFile(world, from, to) {
  mkdirSync(dirname(join(world.repo, to)), { recursive: true });
  renameSync(join(world.repo, from), join(world.repo, to));
}

function assertNothingMoved(world, head) {
  assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
  assert.equal(git(world.repo, 'rev-parse', 'HEAD'), head);
  assert.equal(world.remoteHead(), head);
}

test('a listed generation record that was deleted is refused wherever it lies: flat, in its month and below it make three', async () => {
  let refused = 0;
  for (const record of RECORD_PLACEMENTS) {
    const world = worldWithRecord(record);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    rmSync(join(world.repo, record));

    await assert.rejects(commitToBranch(request(world.repo, { paths: [record] })), refusedWith(record, REMOVED));
    refused += 1;

    assertNothingMoved(world, head);
    assert.equal(existsSync(join(world.repo, record)), false);
    assert.equal(git(world.repo, 'status', '--porcelain'), 'D ' + record);
  }
  assert.equal(refused, 3);
});

test('a deleted record listed with an ordinary new file refuses the whole commit, flat, in its month and below it', async () => {
  let refused = 0;
  for (const record of RECORD_PLACEMENTS) {
    const world = worldWithRecord(record);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    rmSync(join(world.repo, record));
    put(world.repo, 'content/b.txt', 'beta\n');

    await assert.rejects(
      commitToBranch(request(world.repo, { paths: ['content/b.txt', record] })),
      refusedWith(record, 'generation-record-removed')
    );
    refused += 1;

    assertNothingMoved(world, head);
    assert.equal(readFileSync(join(world.repo, 'content/b.txt'), 'utf8'), 'beta\n');
    assert.equal(git(world.remote, 'ls-tree', '-r', '--name-only', BRANCH).includes('content/b.txt'), false);
  }
  assert.equal(refused, 3);
});

test('a modified record and a newly added record are committed and pushed, flat, in their month and below it', async () => {
  let committed = 0;
  for (const record of RECORD_PLACEMENTS) {
    const added = record.replace('model-registry', 'another-entry');
    const world = worldWithRecord(record);
    put(world.repo, record, '{"slug":"model-registry","changed":true}\n');
    put(world.repo, added, '{"slug":"another-entry"}\n');

    const result = await commitToBranch(request(world.repo, { paths: [record, added] }));

    assert.equal(result.committed, true);
    assert.equal(world.remoteHead(), result.commit);
    assert.equal(
      git(world.remote, 'show', '--name-status', '--format=', result.commit).split('\n').sort().join('|'),
      ['A\t' + added, 'M\t' + record].sort().join('|')
    );
    committed += 1;
  }
  assert.equal(committed, 3);
});

const RENAMES = [
  ['month record renamed within its month directory', RECORD, `${GENERATIONS}/2026/11/renamed.json`],
  ['month record renamed into another month directory', RECORD, `${GENERATIONS}/2026/12/model-registry.json`],
  ['month record renamed into the flat generations directory', RECORD, FLAT_RECORD],
  ['month record renamed out of the family', RECORD, MOVED_OUT],
  ['flat record re-homed into its month', FLAT_RECORD, RECORD],
  ['flat record renamed within the flat directory', FLAT_RECORD, `${GENERATIONS}/renamed.json`],
  ['flat record renamed out of the family', FLAT_RECORD, MOVED_OUT],
  ['deeper record re-homed into its month', DEEP_RECORD, RECORD],
];

for (const [name, from, to] of RENAMES) {
  test('a ' + name + ' is refused as a removal when both paths are listed', async () => {
    const world = worldWithRecord(from);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    moveFile(world, from, to);

    await assert.rejects(commitToBranch(request(world.repo, { paths: [from, to] })), refusedWith(from, REMOVED));

    assertNothingMoved(world, head);
    assert.equal(readFileSync(join(world.repo, to), 'utf8'), RECORD_TEXT);
    assert.equal(existsSync(join(world.repo, from)), false);
  });

  test('a ' + name + ' is refused as a removal when only the old path is listed', async () => {
    const world = worldWithRecord(from);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    moveFile(world, from, to);

    await assert.rejects(commitToBranch(request(world.repo, { paths: [from] })), refusedWith(from, REMOVED));

    assertNothingMoved(world, head);
    assert.equal(readFileSync(join(world.repo, to), 'utf8'), RECORD_TEXT);
    assert.equal(existsSync(join(world.repo, from)), false);
  });

  test('a ' + name + ' with only the new path listed commits the addition and leaves the old record', async () => {
    const world = worldWithRecord(from);
    moveFile(world, from, to);

    const result = await commitToBranch(request(world.repo, { paths: [to] }));

    assert.equal(world.remoteHead(), result.commit);
    assert.equal(git(world.remote, 'show', '--name-status', '--format=', result.commit), 'A\t' + to);
    assert.equal(git(world.remote, 'show', result.commit + ':' + from) + '\n', RECORD_TEXT);
    assert.equal(git(world.repo, 'status', '--porcelain'), 'D ' + from);
  });

  test('after a ' + name + ' with only the new path listed the old record is still a generation record', async () => {
    const world = worldWithRecord(from);
    moveFile(world, from, to);

    const result = await commitToBranch(request(world.repo, { paths: [to] }));

    const tree = git(world.remote, 'ls-tree', '-r', '--name-only', result.commit).split('\n');
    assert.ok(tree.includes(from), tree.join('\n'));
    assert.ok(tree.filter(isGenerationRecord).includes(from), tree.filter(isGenerationRecord).join('\n'));
  });
}

const NOT_RECORDS = [
  ['an ordinary file', 'content/a.txt'],
  ['a ledger in its month', LEDGER],
  ['a claim in its month', CLAIM],
  ['a generated disposition in its month', GENERATED],
  ['a file that is not json among the records', `${GENERATIONS}/notes.txt`],
];

test('a deleted path that is not a generation record is committed as a removal: five kinds are tried', async () => {
  let committed = 0;
  for (const [, path] of NOT_RECORDS) {
    const world = makeWorld({
      'content/a.txt': 'alpha\n',
      [CLAIM]: '{"status":"written"}\n',
      [GENERATED]: '[]\n',
      [`${GENERATIONS}/notes.txt`]: 'notes\n',
    });
    rmSync(join(world.repo, path));

    const result = await commitToBranch(request(world.repo, { paths: [path] }));

    assert.equal(result.committed, true);
    assert.equal(world.remoteHead(), result.commit);
    assert.equal(git(world.remote, 'show', '--name-status', '--format=', result.commit), 'D\t' + path);
    committed += 1;
  }
  assert.equal(committed, NOT_RECORDS.length);
  assert.equal(committed, 5);
});
