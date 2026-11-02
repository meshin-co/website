import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { addUntrackedFile, editFile, removeFile } from './mutation-specimens.mjs';

const REPO = resolve(import.meta.dirname, '..', '..');
const INSIDE = join(REPO, 'audits', 'a-path-no-specimen-may-address.json');
const REFUSAL = /working repository/;

const scratch = () => mkdtemp(join(tmpdir(), 'specimen-scope-'));

test('the three helpers refuse a path inside the working repository before they touch the disk', async () => {
  assert.equal(existsSync(INSIDE), false, 'the test addresses a path that does not exist');

  await assert.rejects(
    editFile(INSIDE, () => 'edited'),
    REFUSAL
  );
  await assert.rejects(removeFile(INSIDE), REFUSAL);
  await assert.rejects(addUntrackedFile(INSIDE, '{}\n'), REFUSAL);

  assert.equal(existsSync(INSIDE), false, 'a refused specimen creates nothing');
});

test('the refusal is the guard and not a missing file, because a missing file reports ENOENT instead', async () => {
  const outside = join(await scratch(), 'absent.json');

  await assert.rejects(
    editFile(outside, () => 'edited'),
    { code: 'ENOENT' }
  );
  await assert.rejects(removeFile(outside), { code: 'ENOENT' });
});

test('the refusal names the path it refused, so a planted specimen says where it tried to write', async () => {
  await assert.rejects(removeFile(INSIDE), /audits\/a-path-no-specimen-may-address\.json/);
});

test('the same three helpers still plant and restore normally outside the repository', async () => {
  const where = await scratch();
  const file = join(where, 'record.json');
  await writeFile(file, 'before\n');

  const restoreEdit = await editFile(file, (text) => text.replace('before', 'after'));
  assert.equal(await readFile(file, 'utf8'), 'after\n');
  await restoreEdit();
  assert.equal(await readFile(file, 'utf8'), 'before\n');

  const restoreRemoval = await removeFile(file);
  assert.equal(existsSync(file), false);
  await restoreRemoval();
  assert.equal(await readFile(file, 'utf8'), 'before\n');

  const restoreAdd = await addUntrackedFile(join(where, 'new', 'file.json'), '{}\n');
  await restoreAdd();
  assert.equal(existsSync(join(where, 'new')), false);
});
