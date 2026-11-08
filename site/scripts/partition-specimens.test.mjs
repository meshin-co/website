import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { anchorsFor } from './engine-anchors.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { partitionReport } from './engine-partition-gate.mjs';
import { SCENE_FILES, sceneReader } from './fixtures/partition-scene.mjs';
import { INTERVIEW_PATH } from './interview-coverage.mjs';
import { FAMILIES } from './mutation-smoke.mjs';
import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';
import { partitionSpecimens } from './partition-specimens.mjs';

const exec = promisify(execFile);
const REAL_SITE = join(import.meta.dirname, '..');
const REAL_ROOT = join(REAL_SITE, '..');
const COPY_SITE = '/copy/site';
const NAMES = [
  'exportBuildBroken',
  'interviewConfigValueDropped',
  'interviewReusesAQuestionId',
  'interviewWorkflowSecretDropped',
  'partitionAnchorUnserved',
  'partitionFileFitsNoRule',
  'partitionSiteBound',
];
const INTERVIEW_NAMES = ['interviewConfigValueDropped', 'interviewWorkflowSecretDropped', 'interviewReusesAQuestionId'];
const TOKEN_PREFIX = { 'gate:partition': 'PARTITION ', 'gate:export': 'EXPORT ', 'gate:engine': 'ENGINE ' };
const GATE = 'gate:engine';
const CHECK = join(REAL_SITE, 'scripts/check-engine.mjs');
const WORKFLOWS = '.github/workflows';
const ENV_EXAMPLE = 'site/.env.example';
const CONFIG = 'site/engine.config.json';

const scenes = [];
afterEach(async () => {
  for (const scene of scenes.splice(0)) await rm(scene, { recursive: true, force: true });
});

function helpers() {
  const calls = [];
  const restore = (name) => () => name;
  return {
    calls,
    addFile: async (path, content) => (calls.push(['add', path, content]), restore('add')),
    removeFile: async (path) => (calls.push(['remove', path]), restore('remove')),
    editFile: async (path, edit) => (calls.push(['edit', path, edit('---\nbody\n')]), restore('edit')),
  };
}

const printed = ({ findings }) => findings.map(({ rule, where, detail }) => `PARTITION ${rule} ${where}: ${detail}`);

const run = async (command, args, cwd) => {
  try {
    const { stdout, stderr } = await exec(command, args, { cwd });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code, output: `${error.stdout}${error.stderr}` };
  }
};

async function world(gateCommand) {
  const root = await mkdtemp(join(tmpdir(), 'partition-specimens-'));
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
  await cp(join(REAL_ROOT, CONFIG), join(root, CONFIG));
  await cp(join(REAL_ROOT, WORKFLOWS), join(root, WORKFLOWS), { recursive: true });
  await cp(join(REAL_ROOT, ENV_EXAMPLE), join(root, ENV_EXAMPLE));
  await cp(join(REAL_ROOT, INTERVIEW_PATH), join(root, INTERVIEW_PATH));
  const command = gateCommand ?? `node ${CHECK} --root ${root}`;
  await writeFile(join(site, 'package.json'), JSON.stringify({ scripts: { [GATE]: command } }));
  return { root, site };
}

test('the module names one specimen for each guard the partition, the export check and the interview check add', () => {
  const specimens = partitionSpecimens(helpers());
  assert.deepEqual(Object.keys(specimens).sort(), NAMES);
  for (const { gate, token, plant } of Object.values(specimens)) {
    assert.ok(Object.hasOwn(TOKEN_PREFIX, gate), gate);
    assert.ok(token.startsWith(TOKEN_PREFIX[gate]), token);
    assert.equal(typeof plant, 'function');
  }
});

test('each plant changes one file at the repository root or the site, and returns the restore function it was given', async () => {
  const { calls, ...tools } = helpers();
  const specimens = partitionSpecimens({ ...tools });
  const restored = [];
  for (const name of NAMES) restored.push(await specimens[name].plant(COPY_SITE));
  assert.deepEqual(
    calls.map(([kind, path]) => [kind, path]),
    [
      ['edit', '/copy/site/src/pages/styleguide.astro'],
      ['edit', `/copy/${INTERVIEW_PATH}`],
      ['edit', `/copy/${INTERVIEW_PATH}`],
      ['edit', `/copy/${INTERVIEW_PATH}`],
      ['remove', '/copy/seed/site/src/data/tags.mjs.seed'],
      ['add', '/copy/mystery.bin'],
      ['add', '/copy/site/.agents/skills/names-the-site.md'],
    ]
  );
  assert.deepEqual(
    restored.map((restore) => restore()),
    ['edit', 'edit', 'edit', 'edit', 'remove', 'add', 'add']
  );
  assert.ok(calls[6][2].includes(brandFromDisk().name), 'the planted skill names the site');
  assert.match(calls[0][2], /^---\nimport '~\/data\/author\/nobody-here\.md';\nbody\n$/);
});

test('each interview plant deletes every mention of one name from the interview and changes nothing else', async () => {
  const edits = [];
  const specimens = partitionSpecimens({ ...helpers(), editFile: async (_path, edit) => (edits.push(edit), () => {}) });
  await specimens.interviewConfigValueDropped.plant(COPY_SITE);
  await specimens.interviewWorkflowSecretDropped.plant(COPY_SITE);
  const bank = [
    'Set `loop.claimLifetimeDays` and `loop.attemptCap`.',
    'The secrets `AUTOWRITER_PAT` and `AUTOWRITER_OPENAI_API_KEY`.',
    'Again `loop.claimLifetimeDays` and `AUTOWRITER_PAT`.',
  ].join('\n');
  assert.equal(
    edits[0](bank),
    [
      'Set `` and `loop.attemptCap`.',
      'The secrets `AUTOWRITER_PAT` and `AUTOWRITER_OPENAI_API_KEY`.',
      'Again `` and `AUTOWRITER_PAT`.',
    ].join('\n')
  );
  assert.equal(
    edits[1](bank),
    [
      'Set `loop.claimLifetimeDays` and `loop.attemptCap`.',
      'The secrets `` and `AUTOWRITER_OPENAI_API_KEY`.',
      'Again `loop.claimLifetimeDays` and ``.',
    ].join('\n')
  );
});

test('the smoke manifest holds exactly one family for each specimen of the module', () => {
  const named = FAMILIES.filter((entry) => entry.kind === 'specimen').map((entry) => entry.specimen);
  for (const name of NAMES) assert.equal(named.filter((specimen) => specimen === name).length, 1, name);
});

test('the tokens are what the partition prints for a scene with that change', () => {
  const specimens = partitionSpecimens(helpers());
  const stray = printed(partitionReport({ files: [...SCENE_FILES, 'mystery.bin'], read: sceneReader() }));
  assert.ok(
    stray.some((line) => line.includes(specimens.partitionFileFitsNoRule.token)),
    stray.join('\n')
  );
  const files = SCENE_FILES.filter((file) => file !== 'seed/site/src/data/tags.mjs.seed');
  const unserved = printed(partitionReport({ files, read: sceneReader() }));
  assert.ok(
    unserved.some((line) => line.includes(specimens.partitionAnchorUnserved.token)),
    unserved.join('\n')
  );
});

for (const name of INTERVIEW_NAMES) {
  test(`${name} turns gate:engine red with one finding, and the restore turns it green again`, async () => {
    const { root, site } = await world();
    const before = await readFile(join(root, INTERVIEW_PATH), 'utf8');
    const green = await run('node', [CHECK, '--root', root], site);
    assert.equal(green.code, 0, green.output);

    const restore = await SPECIMENS[name].plant(site);
    const planted = await run('node', [CHECK, '--root', root], site);
    await restore();

    assert.notEqual(planted.code, 0, planted.output);
    assert.ok(planted.output.includes(SPECIMENS[name].token), planted.output);
    assert.equal([...planted.output.matchAll(/^ENGINE /gm)].length, 1, planted.output);
    assert.equal(await readFile(join(root, INTERVIEW_PATH), 'utf8'), before);
    assert.equal((await run('node', [CHECK, '--root', root], site)).code, 0);
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
