import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { parse } from 'yaml';

import { GIT_ENVIRONMENT } from './fixtures/route-repo.mjs';

const WORKFLOW = parse(
  readFileSync(join(import.meta.dirname, '..', '..', '.github', 'workflows', 'watch-pr.yml'), 'utf8')
);
const { repair } = WORKFLOW.jobs;
const stepOf = (id) => repair.steps.find((step) => step.id === id);
const positionOf = (id) => repair.steps.findIndex((step) => step.id === id);
const refresh = stepOf('refresh');

const IDENTITY = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test'];
const STUB_NPM = [
  '#!/bin/sh',
  'printf \'%s | %s\\n\' "$*" "$(cat package-lock.json)" >> "$STUB_LOG"',
  'exit "${STUB_STATUS:-0}"',
  '',
].join('\n');

const scenes = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) rmSync(scene, { recursive: true, force: true });
});

const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENVIRONMENT, encoding: 'utf8' }).trim();

function writeSite(root, { lock, manifest }) {
  mkdirSync(join(root, 'site'), { recursive: true });
  writeFileSync(join(root, 'site/package-lock.json'), lock);
  writeFileSync(join(root, 'site/package.json'), manifest);
  git(root, 'add', '--', 'site');
  git(root, ...IDENTITY, 'commit', '--quiet', '-m', lock);
}

function runRefresh({ mainMoves, status = 0 }) {
  assert.ok(refresh, 'the repair job has a step with the id refresh');
  const scene = mkdtempSync(join(tmpdir(), 'watch-pr-install-'));
  scenes.push(scene);
  const root = join(scene, 'repo');
  mkdirSync(root);
  git(root, 'init', '--quiet', '--initial-branch=main');
  writeSite(root, { lock: 'lock-of-the-branch', manifest: 'manifest-of-the-branch' });
  const head = git(root, 'rev-parse', 'HEAD');
  if (mainMoves) writeSite(root, { lock: 'lock-of-main', manifest: 'manifest-of-main' });
  git(root, 'update-ref', 'refs/remotes/origin/main', git(root, 'rev-parse', 'HEAD'));
  git(root, 'checkout', '--quiet', head);

  mkdirSync(join(scene, 'bin'));
  writeFileSync(join(scene, 'bin', 'npm'), STUB_NPM);
  chmodSync(join(scene, 'bin', 'npm'), 0o755);
  writeFileSync(join(scene, 'npm.log'), '');
  writeFileSync(join(scene, 'outputs'), '');
  writeFileSync(join(scene, 'step.sh'), refresh.run);
  const result = spawnSync('bash', ['-e', join(scene, 'step.sh')], {
    cwd: join(root, 'site'),
    encoding: 'utf8',
    env: {
      ...GIT_ENVIRONMENT,
      PATH: `${join(scene, 'bin')}:${process.env.PATH}`,
      STUB_LOG: join(scene, 'npm.log'),
      STUB_STATUS: String(status),
      GITHUB_OUTPUT: join(scene, 'outputs'),
    },
  });
  return {
    exit: result.status,
    log: readFileSync(join(scene, 'npm.log'), 'utf8'),
    outputs: readFileSync(join(scene, 'outputs'), 'utf8'),
    dirty: git(root, 'status', '--porcelain'),
    head: git(root, 'rev-parse', 'HEAD'),
    lock: readFileSync(join(root, 'site/package-lock.json'), 'utf8'),
    manifest: readFileSync(join(root, 'site/package.json'), 'utf8'),
    branchHead: head,
  };
}

test('the install that holds main is a step of the repair job, after the first install and before the catch-up', () => {
  assert.ok(refresh, 'the repair job has a step with the id refresh');
  assert.equal(refresh.if, "needs.watch.outputs.kind == 'catch-up'");
  assert.ok(positionOf('refresh') < positionOf('catchup'));
  const first = repair.steps.findIndex((step) => step.run === 'npm ci');
  assert.ok(first >= 0 && first < positionOf('refresh'), 'step 91 stays and runs first');
});

test('a lockfile that main moved is installed from main, scripts off, and the branch files come back', () => {
  const { exit, log, outputs, dirty, head, branchHead, lock, manifest } = runRefresh({ mainMoves: true });

  assert.equal(exit, 0);
  assert.equal(log, 'ci --ignore-scripts | lock-of-main\n');
  assert.equal(outputs, '');
  assert.equal(dirty, '', 'the tree is clean again, so the catch-up accepts it');
  assert.equal(head, branchHead);
  assert.equal(lock, 'lock-of-the-branch');
  assert.equal(manifest, 'manifest-of-the-branch');
});

test('a branch whose dependency files equal main is not installed a second time', () => {
  const { exit, log, outputs, dirty } = runRefresh({ mainMoves: false });

  assert.equal(exit, 0);
  assert.equal(log, '');
  assert.equal(outputs, '');
  assert.equal(dirty, '');
});

test('an install that fails is the failed outcome and the step still hands the tree back clean', () => {
  const { exit, log, outputs, dirty, lock } = runRefresh({ mainMoves: true, status: 1 });

  assert.equal(exit, 0, 'the step reports through its output, so the follow job reads a named outcome');
  assert.match(log, /^ci --ignore-scripts/);
  assert.equal(outputs, 'outcome=failed\n');
  assert.equal(dirty, '');
  assert.equal(lock, 'lock-of-the-branch');
});
