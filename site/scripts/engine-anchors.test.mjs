import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { FIXED_ANCHORS, anchorsFor } from './engine-anchors.mjs';
import { LENGTH_FILE } from './entry-length.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { BAND_FILE } from './sentence-band.mjs';
import { PROMPT_SOURCES } from './writer-prompt.mjs';
import { REPO_FILES } from './writer-tree.mjs';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const config = readEngineConfig();
const anchors = anchorsFor(config);
const covered = (path) =>
  anchors.some((anchor) => anchor.path === path || (anchor.kind === 'directory' && path.startsWith(`${anchor.path}/`)));

test('every anchor has a unique path, a kind and a role that says what reads it', () => {
  assert.ok(anchors.length >= 20, `only ${anchors.length} anchors`);
  assert.equal(new Set(anchors.map(({ path }) => path)).size, anchors.length);
  for (const { path, kind, role } of anchors) {
    assert.ok(['file', 'directory'].includes(kind), path);
    assert.ok(role.length > 20, `${path} has no role`);
    assert.ok(!path.startsWith('/') && !path.endsWith('/'), path);
  }
});

test('every anchor exists in this repository, so the list describes the real engine', () => {
  for (const { path, kind } of anchors) {
    const target = join(REPOSITORY, path);
    assert.ok(existsSync(target), `${path} is listed and absent`);
    assert.equal(statSync(target).isDirectory(), kind === 'directory', path);
  }
});

test('every file the writer prompt reads is an anchor, so a new prompt source cannot go unlisted', () => {
  for (const { path } of PROMPT_SOURCES) assert.ok(covered(path), `prompt source ${path} is not an anchor`);
});

test('every path the writer reads from the tree is an anchor', () => {
  const read = [
    REPO_FILES.bannedPhrases,
    REPO_FILES.contentFacts,
    REPO_FILES.controlledWords,
    REPO_FILES.routes,
    REPO_FILES.tags,
    BAND_FILE,
    LENGTH_FILE,
    ...Object.values(REPO_FILES.collections),
  ];
  for (const path of read) assert.ok(covered(path), `${path} is read and is not an anchor`);
});

test('the three workflows the engine runs are anchors', () => {
  for (const name of ['ci.yml', 'watch-pr.yml', 'write-daily.yml'])
    assert.ok(covered(`.github/workflows/${name}`), name);
});

test('the anchors that depend on the layout follow the configuration', () => {
  const moved = structuredClone(config);
  moved.content.dataDirectory = 'web/content';
  moved.content.formats.term.collection = 'terms';
  moved.content.formats.article.collection = 'articles';
  moved.content.formats.article.resourceCollection = 'downloads';
  const paths = anchorsFor(moved).map(({ path }) => path);
  for (const path of ['web/content/tags.mjs', 'web/content/terms', 'web/content/articles', 'web/content/downloads']) {
    assert.ok(paths.includes(path), path);
  }
  assert.ok(!paths.some((path) => path.startsWith('site/src/data')), 'a derived anchor kept the old directory');
  assert.equal(paths.length, anchors.length);
});

test('the fixed anchors are a prefix of every derived list', () => {
  assert.deepEqual(anchors.slice(0, FIXED_ANCHORS.length), FIXED_ANCHORS);
});
