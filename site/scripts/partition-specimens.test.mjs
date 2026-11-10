import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { anchorsFor } from './engine-anchors.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { VOCABULARY_FILES, identityOf, identityTermIn } from './engine-partition-facts.mjs';
import { partitionReport } from './engine-partition-gate.mjs';
import { SCENE_FILES, SCENE_TEXT, sceneReader } from './fixtures/partition-scene.mjs';
import { INTERVIEW_PATH } from './interview-coverage.mjs';
import { FAMILIES } from './mutation-smoke.mjs';
import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';
import { partitionSpecimens } from './partition-specimens.mjs';

const exec = promisify(execFile);
const REAL_SITE = join(import.meta.dirname, '..');
const REAL_ROOT = join(REAL_SITE, '..');
const COPY_SITE = '/copy/site';
const OWNER_WORD_NAME = 'partitionOwnerWordIsVocabulary';
const NAMES = [
  'exportBuildBroken',
  'interviewConfigValueDropped',
  'interviewReusesAQuestionId',
  'interviewWorkflowSecretDropped',
  'partitionAnchorUnserved',
  'partitionFileFitsNoRule',
  'partitionMarkedSkillNamedDocumentStays',
  OWNER_WORD_NAME,
  'partitionSiteBound',
  'partitionSkillNamedDocumentTravels',
];
const LISTING_NAMES = ['partitionMarkedSkillNamedDocumentStays', 'partitionSkillNamedDocumentTravels'];
const ONE_FILE_NAMES = NAMES.filter((name) => !LISTING_NAMES.includes(name) && name !== OWNER_WORD_NAME);
const INTERVIEW_NAMES = ['interviewConfigValueDropped', 'interviewWorkflowSecretDropped', 'interviewReusesAQuestionId'];
const TOKEN_PREFIX = { 'gate:partition': 'PARTITION ', 'gate:export': 'EXPORT ', 'gate:engine': 'ENGINE ' };
const LISTED = /^(?:engine|site|evidence) [a-z-]+ \S+$/;
const PARTITION_RUNNER = join(REAL_SITE, 'scripts/run-partition-gate.mjs');
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

const readReal = (path) => {
  try {
    return readFileSync(join(REAL_ROOT, path), 'utf8');
  } catch {
    return null;
  }
};
const REAL_IDENTITY = identityOf(readReal);
const SCENE_IDENTITY = identityOf((path) => SCENE_TEXT[path] ?? null);

async function listingScene(commandOf = (root) => `node ${PARTITION_RUNNER} --root ${root}`, extra = {}) {
  const root = await mkdtemp(join(tmpdir(), 'partition-listing-'));
  scenes.push(root);
  const texts = { ...SCENE_TEXT, ...extra };
  for (const file of [...SCENE_FILES, ...Object.keys(extra)]) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), texts[file] ?? '');
  }
  const { scripts } = JSON.parse(SCENE_TEXT['site/package.json']);
  const manifest = { scripts: { ...scripts, 'gate:partition': commandOf(root) } };
  await writeFile(join(root, 'site/package.json'), JSON.stringify(manifest));
  await run('git', ['init', '-q'], root);
  await run('git', ['add', '-A'], root);
  return { root, site: join(root, 'site') };
}

const listing = (root) => run('node', [PARTITION_RUNNER, '--root', root, '--list'], root);

async function runnerWith(file, change) {
  const directory = await mkdtemp(join(tmpdir(), 'partition-regressed-'));
  scenes.push(directory);
  const scripts = (await readdir(join(REAL_SITE, 'scripts'))).filter(
    (name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs')
  );
  for (const name of scripts) await cp(join(REAL_SITE, 'scripts', name), join(directory, name));
  const text = await readFile(join(directory, file), 'utf8');
  const regressed = change(text);
  assert.notEqual(regressed, text, `${file} holds nothing for the regression to remove`);
  await writeFile(join(directory, file), regressed);
  return join(directory, 'run-partition-gate.mjs');
}

const REGRESSIONS = {
  partitionSkillNamedDocumentTravels: [
    'engine-partition-facts.mjs',
    (text) => text.replace(/\s*\|\|\s*isSkill\(file\)/, ''),
  ],
  partitionMarkedSkillNamedDocumentStays: [
    'engine-partition.mjs',
    (text) => text.replace(' && !isSiteMarked(file)', ''),
  ],
  [OWNER_WORD_NAME]: [
    'engine-partition-facts.mjs',
    (text) => text.replace(/\s*>=\s*VOCABULARY_FILES/, ' >= Number.POSITIVE_INFINITY'),
  ],
};

test('the module names one specimen for each guard the partition, the export check and the interview check add, and one for each way a skill carries a document', () => {
  const specimens = partitionSpecimens(helpers());
  assert.deepEqual(Object.keys(specimens).sort(), NAMES);
  for (const { gate, token, plant, args } of Object.values(specimens)) {
    assert.ok(Object.hasOwn(TOKEN_PREFIX, gate), gate);
    assert.ok(args?.includes('--list') ? LISTED.test(token) : token.startsWith(TOKEN_PREFIX[gate]), token);
    assert.equal(typeof plant, 'function');
  }
});

test('each plant changes one file at the repository root or the site, and returns the restore function it was given', async () => {
  const { calls, ...tools } = helpers();
  const specimens = partitionSpecimens({ ...tools });
  const restored = [];
  for (const name of ONE_FILE_NAMES) restored.push(await specimens[name].plant(COPY_SITE));
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

test('a listing plant adds a document and the skill that names it, names no site, and one restore undoes both in reverse', async () => {
  const events = [];
  const specimens = partitionSpecimens({
    addFile: async (path, content) => {
      events.push(['add', path, content]);
      return async () => events.push(['undo', path]);
    },
    removeFile: async () => assert.fail('a listing plant never removes a file'),
    editFile: async () => assert.fail('a listing plant never edits a file'),
  });
  const restores = [];
  for (const name of LISTING_NAMES) restores.push(await specimens[name].plant(COPY_SITE));

  assert.deepEqual(
    events.map(([kind, path]) => [kind, path]),
    [
      ['add', '/copy/docs/zz-specimen-record.md'],
      ['add', '/copy/site/.agents/skills/zz-specimen-record.site.md'],
      ['add', '/copy/docs/zz-specimen-procedure.md'],
      ['add', '/copy/site/.agents/skills/zz-specimen-procedure.md'],
    ]
  );
  for (const [, , text] of events) {
    for (const identity of [REAL_IDENTITY, SCENE_IDENTITY]) assert.equal(identityTermIn(text, identity), null, text);
  }
  assert.ok(events[1][2].includes('docs/zz-specimen-record.md'));
  assert.ok(events[3][2].includes('docs/zz-specimen-procedure.md'));

  events.length = 0;
  await restores[0]();
  assert.deepEqual(events, [
    ['undo', '/copy/site/.agents/skills/zz-specimen-record.site.md'],
    ['undo', '/copy/docs/zz-specimen-record.md'],
  ]);
});

test('no script of the engine spells the path of a document a listing plant adds, because a script that names the document would carry it whatever the skill says', async () => {
  const planted = [];
  const specimens = partitionSpecimens({
    addFile: async (path) => {
      planted.push(path);
      return async () => {};
    },
    removeFile: async () => assert.fail('a listing plant never removes a file'),
    editFile: async () => assert.fail('a listing plant never edits a file'),
  });
  for (const name of LISTING_NAMES) await specimens[name].plant(COPY_SITE);
  const documents = planted.filter((path) => path.startsWith('/copy/docs/')).map((path) => path.slice('/copy/'.length));
  assert.equal(documents.length, LISTING_NAMES.length);

  const scripts = (await readdir(join(REAL_SITE, 'scripts'))).filter(
    (name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs')
  );
  for (const script of scripts) {
    const text = await readFile(join(REAL_SITE, 'scripts', script), 'utf8');
    for (const document of documents) assert.equal(text.includes(document), false, `${script} spells ${document}`);
  }
});

test('a listing plant whose skill cannot be added removes the document it had added, so no later family meets it', async () => {
  const events = [];
  let added = 0;
  const specimens = partitionSpecimens({
    addFile: async (path) => {
      events.push(['add', path]);
      added += 1;
      if (added === 2) throw new Error('git refused the skill');
      return async () => events.push(['undo', path]);
    },
    removeFile: async () => assert.fail('a listing plant never removes a file'),
    editFile: async () => assert.fail('a listing plant never edits a file'),
  });

  await assert.rejects(specimens.partitionSkillNamedDocumentTravels.plant(COPY_SITE), /git refused the skill/);

  assert.deepEqual(events, [
    ['add', '/copy/docs/zz-specimen-procedure.md'],
    ['add', '/copy/site/.agents/skills/zz-specimen-procedure.md'],
    ['undo', '/copy/docs/zz-specimen-procedure.md'],
  ]);
});

for (const name of LISTING_NAMES) {
  test(`${name} puts its token in the partition listing as a line of its own, and the restore takes it out again`, async () => {
    const { root, site } = await listingScene();
    const { token } = SPECIMENS[name];
    const green = await listing(root);
    assert.equal(green.code, 0, green.output);
    assert.equal(green.output.includes(token), false);

    const restore = await SPECIMENS[name].plant(site);
    const planted = await listing(root);
    await restore();

    assert.equal(planted.code, 0, planted.output);
    assert.ok(planted.output.split('\n').includes(token), planted.output);
    assert.equal((await listing(root)).output.includes(token), false);
  });

  test(`${name} is proven by the smoke's own procedure`, async () => {
    const { site } = await listingScene();

    const result = await proveWithSpecimen(SPECIMENS[name], { copySite: site, run });

    assert.equal(result.ok, true, result.reason);
  });

  test(`a partition that lists nothing turns the ${name} family red, so the family is load-bearing`, async () => {
    const { site } = await listingScene(() => 'node -e 0 --');

    const result = await proveWithSpecimen(SPECIMENS[name], { copySite: site, run });

    assert.equal(result.ok, false);
    assert.match(result.reason, /stayed silent on the specimen/);
  });

  test(`a partition that has lost the behaviour turns the ${name} family red`, async () => {
    const regressed = await runnerWith(...REGRESSIONS[name]);
    const { site } = await listingScene((root) => `node ${regressed} --root ${root}`);

    const result = await proveWithSpecimen(SPECIMENS[name], { copySite: site, run });

    assert.equal(result.ok, false);
    assert.match(result.reason, /stayed silent on the specimen/);
  });
}

const OWNER_WORD_CROWD = Object.fromEntries(
  Array.from({ length: VOCABULARY_FILES }, (_, index) => [
    `site/scripts/uses-index-${index}.mjs`,
    "export const note = 'the index of it';\n",
  ])
);
const SCENE_AUTHOR = 'site/src/data/author/ada.md';

async function ownerWordPlant(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'partition-owner-'));
  scenes.push(root);
  await mkdir(join(root, 'site'), { recursive: true });
  await writeFile(join(root, 'site/engine.config.json'), SCENE_TEXT['site/engine.config.json']);
  const events = [];
  const undo = (path) => async () => events.push(['undo', path]);
  const specimens = partitionSpecimens({
    addFile: async (path, content) => (events.push(['add', path, content]), undo(path)),
    removeFile: async () => assert.fail('the owner-word plant never removes a file'),
    editFile: async (path, edit) => (events.push(['edit', path, edit(SCENE_TEXT[SCENE_AUTHOR])]), undo(path)),
    ...overrides,
  });
  return { root, events, plant: specimens[OWNER_WORD_NAME].plant, undo };
}

test('the owner-word plant adds a word to the author name of the copy, then a document that uses the word and the skill that names it', async () => {
  const { root, events, plant } = await ownerWordPlant();

  await plant(join(root, 'site'));

  assert.deepEqual(
    events.map(([kind, path]) => [kind, path]),
    [
      ['edit', join(root, SCENE_AUTHOR)],
      ['add', join(root, 'docs/zz-specimen-vocabulary.md')],
      ['add', join(root, 'site/.agents/skills/zz-specimen-vocabulary.md')],
    ]
  );
  assert.equal(events[0][2], '---\nname: Ada Lovelace Index\n---\n');
  assert.match(events[1][2], /\bindex\b/);
  for (const identity of [REAL_IDENTITY, SCENE_IDENTITY]) assert.equal(identityTermIn(events[1][2], identity), null);
});

test('one restore of the owner-word plant undoes the skill, the document and the author name in reverse', async () => {
  const { root, events, plant } = await ownerWordPlant();
  const restore = await plant(join(root, 'site'));
  events.length = 0;

  await restore();

  assert.deepEqual(events, [
    ['undo', join(root, 'site/.agents/skills/zz-specimen-vocabulary.md')],
    ['undo', join(root, 'docs/zz-specimen-vocabulary.md')],
    ['undo', join(root, SCENE_AUTHOR)],
  ]);
});

test('an owner-word plant whose document cannot be added gives the author name back, so no later family meets it', async () => {
  const events = [];
  const { root, plant } = await ownerWordPlant({
    addFile: async () => assert.fail('git refused the document'),
    editFile: async (path) => (events.push(['edit', path]), async () => events.push(['undo', path])),
  });

  await assert.rejects(plant(join(root, 'site')), /git refused the document/);

  assert.deepEqual(events, [
    ['edit', join(root, SCENE_AUTHOR)],
    ['undo', join(root, SCENE_AUTHOR)],
  ]);
});

test(`${OWNER_WORD_NAME} puts its token in the partition listing as a line of its own, and the restore takes it out again`, async () => {
  const { root, site } = await listingScene(undefined, OWNER_WORD_CROWD);
  const { token } = SPECIMENS[OWNER_WORD_NAME];
  const green = await listing(root);
  assert.equal(green.code, 0, green.output);
  assert.equal(green.output.includes(token), false);

  const restore = await SPECIMENS[OWNER_WORD_NAME].plant(site);
  const planted = await listing(root);
  await restore();

  assert.equal(planted.code, 0, planted.output);
  assert.ok(planted.output.split('\n').includes(token), planted.output);
  assert.equal((await listing(root)).output.includes(token), false);
});

test(`${OWNER_WORD_NAME} is proven by the smoke's own procedure`, async () => {
  const { site } = await listingScene(undefined, OWNER_WORD_CROWD);

  const result = await proveWithSpecimen(SPECIMENS[OWNER_WORD_NAME], { copySite: site, run });

  assert.equal(result.ok, true, result.reason);
});

test(`a partition that lists nothing turns the ${OWNER_WORD_NAME} family red, so the family is load-bearing`, async () => {
  const { site } = await listingScene(() => 'node -e 0 --', OWNER_WORD_CROWD);

  const result = await proveWithSpecimen(SPECIMENS[OWNER_WORD_NAME], { copySite: site, run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed silent on the specimen/);
});

test(`a partition that counts no word as vocabulary turns the ${OWNER_WORD_NAME} family red`, async () => {
  const regressed = await runnerWith(...REGRESSIONS[OWNER_WORD_NAME]);
  const { site } = await listingScene((root) => `node ${regressed} --root ${root}`, OWNER_WORD_CROWD);

  const result = await proveWithSpecimen(SPECIMENS[OWNER_WORD_NAME], { copySite: site, run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /refused the specimen/);
});
