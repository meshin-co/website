import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { after as afterAll, test } from 'node:test';

import { engineScene, importClosure } from './fixtures/engine-scene.mjs';

const scenes = [];
afterAll(() => scenes.forEach((scene) => scene.remove()));
const sceneOf = (options) => {
  const scene = engineScene(options);
  scenes.push(scene);
  return scene;
};

test('the import closure of the classifier is the loader and what it needs, and nothing from npm', () => {
  assert.deepEqual(importClosure(['site/scripts/build-surface.mjs']), [
    'site/scripts/autowriter-records.mjs',
    'site/scripts/build-surface.mjs',
    'site/scripts/engine-config-checks.mjs',
    'site/scripts/engine-config.mjs',
    'site/scripts/json-schema.mjs',
  ]);
});

test('a scene reads the configuration it was given, so a consumer can be proven live', () => {
  const scene = sceneOf({
    entries: ['site/scripts/build-surface.mjs'],
    mutate: (config) => {
      config.diff.proseDirectories.push('notes/');
      return config;
    },
  });
  assert.deepEqual(
    scene.evaluate('site/scripts/build-surface.mjs', 'm.DEFAULT_RULES.proseDirectories').at(-1),
    'notes/'
  );
  assert.equal(scene.evaluate('site/scripts/build-surface.mjs', "m.classifyPath('notes/a.bin')"), 'prose');
});

test("a scene whose configuration is broken fails naming the scene's own file and the field", () => {
  const scene = sceneOf({
    entries: ['site/scripts/build-surface.mjs'],
    mutate: (config) => {
      delete config.loop.attemptCap;
      return config;
    },
  });
  assert.throws(
    () => scene.evaluate('site/scripts/build-surface.mjs', 'm.DEFAULT_RULES'),
    (error) => error.message.includes(scene.root) && error.message.includes('loop.attemptCap is required')
  );
});
