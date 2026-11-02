import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, test } from 'node:test';

import { buildMachineScene, removeScene, runMachine } from './fixtures/machine-scene.mjs';

const REAL_SITE = join(import.meta.dirname, '..');
const scenes = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) removeScene(scene);
});

const sceneOf = async () => {
  const scene = await buildMachineScene();
  scenes.push(scene);
  return scene;
};

test('the clean scene passes the machine gate, says nothing on stderr and reports what it checked', async () => {
  const scene = await sceneOf();
  const run = runMachine(scene);

  const counts = [
    `${scene.collections} public collections`,
    `${scene.routes.length} routes`,
    `${scene.catalogEntries} catalog entries`,
    `${scene.datedStaticRoutes} static routes checked for one date`,
  ];

  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, '');
  assert.equal(
    run.stdout,
    [
      `machine: ${scene.emptyKinds.length} of ${scene.collections} collections have no live entry and are declared empty with a reason (${scene.emptyKinds.join(', ')}); entry coverage is vacuous for them by declaration`,
      `machine: ${counts.join(', ')}`,
      '',
    ].join('\n')
  );
});

test('the scene holds the files the gate reads outside dist, and none of them is in the real site', async () => {
  const scene = await sceneOf();

  for (const file of ['src/config.yaml', 'src/content.config.ts', 'package.json', 'src/data/post/first-post.md']) {
    assert.ok(existsSync(scene.siteFile(file)), file);
  }
  assert.ok(existsSync(scene.distFile('index.html')));
  assert.ok(relative(REAL_SITE, scene.site).startsWith('..'), scene.site);
});

test('a scene is built fresh every time and shares nothing with the last one', async () => {
  const first = await sceneOf();
  const second = await sceneOf();

  assert.notEqual(first.root, second.root);
  assert.equal(runMachine(first).status, 0);
  assert.equal(runMachine(second).status, 0);
});
