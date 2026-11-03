import assert from 'node:assert/strict';
import { test } from 'node:test';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { partitionReport } from './engine-partition-gate.mjs';
import { SCENE_FILES, sceneReader } from './fixtures/partition-scene.mjs';
import { partitionSpecimens } from './partition-specimens.mjs';

const COPY_SITE = '/copy/site';
const NAMES = ['exportBuildBroken', 'partitionAnchorUnserved', 'partitionFileFitsNoRule', 'partitionSiteBound'];

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

test('the module names one specimen for each guard the partition and the export check add', () => {
  const specimens = partitionSpecimens(helpers());
  assert.deepEqual(Object.keys(specimens).sort(), NAMES);
  for (const { gate, token, plant } of Object.values(specimens)) {
    assert.match(gate, /^gate:(partition|export)$/);
    assert.ok(token.startsWith(gate === 'gate:partition' ? 'PARTITION ' : 'EXPORT '), token);
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
      ['remove', '/copy/seed/site/src/data/tags.mjs.seed'],
      ['add', '/copy/mystery.bin'],
      ['add', '/copy/site/.agents/skills/names-the-site.md'],
    ]
  );
  assert.deepEqual(
    restored.map((restore) => restore()),
    ['edit', 'remove', 'add', 'add']
  );
  assert.ok(calls[3][2].includes(brandFromDisk().name), 'the planted skill names the site');
  assert.match(calls[0][2], /^---\nimport '~\/data\/author\/nobody-here\.md';\nbody\n$/);
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
