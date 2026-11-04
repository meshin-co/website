import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

import { readEngineConfig } from './engine-config.mjs';
import { blockingFiles, pickGatedRun } from './publish-target.mjs';

const WORKFLOW = parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'publish-live.yml'), 'utf8')
);
const { steps } = WORKFLOW.jobs.publish;

test('the newest green ci run on main that carries a dist is the publishable one', () => {
  const runs = [
    { id: 9, head_branch: 'main', conclusion: 'success', hasDist: false },
    { id: 8, head_branch: 'main', conclusion: 'failure', hasDist: true },
    { id: 7, head_branch: 'main', conclusion: 'success', hasDist: true },
    { id: 6, head_branch: 'main', conclusion: 'success', hasDist: true },
  ];

  assert.equal(pickGatedRun(runs).id, 7);
});

test('a green run on another branch is never publishable', () => {
  const runs = [{ id: 5, head_branch: 'feat/x', conclusion: 'success', hasDist: true }];

  assert.equal(pickGatedRun(runs), undefined);
});

test('prose committed after the gated run cannot change what was measured', () => {
  const files = [
    'docs/PRD.md',
    'audits/phase-12/REPORT.md',
    'site/.agents/skills/publish-the-build.md',
    'openspec/changes/13-free-analytics/tasks.md',
    'investigation/2026-10-14-citations.md',
    'README.md',
  ];

  assert.deepEqual(blockingFiles(files), []);
});

test('source, config or content committed after the gated run blocks publishing', () => {
  const files = [
    'docs/PRD.md',
    'site/src/pages/index.astro',
    'site/src/data/post/a-post.md',
    '.github/workflows/ci.yml',
  ];

  assert.deepEqual(blockingFiles(files), [
    'site/src/pages/index.astro',
    'site/src/data/post/a-post.md',
    '.github/workflows/ci.yml',
  ]);
});

test('a workflow-only commit blocks a publish, because it can change how the bytes are shipped', () => {
  assert.deepEqual(blockingFiles(['.github/workflows/publish-live.yml']), ['.github/workflows/publish-live.yml']);
});

test('the prose directories are the ones the configuration names, so the two guards cannot drift apart', () => {
  for (const dir of readEngineConfig().diff.proseDirectories) assert.deepEqual(blockingFiles([`${dir}a.txt`]), []);
});

test('markdown a site serves from its public directory blocks a publish, because it is not prose to a reader', () => {
  assert.deepEqual(blockingFiles(['site/public/llms-extra.md', 'README.md']), ['site/public/llms-extra.md']);
});

test('a path the rules cannot place blocks a publish rather than passing as prose', () => {
  assert.deepEqual(blockingFiles(['docs/../site/src/pages/index.astro', '', '/etc/hosts']), [
    'docs/../site/src/pages/index.astro',
    '',
    '/etc/hosts',
  ]);
});

const stepNamed = (fragment) => steps.findIndex(({ name = '' }) => name.includes(fragment));
const DEPLOY = steps.findIndex(({ run }) => run === 'npm run deploy');
const EVIDENCE = stepNamed('take the measurement evidence from the tip of main');

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=press', '-c', 'user.email=press@example.invalid', ...args], {
    cwd,
    encoding: 'utf8',
  }).trim();

test('the only input the press takes is the run number to serve, so no input can waive a refusal', () => {
  assert.deepEqual(Object.keys(WORKFLOW.on.workflow_dispatch.inputs), ['ci_run']);
});

test('the deploy step carries the Cloudflare credentials and nothing else, and cannot fail without stopping the press', () => {
  assert.deepEqual(Object.keys(steps[DEPLOY].env).sort(), [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_PAGES_PROJECT',
  ]);
  assert.equal(steps[DEPLOY].if, undefined);
  assert.equal(steps[DEPLOY]['continue-on-error'], undefined);
});

test('the evidence of a measured tree is taken from the tip of main after the build commit is checked out and before the deploy', () => {
  const checkout = stepNamed('take the deploy scripts and the route ledger');

  assert.ok(checkout >= 0 && EVIDENCE > checkout && EVIDENCE < DEPLOY);
  assert.equal(steps[EVIDENCE]['continue-on-error'], undefined);
  assert.match(steps[EVIDENCE].run, /:\/audits\/lighthouse-green\.json :\/audits\/autowriter/);
});

test('the evidence step brings the record committed after the gated run into a shallow checkout of that run', () => {
  const root = mkdtempSync(join(tmpdir(), 'press-evidence-'));
  const origin = join(root, 'origin');
  const write = (repo, path, text) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  };
  mkdirSync(origin);
  git(origin, 'init', '-q', '-b', 'main');
  write(origin, 'site/src/pages/index.astro', 'home\n');
  write(origin, 'audits/lighthouse-green.json', '{"fingerprint":"old"}\n');
  write(origin, 'audits/autowriter/2026/11/an-entry.json', '{"measurementDebt":"open"}\n');
  git(origin, 'add', '-A');
  git(origin, 'commit', '-q', '-m', 'the gated run');
  const gated = git(origin, 'rev-parse', 'HEAD');
  write(origin, 'audits/lighthouse-green.json', '{"fingerprint":"new"}\n');
  write(origin, 'audits/autowriter/2026/11/an-entry.json', '{"measurementDebt":"history"}\n');
  git(origin, 'commit', '-q', '-am', 'record the run, prose only');
  const tip = git(origin, 'rev-parse', 'HEAD');

  const press = join(root, 'press');
  git(root, 'clone', '-q', '--depth=1', `file://${origin}`, press);
  git(press, 'fetch', '-q', '--depth=1', 'origin', gated);
  git(press, 'checkout', '-q', gated);
  assert.match(readFileSync(join(press, 'audits/lighthouse-green.json'), 'utf8'), /old/);

  execFileSync('sh', ['-e', '-c', steps[EVIDENCE].run.replaceAll('${{ github.sha }}', tip)], {
    cwd: join(press, 'site'),
  });

  assert.match(readFileSync(join(press, 'audits/lighthouse-green.json'), 'utf8'), /new/);
  assert.match(readFileSync(join(press, 'audits/autowriter/2026/11/an-entry.json'), 'utf8'), /history/);
  assert.equal(git(press, 'rev-parse', 'HEAD'), gated);
});
