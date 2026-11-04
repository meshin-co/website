import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { FEED_WINDOW } from '../src/utils/feeds.mjs';
import { LLMS_SHARD_MAX_ENTRIES } from '../src/utils/llms-collections.mjs';
import { SCENE_EMPTY_COLLECTIONS } from './fixtures/machine-scene-catalog.mjs';
import { LIVE, ORIGIN, buildMachineScene, readText, removeScene, runMachine } from './fixtures/machine-scene.mjs';

const REAL_SITE = join(import.meta.dirname, '..');
const scenes = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) removeScene(scene);
});

const SCENE_PRELOAD = join(import.meta.dirname, 'fixtures', 'machine-scene-preload.mjs');
const EXCEPTIONS_URL = pathToFileURL(join(REAL_SITE, 'src', 'utils', 'route-exceptions.mjs')).href;
const REPOSITORY_DECLARES_ANOTHER = `data:text/javascript,${encodeURIComponent(
  `import { EMPTY_COLLECTIONS } from '${EXCEPTIONS_URL}'; EMPTY_COLLECTIONS.splice(0, EMPTY_COLLECTIONS.length, { collection: 'service', reason: 'declared by the repository, not by the scene' });`
)}`;
const PRINT_DECLARED = `import { EMPTY_COLLECTIONS } from '${EXCEPTIONS_URL}'; console.log(JSON.stringify(EMPTY_COLLECTIONS.map(({ collection }) => collection)));`;

test('the scene declares its own empty collections, so what the repository declares does not change the gate it runs', () => {
  const run = spawnSync(
    process.execPath,
    ['--import', REPOSITORY_DECLARES_ANOTHER, '--import', SCENE_PRELOAD, '--input-type=module', '-e', PRINT_DECLARED],
    { encoding: 'utf8' }
  );

  assert.equal(run.stderr, '');
  assert.deepEqual(
    JSON.parse(run.stdout),
    SCENE_EMPTY_COLLECTIONS.map(({ collection }) => collection)
  );
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

const entryLines = (text) =>
  text.split('\n').filter((line) => /^\[https?:\/\/[^\]]+\]\(https?:\/\/[^)]+\)$/.test(line));
const guidsOf = (xml) => [...xml.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map(([, url]) => url);

test('the scene fills two post shards to the cap and puts one entry in a third, so each shard can be damaged on its own', async () => {
  const scene = await sceneOf();
  const cap = LLMS_SHARD_MAX_ENTRIES.post;

  assert.equal(LIVE.post.length, 2 * cap + 1);
  assert.deepEqual(readdirSync(scene.distFile('llms')).sort(), [
    'faq.txt',
    'glossary.txt',
    'post-1.txt',
    'post-2.txt',
    'post-3.txt',
    'post.txt',
    'resource.txt',
    'service.txt',
  ]);
  assert.equal(entryLines(readText(scene.distFile('llms/post.txt'))).length, 0);
  const held = [1, 2, 3].map((part) => entryLines(readText(scene.distFile(`llms/post-${part}.txt`))).length);
  assert.deepEqual(held, [cap, cap, 1]);
});

test('the scene llms-full.txt is an index of the collection files, a line for each collection with a live entry and no entry', async () => {
  const scene = await sceneOf();
  const text = readText(scene.distFile('llms-full.txt'));
  const pointers = text.split('\n').filter((line) => line.startsWith('- ['));

  assert.equal(pointers.length, Object.keys(LIVE).length);
  for (const [kind, entries] of Object.entries(LIVE)) {
    const noun = entries.length === 1 ? 'entry' : 'entries';
    const pointer = pointers.find((line) => line.includes(`(${ORIGIN}/llms/${kind}.txt)`));
    assert.ok(pointer?.endsWith(`: ${entries.length} ${noun}, full body text of each.`), `${kind}: ${pointer}`);
  }
  assert.equal(entryLines(text).length, 0);
  for (const { slug } of Object.values(LIVE).flat()) assert.ok(!text.includes(slug), slug);
});

test('a collection over the feed window ships a feed of its newest entries only, the oldest still ships in its llms file, and the gate is clean', async () => {
  const scene = await sceneOf();
  const items = guidsOf(readText(scene.distFile('faq/rss.xml')));
  const [oldest] = [...LIVE.faq].sort((a, b) => (a.updated < b.updated ? -1 : 1));

  assert.equal(LIVE.faq.length, FEED_WINDOW + 1);
  assert.equal(items.length, FEED_WINDOW);
  assert.ok(!items.includes(`${ORIGIN}/faq/${oldest.slug}`));
  assert.ok(readText(scene.distFile('llms/faq.txt')).includes(`${ORIGIN}/faq/${oldest.slug}`));
  assert.equal(runMachine(scene).status, 0);
});

test('the oldest entry of the scene faq sorts first by route, so a window cut by route and not by lastmod would owe it', () => {
  const [oldest] = [...LIVE.faq].sort((a, b) => (a.updated < b.updated ? -1 : 1));
  assert.equal(oldest.slug, LIVE.faq.map(({ slug }) => slug).sort()[0]);
});
