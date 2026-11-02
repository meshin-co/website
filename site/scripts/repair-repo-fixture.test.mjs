import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, afterEach, test } from 'node:test';

import { WriterError } from './writer-error.mjs';
import { freshDigest } from './fixtures/route-dispositions.mjs';
import { fakeRun, gitIn } from './fixtures/route-repo.mjs';
import {
  emptyRepo,
  landedRepo,
  OWNER_REASON,
  refusedAsDeleted,
  removeRepos,
  removeTemplates,
  repairRun,
  strayRun,
  treeOf,
  UNTOUCHED,
} from './fixtures/repair-repo.mjs';

afterEach(removeRepos);
after(removeTemplates);

const SLUG = 'how-to-write-an-ai-incident-runbook';
const ROUTES = 'audits/phase-4.7/dispositions/routes.json';
const inSite = (root) => ({ cwd: join(root, 'site') });

test('a landed repository is clean, holds the entry with its disposition and an owner row, and passes the editorial gate', async () => {
  const root = await landedRepo();
  const rows = JSON.parse(readFileSync(join(root, ROUTES), 'utf8'));
  const owner = rows.at(-1);

  assert.equal(treeOf(root).status, '');
  for (const path of [
    `site/src/data/post/${SLUG}.md`,
    `audits/phase-4.7/dispositions/generated-${SLUG}.json`,
    UNTOUCHED,
  ])
    assert.ok(existsSync(join(root, path)), path);
  assert.equal(owner.reason, OWNER_REASON);
  assert.equal(owner.digest, freshDigest(root, `/blog/${SLUG}`));
  assert.equal(fakeRun(root)('npm', ['run', 'gate:editorial'], inSite(root)).status, 0);
});

test('every landed repository is its own copy and the next one starts from the landed state', async () => {
  const first = await landedRepo();
  writeFileSync(join(first, UNTOUCHED), 'changed\n');
  const second = await landedRepo();

  assert.notEqual(first, second);
  assert.equal(readFileSync(join(second, UNTOUCHED), 'utf8'), 'x\n');
  assert.equal(treeOf(second).status, '');
});

test('the run hands git to git in the directory it was given, runs a hook before the command, and keeps every call in order', async () => {
  const root = await landedRepo();
  const seen = [];
  const run = repairRun(root, { before: { 'npm run build': () => seen.push(run.calls.length) } });

  assert.equal(run('git', ['rev-parse', '--show-toplevel'], { cwd: root }).status, 0);
  assert.equal(run('npm', ['run', 'build'], inSite(root)).status, 0);
  assert.equal(run('npm', ['run', 'gate:content'], inSite(root)).status, 0);
  assert.deepEqual(seen, [2]);
  assert.deepEqual(
    run.calls.map(({ key }) => key),
    ['git rev-parse --show-toplevel', 'npm run build', 'npm run gate:content']
  );
  assert.equal(run('git', ['status', '--porcelain'], { cwd: root }).stdout, '');
  assert.equal(gitIn(root, 'log', '--format=%s', '-1').trim(), 'landed');
});

test('a git answer can be injected, and a failure can be injected into the commands the fake knows', async () => {
  const root = await landedRepo();
  const run = repairRun(root, {
    git: () => ({ status: 128, stdout: '', stderr: 'fatal' }),
    fail: { 'npm run build': { status: 2 } },
  });

  assert.equal(run('git', ['status'], { cwd: root }).status, 128);
  assert.equal(run('npm', ['run', 'build'], inSite(root)).status, 2);
});

test('a stray run changes the tree once, just before the last gate', async () => {
  const root = await landedRepo();
  const run = strayRun(root, () => writeFileSync(join(root, UNTOUCHED), 'stray\n'));

  assert.equal(run('npm', ['run', 'gate:human'], inSite(root)).status, 0);
  assert.equal(readFileSync(join(root, UNTOUCHED), 'utf8'), 'x\n');
  assert.equal(run('npm', ['run', 'gate:machine'], inSite(root)).status, 0);
  assert.equal(readFileSync(join(root, UNTOUCHED), 'utf8'), 'stray\n');
});

test('the deleted-path matcher accepts one message and nothing else', () => {
  const refused = refusedAsDeleted(UNTOUCHED);

  assert.equal(refused(new WriterError('build', `the repair deleted ${UNTOUCHED}`)), true);
  assert.equal(refused(new WriterError('build', `the repair deleted ${UNTOUCHED} and more`)), false);
  assert.equal(refused(new WriterError('commit', `the repair deleted ${UNTOUCHED}`)), false);
  assert.equal(refused(new Error(`the repair deleted ${UNTOUCHED}`)), false);
});

test('removing the repositories takes every copy away, and an empty repository holds no entry', async () => {
  const landed = await landedRepo();
  const empty = emptyRepo();

  assert.ok(!existsSync(join(empty, `site/src/data/post/${SLUG}.md`)));
  await removeRepos();
  assert.ok(!existsSync(landed) && !existsSync(empty));
});
