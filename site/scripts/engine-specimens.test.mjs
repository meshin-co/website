import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';

import { anchorsFor } from './engine-anchors.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { engineSpecimens } from './engine-specimens.mjs';
import { INTERVIEW_PATH } from './interview-coverage.mjs';
import { FAMILIES } from './mutation-smoke.mjs';
import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';

const exec = promisify(execFile);
const REAL_SITE = join(import.meta.dirname, '..');
const REAL_ROOT = join(REAL_SITE, '..');
const NAMES = ['engineAnchorFileRemoved', 'engineClassifierReexpressed', 'engineConfigValueRemoved'];
const GATE = 'gate:engine';
const CONFIG = 'site/engine.config.json';
const WORKFLOW = '.github/workflows/ci.yml';
const WORKFLOWS = '.github/workflows';
const ENV_EXAMPLE = 'site/.env.example';
const REMOVED_ANCHOR = 'docs/CONTENT-GATE.md';

const scenes = [];
afterEach(async () => {
  for (const scene of scenes.splice(0)) await rm(scene, { recursive: true, force: true });
});

const run = async (command, args, cwd) => {
  try {
    const { stdout, stderr } = await exec(command, args, { cwd });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code, output: `${error.stdout}${error.stderr}` };
  }
};

async function world(gateCommand) {
  const root = await mkdtemp(join(tmpdir(), 'engine-specimens-'));
  scenes.push(root);
  const site = join(root, 'site');
  const config = readEngineConfig(join(REAL_SITE, 'engine.config.json'));
  await mkdir(site, { recursive: true });
  for (const directory of config.diff.shippedDirectories) await mkdir(join(root, directory), { recursive: true });
  for (const { path, kind } of anchorsFor(config)) {
    if (kind === 'directory') await mkdir(join(root, path), { recursive: true });
    else {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), '');
    }
  }
  await cp(join(REAL_SITE, 'engine.config.json'), join(root, CONFIG));
  await cp(join(REAL_ROOT, WORKFLOWS), join(root, WORKFLOWS), { recursive: true });
  await cp(join(REAL_ROOT, ENV_EXAMPLE), join(root, ENV_EXAMPLE));
  await cp(join(REAL_ROOT, INTERVIEW_PATH), join(root, INTERVIEW_PATH));
  const command = gateCommand ?? `node ${join(REAL_SITE, 'scripts/check-engine.mjs')} --root ${root}`;
  await writeFile(join(site, 'package.json'), JSON.stringify({ scripts: { [GATE]: command } }));
  return { root, site };
}

const snapshot = async (root) =>
  Promise.all([CONFIG, WORKFLOW, REMOVED_ANCHOR].map((path) => readFile(join(root, path), 'utf8')));

test('the module names one specimen for each guard family gate:engine owns, and the smoke spreads them', () => {
  assert.deepEqual(Object.keys(engineSpecimens({})).sort(), NAMES);
  for (const name of NAMES) assert.equal(Object.hasOwn(SPECIMENS, name), true, name);
});

test('every specimen runs gate:engine and names the finding it expects', () => {
  for (const name of NAMES) {
    assert.equal(SPECIMENS[name].gate, GATE, name);
    assert.match(SPECIMENS[name].token, /^ENGINE [a-z-]+ \S+/, name);
    assert.equal(typeof SPECIMENS[name].plant, 'function', name);
  }
});

test('the smoke manifest holds a family for each specimen', () => {
  const named = FAMILIES.filter((entry) => entry.kind === 'specimen').map((entry) => entry.specimen);
  for (const name of NAMES) assert.equal(named.filter((specimen) => specimen === name).length, 1, name);
});

for (const name of NAMES) {
  test(`${name} turns gate:engine red and the restore turns it green again`, async () => {
    const { root, site } = await world();
    const before = await snapshot(root);
    const green = await run('npm', ['run', GATE], site);
    assert.equal(green.code, 0, green.output);

    const restore = await SPECIMENS[name].plant(site);
    const planted = await run('npm', ['run', GATE], site);
    await restore();

    assert.notEqual(planted.code, 0, planted.output);
    assert.ok(planted.output.includes(SPECIMENS[name].token), planted.output);
    assert.deepEqual(await snapshot(root), before);
    assert.equal((await run('npm', ['run', GATE], site)).code, 0);
  });

  test(`${name} is proven by the smoke's own procedure`, async () => {
    const { site } = await world();

    const result = await proveWithSpecimen(SPECIMENS[name], { copySite: site, run });

    assert.equal(result.ok, true, result.reason);
  });

  test(`a gate:engine that stays green turns the ${name} family red, so the family is load-bearing`, async () => {
    const { site } = await world('node -e 0');

    const result = await proveWithSpecimen(SPECIMENS[name], { copySite: site, run });

    assert.equal(result.ok, false);
    assert.match(result.reason, /stayed green on the specimen/);
  });
}

test('the config specimen removes a required value the finding names with the file', async () => {
  const { root, site } = await world();

  const restore = await SPECIMENS.engineConfigValueRemoved.plant(site);
  const planted = JSON.parse(await readFile(join(root, CONFIG), 'utf8'));
  await restore();

  assert.equal(Object.hasOwn(planted.loop, 'attemptCap'), false);
  assert.match(SPECIMENS.engineConfigValueRemoved.token, /loop\.attemptCap/);
});

test('the anchor specimen removes the content-gate document from the copy and never from the real tree', async () => {
  const { root, site } = await world();

  const restore = await SPECIMENS.engineAnchorFileRemoved.plant(site);
  const gone = await readFile(join(root, REMOVED_ANCHOR), 'utf8').catch(() => null);
  await restore();

  assert.equal(gone, null);
  assert.match(await readFile(join(REAL_ROOT, REMOVED_ANCHOR), 'utf8'), /\S/);
});

test('the classifier specimen replaces the call in the changes job with a shell case', async () => {
  const { root, site } = await world();

  const restore = await SPECIMENS.engineClassifierReexpressed.plant(site);
  const planted = await readFile(join(root, WORKFLOW), 'utf8');
  await restore();

  assert.match(planted, /\bcase\b/);
  assert.equal(planted.includes('run-classify-diff.mjs'), false);
});

test('the real tree is green when the check runs from the repository root', async () => {
  const result = await run('node', ['site/scripts/check-engine.mjs'], REAL_ROOT);

  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /^engine: 0 findings/m);
});
