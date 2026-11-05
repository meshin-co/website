import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';

import { FAMILIES } from './mutation-smoke.mjs';
import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';
import { scheduleSpecimens } from './schedule-specimens.mjs';

const exec = promisify(execFile);
const REAL_SITE = join(import.meta.dirname, '..');
const REAL_ROOT = join(REAL_SITE, '..');
const NAME = 'scheduleCronHandEdited';
const GATE = 'gate:schedule';
const CONFIG = 'site/engine.config.json';
const WORKFLOW = '.github/workflows/write-daily.yml';
const CRON = /^ {4}- cron: '(\d+) (\d+) \* \* \*'$/gm;
const CATCH_UP_SPECIMENS = [
  {
    name: 'scheduleCatchUpHandWritten',
    id: 'write-schedule-catch-up-hand-written',
    token: 'SCHEDULE cron-extra .github/workflows/write-daily.yml',
    change: (before, after) =>
      after.length - before.length === 1 && after.every((line) => line === '47 21' || before.includes(line)),
  },
  {
    name: 'scheduleCatchUpRemoved',
    id: 'write-schedule-catch-up-removed',
    token: 'SCHEDULE cron-missing .github/workflows/write-daily.yml',
    change: (before, after) => before.length - after.length === 1 && after.every((line) => before.includes(line)),
  },
];
const minuteHour = (line) => /'(\d+) (\d+)/.exec(line).slice(1, 3).join(' ');

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
  const root = await mkdtemp(join(tmpdir(), 'schedule-specimens-'));
  scenes.push(root);
  const site = join(root, 'site');
  await mkdir(site, { recursive: true });
  await mkdir(join(root, '.github', 'workflows'), { recursive: true });
  await cp(join(REAL_SITE, 'engine.config.json'), join(root, CONFIG));
  await cp(join(REAL_ROOT, WORKFLOW), join(root, WORKFLOW));
  const command = gateCommand ?? `node ${join(REAL_SITE, 'scripts/schedule-gate.mjs')} --root ${root}`;
  await writeFile(join(site, 'package.json'), JSON.stringify({ scripts: { [GATE]: command } }));
  return { root, site };
}

const cronLines = async (root) =>
  [...(await readFile(join(root, WORKFLOW), 'utf8')).matchAll(CRON)].map(([line]) => line);

test('the module names one specimen for the schedule gate, and the smoke spreads it', () => {
  assert.deepEqual(Object.keys(scheduleSpecimens({})), [NAME, ...CATCH_UP_SPECIMENS.map(({ name }) => name)]);
  assert.equal(Object.hasOwn(SPECIMENS, NAME), true);
});

test('the specimen runs gate:schedule and names the finding it expects, with the file the gate guards', () => {
  assert.equal(SPECIMENS[NAME].gate, GATE);
  assert.match(SPECIMENS[NAME].token, /^SCHEDULE cron-differs \.github\/workflows\/write-daily\.yml/);
  assert.equal(typeof SPECIMENS[NAME].plant, 'function');
});

test('the smoke manifest holds one family for the specimen, named for the hand edit', () => {
  const rows = FAMILIES.filter((entry) => entry.kind === 'specimen' && entry.specimen === NAME);
  assert.deepEqual(rows, [{ id: 'write-schedule-hand-edited', kind: 'specimen', specimen: NAME }]);
});

test('the specimen edits one cron line of the copy, and the restore puts the whole file back', async () => {
  const { root, site } = await world();
  const before = await readFile(join(root, WORKFLOW), 'utf8');
  const lines = await cronLines(root);
  assert.ok(lines.length > 0);

  const restore = await SPECIMENS[NAME].plant(site);
  const planted = await cronLines(root);
  assert.equal(planted.length, lines.length);
  assert.equal(planted.filter((line, at) => line !== lines[at]).length, 1);
  await restore();

  assert.equal(await readFile(join(root, WORKFLOW), 'utf8'), before);
});

test('the specimen turns gate:schedule red with its finding, and the restore turns it green again', async () => {
  const { root, site } = await world();
  const green = await run('npm', ['run', GATE], site);
  assert.equal(green.code, 0, green.output);

  const restore = await SPECIMENS[NAME].plant(site);
  const planted = await run('npm', ['run', GATE], site);
  await restore();

  assert.notEqual(planted.code, 0, planted.output);
  assert.ok(planted.output.includes(SPECIMENS[NAME].token), planted.output);
  assert.ok(planted.output.includes('npm run assets:schedule'), planted.output);
  assert.equal((await run('npm', ['run', GATE], site)).code, 0);
  assert.equal(root.length > 0, true);
});

test('the specimen is proven by the smoke own procedure', async () => {
  const { site } = await world();

  const result = await proveWithSpecimen(SPECIMENS[NAME], { copySite: site, run });

  assert.equal(result.ok, true, result.reason);
});

test('a gate:schedule that stays green turns the family red, so the family is load-bearing', async () => {
  const { site } = await world('node -e 0');

  const result = await proveWithSpecimen(SPECIMENS[NAME], { copySite: site, run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green on the specimen/);
});

for (const { name, id, token, change } of CATCH_UP_SPECIMENS) {
  test(`${name} names the finding ${token} and has one smoke family called ${id}`, () => {
    assert.equal(SPECIMENS[name].gate, GATE);
    assert.ok(SPECIMENS[name].token.startsWith(token));
    assert.deepEqual(
      FAMILIES.filter((entry) => entry.kind === 'specimen' && entry.specimen === name),
      [{ id, kind: 'specimen', specimen: name }]
    );
  });

  test(`${name} changes the cron list by the one line a hand edit of the catch-up would, and the restore puts the file back`, async () => {
    const { root, site } = await world();
    const before = await readFile(join(root, WORKFLOW), 'utf8');
    const lines = (await cronLines(root)).map(minuteHour);
    const restore = await SPECIMENS[name].plant(site);
    const planted = (await cronLines(root)).map(minuteHour);
    assert.equal(change(lines, planted), true, `${lines.join(', ')} became ${planted.join(', ')}`);
    await restore();
    assert.equal(await readFile(join(root, WORKFLOW), 'utf8'), before);
  });

  test(`${name} turns gate:schedule red with its finding, green again once restored, and the smoke procedure proves it`, async () => {
    const { site } = await world();
    assert.equal((await run('npm', ['run', GATE], site)).code, 0);
    const restore = await SPECIMENS[name].plant(site);
    const planted = await run('npm', ['run', GATE], site);
    await restore();
    assert.notEqual(planted.code, 0, planted.output);
    assert.ok(planted.output.includes(token), planted.output);
    assert.equal((await run('npm', ['run', GATE], site)).code, 0);
    const proof = await proveWithSpecimen(SPECIMENS[name], { copySite: site, run });
    assert.equal(proof.ok, true, proof.reason);
  });
}
