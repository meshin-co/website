import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';
import { pressScene } from './press-specimens.mjs';

const exec = promisify(execFile);
const realSite = new URL('..', import.meta.url).pathname;
const specimen = SPECIMENS.pressPublishesUnmeasuredTree;

const run = async (command, args, cwd) => {
  try {
    const { stdout, stderr } = await exec(command, args, { cwd });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code, output: `${error.stdout}${error.stderr}` };
  }
};

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const scratch = () => mkdtemp(join(tmpdir(), 'press-specimens-'));

test('the press is proven on the real scripts: it publishes the measured tree and refuses once an entry was merged on top of it', async () => {
  const site = await pressScene({ copySite: realSite, work: await scratch() });

  const result = await proveWithSpecimen(specimen, { copySite: site, run });

  assert.equal(result.ok, true, result.reason);
  assert.match(result.reason, /deploy red on the specimen \(was never measured by Lighthouse\), green without it/);
});

test('a press that no longer checks the measurement turns the family red, so the family is load-bearing', async () => {
  const site = await pressScene({ copySite: realSite, work: await scratch() });
  const file = join(site, 'scripts/run-deploy.mjs');
  const source = await readFile(file, 'utf8');
  const unguarded = source.replace('if (unmeasured.length > 0) {', 'if (unmeasured.length < 0) {');
  assert.notEqual(unguarded, source);
  await writeFile(file, unguarded);
  git(join(site, '..'), 'add', '-A');
  git(
    join(site, '..'),
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@example.invalid',
    'commit',
    '-q',
    '-m',
    'unguard the press'
  );

  const result = await proveWithSpecimen(specimen, { copySite: site, run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green on the specimen/);
});

test('planting moves the tree of the scene and restoring puts it back exactly', async () => {
  const site = await pressScene({ copySite: realSite, work: await scratch() });
  const root = join(site, '..');
  const before = { tree: git(root, 'rev-parse', 'HEAD^{tree}'), status: git(root, 'status', '--porcelain') };

  const restore = await specimen.plant(site);
  const planted = git(root, 'rev-parse', 'HEAD^{tree}');
  await restore();

  assert.notEqual(planted, before.tree);
  assert.equal(git(root, 'rev-parse', 'HEAD^{tree}'), before.tree);
  assert.equal(git(root, 'status', '--porcelain'), before.status);
});

test('the scene is a repository of its own and starts no background git maintenance', async () => {
  const site = await pressScene({ copySite: realSite, work: await scratch() });
  const root = join(site, '..');

  assert.equal(git(root, 'rev-parse', '--show-toplevel').endsWith('press-scene'), true);
  assert.equal(git(root, 'config', '--get', 'maintenance.auto'), 'false');
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('the scene copies the real scripts, so the specimen judges the code that ships', async () => {
  const site = await pressScene({ copySite: realSite, work: await scratch() });
  const copy = await readFile(join(site, 'scripts/deploy.mjs'), 'utf8');

  assert.equal(copy, await readFile(join(realSite, 'scripts/deploy.mjs'), 'utf8'));
});
