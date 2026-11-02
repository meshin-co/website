import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';

import { digestFor } from './dispositions.mjs';
import { UNATTENDED_VARIABLE } from './human-only.mjs';
import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';
import { unattendedSpecimens } from './unattended-specimens.mjs';

const exec = promisify(execFile);
const REAL_SITE = join(import.meta.dirname, '..');
const NAMES = ['unattendedRunsTheLighthouseGate', 'unattendedSealsDispositions', 'unattendedWritesLighthouseRecord'];
const DISPOSITION_FILE = 'audits/phase-4.7/dispositions/main.json';
const TARGET = 'src/data/glossary/zz-specimen.md';

const scenes = [];
afterEach(async () => {
  for (const scene of scenes.splice(0)) await rm(scene, { recursive: true, force: true });
});

const scratch = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'unattended-specimens-'));
  scenes.push(directory);
  return directory;
};

const run = async (command, args, cwd) => {
  try {
    const { stdout, stderr } = await exec(command, args, { cwd, env: { ...process.env, AUTOWRITER_UNATTENDED: '' } });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code, output: `${error.stdout}${error.stderr}` };
  }
};

test('the module names one specimen for each human-only command the smoke proves can fail', () => {
  assert.deepEqual(Object.keys(unattendedSpecimens({})).sort(), NAMES);
  assert.deepEqual(
    Object.keys(SPECIMENS)
      .filter((name) => name.startsWith('unattended'))
      .sort(),
    NAMES
  );
});

test('every specimen is an unattended process attempting the command, and its token is the refusal', () => {
  for (const name of NAMES) {
    const specimen = SPECIMENS[name];
    assert.deepEqual(specimen.plantedEnv, { [UNATTENDED_VARIABLE]: '1' }, name);
    assert.match(specimen.token, /^refusing to [a-z -]+$/i, name);
    assert.equal(typeof specimen.plant, 'function', name);
  }
});

test('the three specimens run the seal, the record and the driver', () => {
  assert.equal(SPECIMENS.unattendedSealsDispositions.gate, 'assets:seal');
  assert.equal(SPECIMENS.unattendedWritesLighthouseRecord.gate, 'lh:record');
  assert.equal(SPECIMENS.unattendedRunsTheLighthouseGate.gate, 'gate:lh');
});

async function dispositionsWorld(copy = false) {
  const root = await scratch();
  const site = join(root, 'site');
  await mkdir(join(site, 'dist'), { recursive: true });
  await writeFile(join(site, 'dist', 'gate-routes.json'), JSON.stringify({ routes: [] }));
  await writeFile(
    join(site, 'package.json'),
    JSON.stringify({ scripts: { 'assets:seal': 'node scripts/editorial-gate.mjs . dist --seal' } })
  );
  if (copy) await cp(join(REAL_SITE, 'scripts'), join(site, 'scripts'), { recursive: true });
  else await symlink(join(REAL_SITE, 'scripts'), join(site, 'scripts'));
  await symlink(join(REAL_SITE, 'node_modules'), join(site, 'node_modules'));
  await mkdir(join(root, 'audits/phase-4.7/dispositions'), { recursive: true });
  const sealed = [
    {
      target: TARGET,
      location: 'title',
      status: 'verified',
      reason: 'checked by a person',
      digest: digestFor([], TARGET),
    },
  ];
  await writeFile(join(root, DISPOSITION_FILE), `${JSON.stringify(sealed, null, 2)}\n`);
  return { root, site, file: join(root, DISPOSITION_FILE), sealed: `${JSON.stringify(sealed, null, 2)}\n` };
}

test('the seal specimen plants a stale digest and restores the file exactly', async () => {
  const world = await dispositionsWorld();

  const restore = await SPECIMENS.unattendedSealsDispositions.plant(world.site);
  const planted = await readFile(world.file, 'utf8');
  await restore();

  assert.notEqual(planted, world.sealed);
  assert.equal(await readFile(world.file, 'utf8'), world.sealed);
});

test('the seal family is proven: green for a person, red with the refusal for an unattended process', async () => {
  const world = await dispositionsWorld();

  const result = await proveWithSpecimen(SPECIMENS.unattendedSealsDispositions, { copySite: world.site, run });

  assert.equal(result.ok, true, result.reason);
  assert.equal(await readFile(world.file, 'utf8'), world.sealed);
});

test('a seal that no longer refuses turns the family red, so the family is load-bearing', async () => {
  const world = await dispositionsWorld(true);
  const gate = join(world.site, 'scripts/editorial-gate.mjs');
  const source = await readFile(gate, 'utf8');
  const edited = source
    .replace("exitWhenUnattended('re-seal the dispositions');", '')
    .replace("refuseWhenUnattended('re-seal the dispositions');", '');
  assert.notEqual(edited, source);
  await writeFile(gate, edited);

  const result = await proveWithSpecimen(SPECIMENS.unattendedSealsDispositions, { copySite: world.site, run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green on the specimen/);
});

async function recordWorld(unguarded = false) {
  const work = await scratch();
  const site = unguarded ? join(await scratch(), 'site') : REAL_SITE;
  if (unguarded) {
    await cp(join(REAL_SITE, 'scripts'), join(site, 'scripts'), { recursive: true });
    for (const name of ['package.json', 'budgets.json', 'lighthouserc.cjs', 'engine.config.json'])
      await cp(join(REAL_SITE, name), join(site, name)).catch(() => {});
    const file = join(site, 'scripts/run-lh-evidence.mjs');
    const source = await readFile(file, 'utf8');
    const edited = source.replace("if (mode === 'record') exitWhenUnattended('record the Lighthouse run');", '');
    assert.notEqual(edited, source);
    await writeFile(file, edited);
  }
  return SPECIMENS.unattendedWritesLighthouseRecord.scene({ copySite: site, work });
}

test('the record family is proven on the real scripts: green for a person, red with the refusal for an unattended process', async () => {
  const scene = await recordWorld();

  const result = await proveWithSpecimen(SPECIMENS.unattendedWritesLighthouseRecord, { copySite: scene, run });

  assert.equal(result.ok, true, result.reason);
});

test('a record that no longer refuses turns the family red, so the family is load-bearing', async () => {
  const scene = await recordWorld(true);

  const result = await proveWithSpecimen(SPECIMENS.unattendedWritesLighthouseRecord, { copySite: scene, run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green on the specimen/);
});

test('the record specimen removes the green record and restores it exactly', async () => {
  const scene = await recordWorld();
  const record = join(scene, '..', 'audits', 'lighthouse-green.json');
  await mkdir(join(scene, '..', 'audits'), { recursive: true });
  await writeFile(record, '{"fingerprint":"x"}\n');

  const restore = await SPECIMENS.unattendedWritesLighthouseRecord.plant(scene);
  await assert.rejects(readFile(record, 'utf8'), { code: 'ENOENT' });
  await restore();

  assert.equal(await readFile(record, 'utf8'), '{"fingerprint":"x"}\n');
});
