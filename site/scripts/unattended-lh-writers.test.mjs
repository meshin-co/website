import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { UnattendedRefusal } from './human-only.mjs';
import { clearMeasuredStamp, stampMeasuredTree, writeMeasuredStamp } from './lh-evidence.mjs';

const FINGERPRINT = 'a'.repeat(64);
const STAMP = { fingerprint: 'b'.repeat(64), startedAt: '2026-11-01T08:00:00.000Z' };

const scenes = [];
afterEach(async () => {
  delete process.env.AUTOWRITER_UNATTENDED;
  for (const scene of scenes.splice(0)) await rm(scene, { recursive: true, force: true });
});

const auditDirectory = async () => {
  const root = await mkdtemp(join(tmpdir(), 'unattended-lh-writers-'));
  scenes.push(root);
  return { root, auditDir: join(root, 'audits', 'phase-zz') };
};

const stampOf = (auditDir) => join(auditDir, 'lh-measured.json');

const keepStamp = async (auditDir) => {
  await mkdir(auditDir, { recursive: true });
  await writeFile(stampOf(auditDir), `${JSON.stringify(STAMP)}\n`);
};

const committedRepository = async () => {
  const { root, auditDir } = await auditDirectory();
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root });
  git('init', '-q');
  await mkdir(join(root, 'site', 'src'), { recursive: true });
  await writeFile(join(root, 'site', 'src', 'page.astro'), '<p>one</p>');
  git('add', '-A');
  git('commit', '-q', '-m', 'one');
  return { root, auditDir };
};

const unattended = () => {
  process.env.AUTOWRITER_UNATTENDED = '1';
};

const REFUSED = (action) => ({
  name: 'UnattendedRefusal',
  message: `refusing to ${action} in an unattended run: a person at a terminal does this; AUTOWRITER_UNATTENDED is set`,
});

test('an unattended process cannot write the measured stamp, and no directory or file appears', async () => {
  const { auditDir } = await auditDirectory();
  unattended();

  await assert.rejects(writeMeasuredStamp({ auditDir, fingerprint: FINGERPRINT }), (error) => {
    assert.ok(error instanceof UnattendedRefusal);
    assert.deepEqual({ name: error.name, message: error.message }, REFUSED('write the Lighthouse measured stamp'));
    return true;
  });
  assert.equal(existsSync(auditDir), false);
});

test('without the marker the same call writes the stamp', async () => {
  const { auditDir } = await auditDirectory();

  await writeMeasuredStamp({ auditDir, fingerprint: FINGERPRINT, startedAt: STAMP.startedAt });

  assert.deepEqual(JSON.parse(await readFile(stampOf(auditDir), 'utf8')), {
    fingerprint: FINGERPRINT,
    startedAt: STAMP.startedAt,
  });
});

test('an unattended process cannot clear a measured stamp, so it cannot hide a stale one either', async () => {
  const { auditDir } = await auditDirectory();
  await keepStamp(auditDir);
  unattended();

  await assert.rejects(clearMeasuredStamp(auditDir), UnattendedRefusal);
  await assert.rejects(clearMeasuredStamp(auditDir), REFUSED('clear the Lighthouse measured stamp'));
  assert.deepEqual(JSON.parse(await readFile(stampOf(auditDir), 'utf8')), STAMP);
});

test('without the marker the same call clears the stamp', async () => {
  const { auditDir } = await auditDirectory();
  await keepStamp(auditDir);

  await clearMeasuredStamp(auditDir);

  assert.equal(existsSync(stampOf(auditDir)), false);
});

test('an unattended process cannot stamp a tree: the old stamp stays and no new one is written', async () => {
  const { root, auditDir } = await committedRepository();
  unattended();

  await assert.rejects(stampMeasuredTree({ repo: root, auditDir }), UnattendedRefusal);
  assert.equal(existsSync(stampOf(auditDir)), false);

  await keepStamp(auditDir);
  await assert.rejects(stampMeasuredTree({ repo: root, auditDir }), UnattendedRefusal);
  assert.deepEqual(JSON.parse(await readFile(stampOf(auditDir), 'utf8')), STAMP);
});

test('without the marker the same call stamps the tree', async () => {
  const { root, auditDir } = await committedRepository();

  const result = await stampMeasuredTree({ repo: root, auditDir });

  assert.equal(result.stamped, true);
  assert.equal(JSON.parse(await readFile(stampOf(auditDir), 'utf8')).fingerprint, result.fingerprint);
});

test('a marker that is not 1 or true refuses nothing', async () => {
  const { auditDir } = await auditDirectory();
  process.env.AUTOWRITER_UNATTENDED = '0';

  await writeMeasuredStamp({ auditDir, fingerprint: FINGERPRINT });

  assert.equal(existsSync(stampOf(auditDir)), true);
});
