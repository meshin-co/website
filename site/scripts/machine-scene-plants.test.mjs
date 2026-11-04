import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { buildMachineScene, removeScene } from './fixtures/machine-scene.mjs';
import { PLANTS, expectedFailures, plantScene, plantsOf } from './fixtures/machine-scene-plants.mjs';
import { knownRule, listRows } from './repair-kinds.mjs';

const GATE = 'gate:machine';
const VARIANTS = ['absent', 'missing'];
const RULE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const BUILT_PATH = /^\/\S*$/;
const TABLE = listRows()
  .filter((row) => row.gate === GATE)
  .map((row) => row.rule)
  .sort();

const scenes = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) removeScene(scene);
});

const plantedScene = async (variant) => {
  const scene = await buildMachineScene();
  scenes.push(scene);
  plantScene(scene, variant);
  return scene;
};

const expectedOf = async (variant) => expectedFailures(await plantedScene(variant), variant);
const rulesOf = (failures) => [...new Set(failures.map(({ rule }) => rule))].sort();

test('the table holds 24 machine rules, and each variant of the scene plants all of them but its twin', async () => {
  assert.equal(TABLE.length, 24);

  const absent = rulesOf(await expectedOf('absent'));
  const missing = rulesOf(await expectedOf('missing'));

  assert.deepEqual(
    absent,
    TABLE.filter((rule) => rule !== 'humans-components-missing')
  );
  assert.deepEqual(
    missing,
    TABLE.filter((rule) => rule !== 'humans-component-absent')
  );
  assert.deepEqual([...new Set([...absent, ...missing])].sort(), TABLE);
});

test('the variants differ only in the one plant that writes humans.txt', () => {
  const shared = PLANTS.filter((entry) => entry.variant === undefined);

  for (const variant of VARIANTS) {
    const own = plantsOf(variant).filter((entry) => entry.variant !== undefined);
    assert.deepEqual(
      own.map((entry) => entry.variant),
      [variant]
    );
    assert.deepEqual(
      plantsOf(variant).filter((entry) => entry.variant === undefined),
      shared
    );
  }
  assert.equal(PLANTS.length, shared.length + VARIANTS.length);
});

test('every expected failure carries a rule the table knows, its text and subjects that are built paths', async () => {
  for (const variant of VARIANTS) {
    const failures = await expectedOf(variant);
    assert.ok(failures.length >= 51, `${variant} expects ${failures.length} failures`);
    for (const { rule, text, subjects } of failures) {
      assert.match(rule, RULE_ID);
      assert.ok(knownRule({ gate: GATE, rule }), `the table does not know ${rule}`);
      assert.ok(typeof text === 'string' && text.trim() === text && text !== '', `${rule} has the text ${text}`);
      assert.ok(Array.isArray(subjects), `${rule} has no subjects list`);
      for (const subject of subjects) assert.match(subject, BUILT_PATH, `${rule}: ${subject}`);
      assert.equal(new Set(subjects).size, subjects.length, `${rule} repeats a subject`);
    }
  }
});

test('no two planted failures are the same line, so each plant is proven on its own', async () => {
  for (const variant of VARIANTS) {
    const keys = (await expectedOf(variant)).map(({ rule, text }) => `${rule}: ${text}`);
    assert.ok(keys.length >= 51, `${variant} plants ${keys.length} failures`);
    assert.deepEqual(keys, [...new Set(keys)]);
  }
});

test('every plant has a name of its own, a plant and a list of what it must trip', () => {
  const names = PLANTS.map((entry) => entry.name);

  assert.ok(names.length >= 34, `the scene holds ${names.length} plants`);
  assert.equal(new Set(names).size, names.length);
  for (const entry of PLANTS) {
    assert.ok(typeof entry.name === 'string' && entry.name.length > 10, String(entry.name));
    assert.equal(typeof entry.plant, 'function', entry.name);
    assert.equal(typeof entry.expected, 'function', entry.name);
  }
});
