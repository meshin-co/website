import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { recordScene } from './lh-record-family.mjs';

const SCRIPTS = import.meta.dirname;
const REAL_SITE = join(SCRIPTS, '..');
const PHASE = 'zz-specimen';
const MARKED = (action) =>
  `refusing to ${action} in an unattended run: a person at a terminal does this; AUTOWRITER_UNATTENDED is set\n`;
const STAMP = `${JSON.stringify({ fingerprint: 'b'.repeat(64), startedAt: '2026-11-01T08:00:00.000Z' })}\n`;

const scenes = [];
afterEach(async () => {
  for (const scene of scenes.splice(0))
    await rm(scene, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const scratch = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'unattended-lh-commands-'));
  scenes.push(directory);
  return directory;
};

const environment = (marker, extra = {}) => {
  const env = { ...process.env, ...extra };
  delete env.AUTOWRITER_UNATTENDED;
  return marker === undefined ? env : { ...env, AUTOWRITER_UNATTENDED: marker };
};

const spawn = (cwd, args, env) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env });

const RECORDER = 'site/scripts/run-lh-evidence.mjs';

test('an unattended process cannot record a green Lighthouse run, and audits/lighthouse-green.json is not written', async () => {
  const { root } = await recordScene({ copySite: REAL_SITE, work: await scratch() });

  const run = spawn(root, [RECORDER, 'record', PHASE], environment('1'));

  assert.equal(run.status, 1, run.stdout);
  assert.equal(run.stderr, MARKED('record the Lighthouse run'));
  assert.equal(run.stdout, '');
  assert.equal(existsSync(join(root, 'audits', 'lighthouse-green.json')), false);
});

test('the same record without the marker writes the record, so the guard is what stopped the one above', async () => {
  const { root } = await recordScene({ copySite: REAL_SITE, work: await scratch() });

  const run = spawn(root, [RECORDER, 'record', PHASE], environment());

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /lighthouse: recorded a passing calibration run/);
  assert.equal(JSON.parse(await readFile(join(root, 'audits', 'lighthouse-green.json'), 'utf8')).phase, PHASE);
});

test('checking the record is not refused under the marker: the pre-push hook reads, it never writes', async () => {
  const { root } = await recordScene({ copySite: REAL_SITE, work: await scratch() });

  const run = spawn(root, [RECORDER, 'check'], environment('1'));

  assert.doesNotMatch(run.stderr, /unattended run/);
});

const PARALLEL = join(SCRIPTS, 'run-lh-parallel.mjs');

async function shardScene() {
  const root = await scratch();
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root });
  const site = join(root, 'site');
  await mkdir(join(root, 'bin'), { recursive: true });
  await writeFile(join(root, 'bin', 'npm'), `#!/bin/sh\ntouch "${root}/npm-was-run"\nexit 0\n`);
  await chmod(join(root, 'bin', 'npm'), 0o755);
  await mkdir(join(site, 'dist'), { recursive: true });
  await mkdir(join(site, 'src'), { recursive: true });
  await symlink(SCRIPTS, join(site, 'scripts'));
  await writeFile(join(site, 'dist', 'index.html'), '<html></html>');
  await writeFile(join(site, 'src', 'page.astro'), '<p>one</p>');
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'one');
  const auditDir = join(root, 'audits', `phase-${PHASE}`);
  await mkdir(join(auditDir, 'lh-mobile'), { recursive: true });
  await writeFile(join(auditDir, 'lh-mobile', 'lhr-keep.json'), '{}');
  await writeFile(join(auditDir, 'lh-measured.json'), STAMP);
  return { root, site, auditDir };
}

const shard = ({ root, site }, marker) =>
  spawn(
    site,
    [PARALLEL],
    environment(marker, {
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      GATE_PHASE: PHASE,
      AUDIT_ROOT: root,
      LH_WORKERS: '2',
    })
  );

test('an unattended process cannot start the Lighthouse gate: no shard runs, the reports stay and the stamp is untouched', async () => {
  const scene = await shardScene();

  const run = shard(scene, '1');

  assert.equal(run.status, 1, run.stdout);
  assert.equal(run.stderr, MARKED('run the Lighthouse gate'));
  assert.equal(run.stdout, '');
  assert.equal(existsSync(join(scene.root, 'npm-was-run')), false);
  assert.equal(existsSync(join(scene.auditDir, 'lh-mobile', 'lhr-keep.json')), true);
  assert.equal(await readFile(join(scene.auditDir, 'lh-measured.json'), 'utf8'), STAMP);
});

test('the same run without the marker measures and re-stamps, so the guard is what stopped the one above', async () => {
  const scene = await shardScene();

  const run = shard(scene, undefined);

  assert.equal(existsSync(join(scene.root, 'npm-was-run')), true, run.stderr);
  assert.match(run.stdout, /lighthouse: .* shards across/);
  assert.equal(existsSync(join(scene.auditDir, 'lh-mobile', 'lhr-keep.json')), false);
});

test('the marker true refuses the Lighthouse gate as 1 does', async () => {
  const scene = await shardScene();

  const run = shard(scene, 'true');

  assert.equal(run.status, 1);
  assert.equal(run.stderr, MARKED('run the Lighthouse gate'));
  assert.equal(existsSync(join(scene.root, 'npm-was-run')), false);
});
