import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { buildMachineScene, removeScene, runMachine } from './fixtures/machine-scene.mjs';
import { expectedFailures, plantScene } from './fixtures/machine-scene-plants.mjs';
import { parseGateFindings } from './gate-findings.mjs';
import { knownRule, listRows } from './repair-kinds.mjs';

const GATE = 'gate:machine';
const FINDINGS_FILE = 'gate-machine.json';
const VARIANTS = ['absent', 'missing'];
const MACHINE_RULES = [
  'humans-components-missing',
  'humans-component-absent',
  'llms-lists-noindex-page',
  'llms-size',
  'llms-omits-route',
  'llms-lists-inline',
  'llms-file-missing',
  'entry-coverage',
  'sitemap-lists-noindex-route',
  'sitemap-lastmod-missing',
  'sidecar-missing',
  'sidecar-content',
  'canonical-mismatch',
  'date-agreement',
  'empty-collection-surface',
  'hub-feed-link-missing',
  'feed-base-missing',
  'feed-coverage',
  'catalog-route-missing',
  'catalog-description-drift',
  'machine-header',
  'machine-file-unreferenced',
  'llms-corpus',
];

const scenes = [];
const scratches = [];
after(() => {
  for (const scene of scenes) removeScene(scene);
  for (const directory of scratches) rmSync(directory, { recursive: true, force: true });
});

const scratch = () => {
  const directory = mkdtempSync(join(tmpdir(), 'machine-findings-'));
  scratches.push(directory);
  return directory;
};

const sceneOf = async () => {
  const scene = await buildMachineScene();
  scenes.push(scene);
  return scene;
};

async function plantedRun(variant) {
  const scene = await sceneOf();
  plantScene(scene, variant);
  const findingsDir = scratch();
  return { variant, scene, findingsDir, run: runMachine(scene, { findingsDir }) };
}

const runs = { absent: await plantedRun('absent'), missing: await plantedRun('missing') };

const sorted = (rules) => [...new Set(rules)].sort();
const linesOf = (text) => text.split('\n').filter((line) => line !== '');
const findingsFile = (directory) => join(directory, FINDINGS_FILE);

function findingsOf({ findingsDir }) {
  assert.ok(existsSync(findingsFile(findingsDir)), `${FINDINGS_FILE} was not written`);
  return parseGateFindings(readFileSync(findingsFile(findingsDir), 'utf8'));
}

const emittedBy = (variant) => sorted(findingsOf(runs[variant]).findings.map(({ rule }) => rule));
const without = (rule) => sorted(MACHINE_RULES.filter((other) => other !== rule));

const filesNamed = (directory, name) =>
  readdirSync(directory, { recursive: true }).filter((file) => file.endsWith(name));

test('the planted scene fails the gate as it always did, with the same two summary lines on stdout', () => {
  for (const { variant, scene, run } of Object.values(runs)) {
    const counts = [
      `${scene.collections + 1} public collections`,
      `${scene.routes.length - 1} routes`,
      `${scene.catalogEntries} catalog entries`,
      `${scene.datedStaticRoutes} static routes checked for one date`,
    ];

    assert.equal(run.status, 1, `${variant}: ${run.stderr}`);
    assert.equal(
      run.stdout,
      [
        `machine: no live entry in ${[...scene.emptyKinds, 'ghost'].join(', ')}; entry coverage was not checked for it`,
        `machine: ${counts.join(', ')}`,
        '',
      ].join('\n')
    );
  }
});

test('the rule ids the planted scenes emit are exactly the 23 families, and the repairability table knows them', () => {
  const absent = emittedBy('absent');
  const missing = emittedBy('missing');

  assert.equal(MACHINE_RULES.length, 23);
  assert.deepEqual(absent, without('humans-components-missing'));
  assert.deepEqual(missing, without('humans-component-absent'));
  assert.deepEqual(sorted([...absent, ...missing]), sorted(MACHINE_RULES));
  for (const rule of [...absent, ...missing]) assert.ok(knownRule({ gate: GATE, rule }), `the table lacks ${rule}`);
});

test('the repairability table holds a row for every family the gate can emit and for nothing else', () => {
  const rows = listRows().filter((row) => row.gate === GATE);

  assert.deepEqual(sorted(rows.map((row) => row.rule)), sorted(MACHINE_RULES));
});

test('every rule id a call site of machine.mjs writes is a row of the table, and every other site reads one', () => {
  const source = readFileSync(join(import.meta.dirname, 'machine.mjs'), 'utf8');
  const firstArguments = [...source.matchAll(/\bfailures\.(?:add|addAll)\(\s*([^,\s]+)/g)].map((match) => match[1]);
  const written = firstArguments
    .filter((argument) => argument.startsWith("'"))
    .map((argument) => argument.slice(1, -1));
  const read = firstArguments.filter((argument) => !argument.startsWith("'"));
  const readRules = [
    'humans-components-missing',
    'humans-component-absent',
    'catalog-route-missing',
    'catalog-description-drift',
  ];

  assert.deepEqual(read, ['finding.rule', 'finding.rule']);
  assert.deepEqual(sorted(written), sorted(MACHINE_RULES.filter((rule) => !readRules.includes(rule))));
  for (const rule of written) assert.ok(knownRule({ gate: GATE, rule }), `the table lacks ${rule}`);
});

test('each planted failure is recorded under its rule and subjects, and printed on a MACHINE line of its own', () => {
  for (const variant of VARIANTS) {
    const { scene, run } = runs[variant];
    const { findings } = findingsOf(runs[variant]);
    const printed = linesOf(run.stderr);

    for (const { rule, text, subjects } of expectedFailures(scene, variant)) {
      assert.ok(printed.includes(`MACHINE ${text}`), `${variant}: no line for ${text}`);
      const found = findings.filter((finding) => finding.rule === rule && finding.detail === text);
      assert.equal(found.length, 1, `${variant}: ${found.length} records of ${rule} for ${text}`);
      assert.deepEqual(found[0].subjects, subjects, `${variant}: ${text}`);
    }
  }
});

test('the planted scene prints the lines it plants, and no other line', () => {
  for (const variant of VARIANTS) {
    const { scene, run } = runs[variant];
    const planted = expectedFailures(scene, variant).map(({ text }) => `MACHINE ${text}`);

    assert.deepEqual(linesOf(run.stderr).sort(), planted.sort(), variant);
  }
});

test('the printed lines and the recorded findings are the same failures, one for one and in the same order', () => {
  for (const variant of VARIANTS) {
    const printed = linesOf(runs[variant].run.stderr);
    const recorded = findingsOf(runs[variant]).findings.map(({ detail }) => `MACHINE ${detail}`);

    assert.notEqual(printed.length, 0, `${variant} printed nothing`);
    assert.deepEqual(printed, recorded);
  }
});

test('the findings file is the document the repair loop reads: this gate, no excerpt, subjects as built paths', () => {
  for (const variant of VARIANTS) {
    const document = findingsOf(runs[variant]);

    assert.equal(document.gate, GATE);
    for (const finding of document.findings) {
      assert.equal(finding.excerpt, '');
      for (const subject of finding.subjects) assert.match(subject, /^\/\S*$/, finding.detail);
    }
  }
});

test('without GATE_FINDINGS_DIR, or with a blank one, the gate writes no file and prints and exits as before', () => {
  const { scene, run: recorded } = runs.absent;

  for (const env of [{}, { GATE_FINDINGS_DIR: '   ' }]) {
    const run = runMachine(scene, { env });

    assert.equal(run.status, 1);
    assert.equal(run.stderr, recorded.stderr);
    assert.equal(run.stdout, recorded.stdout);
    assert.deepEqual(filesNamed(scene.root, FINDINGS_FILE), []);
  }
});

test('a failing run replaces the findings an earlier run left, and leaves the files of the other gates', () => {
  const { scene } = runs.absent;
  const directory = scratch();
  writeFileSync(findingsFile(directory), 'stale');
  writeFileSync(join(directory, 'gate-content.json'), 'the content gate');

  const run = runMachine(scene, { findingsDir: directory });

  assert.equal(run.status, 1);
  assert.notEqual(readFileSync(findingsFile(directory), 'utf8'), 'stale');
  assert.deepEqual(findingsOf({ findingsDir: directory }), findingsOf(runs.absent));
  assert.equal(readFileSync(join(directory, 'gate-content.json'), 'utf8'), 'the content gate');
});

test('a clean scene exits 0 and removes the findings an earlier run left, and leaves the other gates', async () => {
  const scene = await sceneOf();
  const directory = scratch();
  writeFileSync(findingsFile(directory), 'stale');
  writeFileSync(join(directory, 'gate-content.json'), 'the content gate');

  const run = runMachine(scene, { findingsDir: directory });

  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, '');
  assert.equal(existsSync(findingsFile(directory)), false);
  assert.equal(readFileSync(join(directory, 'gate-content.json'), 'utf8'), 'the content gate');
});

test('a clean scene does not create a findings directory that does not exist', async () => {
  const scene = await sceneOf();
  const directory = join(scratch(), 'not-yet');

  const run = runMachine(scene, { findingsDir: directory });

  assert.equal(run.status, 0, run.stderr);
  assert.equal(existsSync(directory), false);
});

test('a relative GATE_FINDINGS_DIR stops the gate after its failures are printed, and writes nothing', () => {
  const { scene, run: recorded } = runs.absent;

  const run = runMachine(scene, { findingsDir: 'relative/findings' });

  assert.equal(run.status, 1);
  assert.ok(run.stderr.startsWith(recorded.stderr), 'the failures are printed before the gate stops');
  assert.match(run.stderr, /GATE_FINDINGS_DIR must be an absolute path/);
  assert.equal(existsSync(join(scene.site, 'relative')), false);
});

test('a relative GATE_FINDINGS_DIR stops a clean gate too, so a misconfigured job cannot pass', async () => {
  const scene = await sceneOf();

  const run = runMachine(scene, { findingsDir: 'relative/findings' });

  assert.equal(run.status, 1);
  assert.match(run.stderr, /GATE_FINDINGS_DIR must be an absolute path/);
});
