import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { headFingerprint } from './lh-evidence.mjs';
import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';
import { pressScene } from './press-specimens.mjs';

const exec = promisify(execFile);
const realSite = new URL('..', import.meta.url).pathname;
const specimen = SPECIMENS.pressWarnsOfUnmeasuredTree;

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

test('the press is proven on the real scripts: it publishes the measured tree silently and warns, still publishing, once an entry was merged on top of it', async () => {
  const site = await pressScene({ copySite: realSite, work: await scratch() });

  const result = await proveWithSpecimen(specimen, { copySite: site, run });

  assert.equal(result.ok, true, result.reason);
  assert.match(
    result.reason,
    /deploy warned on the specimen \(was never measured by Lighthouse\) and went through, silent without it/
  );
});

const alter = async (site, from, to, message) => {
  const file = join(site, 'scripts/run-deploy.mjs');
  const source = await readFile(file, 'utf8');
  const altered = source.replace(from, to);
  assert.notEqual(altered, source);
  await writeFile(file, altered);
  const root = join(site, '..');
  const commitAs = (text) => {
    git(root, 'add', '-A');
    git(root, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', text);
  };
  commitAs(message);
  const record = join(root, 'audits', 'lighthouse-green.json');
  const recorded = JSON.parse(await readFile(record, 'utf8'));
  await writeFile(record, JSON.stringify({ ...recorded, fingerprint: await headFingerprint(root) }));
  commitAs('record the run again');
};

test('a press that stops saying the tree is unmeasured turns the family red, so the family is load-bearing', async () => {
  const site = await pressScene({ copySite: realSite, work: await scratch() });
  await alter(site, 'measurementWarnings(measurement)', '[]', 'silence the press');

  const result = await proveWithSpecimen(specimen, { copySite: site, run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed silent on the specimen/);
});

test('a press that refuses the unmeasured tree again turns the family red, so the line cannot be stopped unnoticed', async () => {
  const site = await pressScene({ copySite: realSite, work: await scratch() });
  await alter(
    site,
    'console.error(`::warning::DEPLOY ${warning}`);',
    'console.error(`DEPLOY ${warning}`), process.exit(1);',
    'stop the line'
  );

  const result = await proveWithSpecimen(specimen, { copySite: site, run });

  assert.equal(result.ok, false);
  assert.match(result.reason, /refused the specimen, though it may only warn/);
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
