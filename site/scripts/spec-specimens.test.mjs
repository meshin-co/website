import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { builtByteFiles } from './spec-gate.mjs';
import { SPEC_SPECIMENS, SPEC_TREE_RANGE, WHOLE_TREE_RANGE } from './spec-specimens.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const CAPABILITY = 'governance/doc-honesty';

const scratchCopy = () => {
  const repo = mkdtempSync(join(tmpdir(), 'spec-specimens-test-'));
  cpSync(join(REPO, 'openspec'), join(repo, 'openspec'), { recursive: true });
  mkdirSync(join(repo, 'site'));
  symlinkSync(join(REPO, 'site', 'scripts'), join(repo, 'site', 'scripts'));
  return { repo, copySite: join(repo, 'site') };
};

const entriesUnder = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    const name = relative(base, path);
    return entry.isDirectory() ? [[`${name}/`, ''], ...entriesUnder(path, base)] : [[name, readFileSync(path, 'utf8')]];
  });

const specTree = (repo) => Object.fromEntries(entriesUnder(join(repo, 'openspec')));
const read = (repo, path) => readFileSync(join(repo, 'openspec', path), 'utf8');
const changedFiles = (range) =>
  execFileSync('git', ['diff', '--name-only', range], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);

test('every gate:spec specimen reads a diff of fixed git objects, so what the copy holds uncommitted cannot decide the pristine run', () => {
  assert.ok(Object.keys(SPEC_SPECIMENS).length > 0);
  for (const [name, specimen] of Object.entries(SPEC_SPECIMENS)) {
    assert.equal(specimen.gate, 'gate:spec', `${name} does not run gate:spec`);
    assert.ok(
      [SPEC_TREE_RANGE, WHOLE_TREE_RANGE].includes(specimen.env?.SPEC_GATE_RANGE),
      `${name} leaves SPEC_GATE_RANGE to the copy's own git state`
    );
  }
});

test('only the calibration specimen puts the built-byte surface in range, so no other rule shares its red with the calibration rule', () => {
  const specTreeFiles = changedFiles(SPEC_TREE_RANGE);
  assert.ok(specTreeFiles.length > 0, 'an empty range reds every pristine run with calibration-input-empty');
  assert.deepEqual(builtByteFiles(specTreeFiles), []);
  assert.ok(builtByteFiles(changedFiles(WHOLE_TREE_RANGE)).length > 0);
  const wholeTree = Object.entries(SPEC_SPECIMENS).filter(
    ([, specimen]) => specimen.env.SPEC_GATE_RANGE === WHOLE_TREE_RANGE
  );
  assert.deepEqual(
    wholeTree.map(([name]) => name),
    ['changeOwingCalibration']
  );
});

test('every gate:spec plant changes the spec tree, and its restorer puts back every file and folder', async () => {
  const { repo, copySite } = scratchCopy();
  try {
    const pristine = specTree(repo);
    for (const [name, specimen] of Object.entries(SPEC_SPECIMENS)) {
      const restore = await specimen.plant(copySite);
      assert.notDeepEqual(specTree(repo), pristine, `${name} planted nothing`);
      await restore();
      assert.deepEqual(specTree(repo), pristine, `${name} left the spec tree changed`);
      assert.equal(existsSync(join(repo, 'openspec.specimen-aside')), false, `${name} left its saved tree behind`);
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a plant whose anchor has drifted fails loud and leaves the spec tree as it was', async () => {
  const { repo, copySite } = scratchCopy();
  try {
    writeFileSync(join(repo, 'openspec/specs', CAPABILITY, 'spec.md'), '# A spec with no requirement left\n');
    const before = specTree(repo);
    await assert.rejects(SPEC_SPECIMENS.specScenarioMissing.plant(copySite), /changed nothing/);
    assert.deepEqual(specTree(repo), before);
    assert.equal(existsSync(join(repo, 'openspec.specimen-aside')), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('the plants that reshape the tree regenerate what a contributor would, so only the rule under test is left to catch them', async () => {
  const { repo, copySite } = scratchCopy();
  try {
    const census = read(repo, 'CENSUS.json');

    const restoreHidden = await SPEC_SPECIMENS.specHiddenFromValidator.plant(copySite);
    assert.ok(Object.hasOwn(JSON.parse(read(repo, 'CENSUS.json')), '.zz-specimen'));
    assert.match(read(repo, 'INDEX.md'), /^- \[\.zz-specimen\]/m);
    await restoreHidden();

    const restoreEmptied = await SPEC_SPECIMENS.specValidatorSawNothing.plant(copySite);
    assert.deepEqual(JSON.parse(read(repo, 'CENSUS.json')), {});
    assert.deepEqual(readdirSync(join(repo, 'openspec/specs')), []);
    await restoreEmptied();

    const restoreDeleted = await SPEC_SPECIMENS.specCapabilityDeleted.plant(copySite);
    assert.equal(read(repo, 'CENSUS.json'), census);
    assert.equal(existsSync(join(repo, 'openspec/specs', CAPABILITY)), false);
    assert.doesNotMatch(read(repo, 'INDEX.md'), new RegExp(`\\[${CAPABILITY}\\]`));
    await restoreDeleted();
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
