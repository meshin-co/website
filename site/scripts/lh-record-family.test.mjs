import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { proveRecordRefusal, recordScene, treeMovedAfterTheRun } from './lh-record-family.mjs';

const exec = promisify(execFile);
const realSite = new URL('..', import.meta.url).pathname;

const run = async (command, args, cwd) => {
  try {
    const { stdout, stderr } = await exec(command, args, { cwd });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code, output: `${error.stdout}${error.stderr}` };
  }
};

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const scratch = () => mkdtemp(join(tmpdir(), 'lh-record-family-'));

async function siteWith(edit) {
  const site = join(await scratch(), 'site');
  await cp(join(realSite, 'scripts'), join(site, 'scripts'), { recursive: true });
  for (const name of ['package.json', 'budgets.json', 'lighthouserc.cjs'])
    await cp(join(realSite, name), join(site, name));
  await edit(site);
  return site;
}

test('the family is proven on the real scripts: green while the tree is the one measured, red naming both trees once it moves', async () => {
  const result = await proveRecordRefusal({ copySite: realSite, work: await scratch(), run });

  assert.equal(result.ok, true, result.reason);
  assert.match(result.reason, /lh:record red on the specimen/);
});

test('a record that no longer checks the stamp turns the family red, so the family is load-bearing', async () => {
  const unguarded = await siteWith(async (site) => {
    const file = join(site, 'scripts/run-lh-evidence.mjs');
    const source = await readFile(file, 'utf8');
    const edited = source.replace('if (unmeasured) refuse(unmeasured);', '');
    assert.notEqual(edited, source);
    await writeFile(file, edited);
  });

  const result = await proveRecordRefusal({ copySite: unguarded, work: await scratch(), run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green on the specimen/);
});

test('planting moves the tree of the scene and restoring puts it back exactly', async () => {
  const scene = await recordScene({ copySite: realSite, work: await scratch() });
  const specimen = treeMovedAfterTheRun(scene);
  const before = {
    head: git(scene.root, 'rev-parse', 'HEAD^{tree}'),
    status: git(scene.root, 'status', '--porcelain'),
  };

  const restore = await specimen.plant(scene.site);
  const planted = git(scene.root, 'rev-parse', 'HEAD^{tree}');
  await restore();

  assert.notEqual(planted, before.head);
  assert.equal(git(scene.root, 'rev-parse', 'HEAD^{tree}'), before.head);
  assert.equal(git(scene.root, 'status', '--porcelain'), before.status);
});

test('the scene is a repository of its own, so a copy with uncommitted edits cannot make record refuse before it reaches the stamp', async () => {
  const scene = await recordScene({ copySite: realSite, work: await scratch() });

  assert.equal(git(scene.root, 'rev-parse', '--show-toplevel').endsWith('lh-record-scene'), true);
  assert.equal(git(scene.root, 'status', '--porcelain', '--', 'site'), '');
});
