import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { titleSuffix } from '../src/utils/brand.mjs';

import { autowriterReport } from './autowriter-gate.mjs';
import { bandSceneFiles } from './fixtures/record-rules-scene.mjs';
import { plantSpendReport } from './fixtures/spend-report-plant.mjs';
import { siteBrand } from './site-brand.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const CI_PATH = '.github/workflows/ci.yml';
const CORE = readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8');
const WORKFLOW = readFileSync(join(REPO, CI_PATH), 'utf8');
const CI_FILE = { path: CI_PATH, text: WORKFLOW };

const PUSH_WITH_DEFAULT_TOKEN = [
  'jobs:',
  '  publish:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '      - name: publish the build',
  '        run: git push origin HEAD',
  '',
].join('\n');
const LAST_PUSH_ONLY = WORKFLOW.replace(
  'BEFORE: ${{ github.event.pull_request.base.sha || github.event.before }}',
  'BEFORE: ${{ github.event.before }}'
);
const PUBLISH_FINDING = /^job publish, step "publish the build": /;

const publishFile = (text, path = '.github/workflows/publish.yml') => ({ path, text });
const findings = (...workflows) =>
  autowriterReport({
    ledgers: [],
    claims: [],
    core: CORE,
    workflows,
    suffix: titleSuffix(siteBrand()),
    now: new Date('2026-11-02T07:00:00.000Z'),
  }).findings;

function inTempRepo(plant, check) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-gate-workflows-'));
  try {
    for (const [path, text] of Object.entries({
      'site/src/config.yaml': `site:\n  name: ${siteBrand().name}\n`,
      'docs/SEMANTIC-CORE.md': CORE,
      [CI_PATH]: WORKFLOW,
      ...bandSceneFiles(),
      ...plant,
    })) {
      if (text === null) continue;
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    plantSpendReport(root);
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const gate = (root) =>
  spawnSync(process.execPath, ['scripts/autowriter-gate.mjs', root], { cwd: SITE, encoding: 'utf8' });

test('a step that pushes with the default token is named with its workflow file, its job and its step', () => {
  const planted = publishFile(PUSH_WITH_DEFAULT_TOKEN);
  const [found, ...others] = findings(CI_FILE, planted);
  assert.deepEqual(others, []);
  assert.equal(found.rule, 'bot-push-token');
  assert.equal(found.path, planted.path);
  assert.match(found.detail, PUBLISH_FINDING);
});

test('a changes job that judges a pull request by its last push is named with the workflow it is in', () => {
  assert.notEqual(LAST_PUSH_ONLY, WORKFLOW);
  const [found, ...others] = findings({ ...CI_FILE, text: LAST_PUSH_ONLY });
  assert.deepEqual(others, []);
  assert.equal(found.rule, 'classifier-judges-last-push');
  assert.equal(found.path, CI_PATH);
  assert.match(found.detail, /github\.event\.pull_request\.base\.sha/);
});

test('the aggregate and classifier rules judge ci.yml alone, so another workflow without a changes job is clean', () => {
  assert.deepEqual(findings(CI_FILE, publishFile('jobs:\n  other:\n    runs-on: ubuntu-latest\n')), []);
});

test('a second workflow that is not YAML is named with its own path and hides no finding of the others', () => {
  const broken = publishFile('jobs: [', '.github/workflows/broken.yml');
  assert.deepEqual(
    findings(CI_FILE, broken, publishFile(PUSH_WITH_DEFAULT_TOKEN)).map(({ rule, path }) => [rule, path]),
    [
      ['workflow-unreadable', '.github/workflows/broken.yml'],
      ['bot-push-token', '.github/workflows/publish.yml'],
    ]
  );
});

test('the command reads every workflow in the directory, so a second file that pushes with the default token fails it', () =>
  inTempRepo({ '.github/workflows/publish.yml': PUSH_WITH_DEFAULT_TOKEN }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1, run.stdout);
    const lines = run.stderr.trim().split('\n');
    assert.equal(lines.length, 1, run.stderr);
    assert.match(lines[0], /^AUTOWRITER bot-push-token \.github\/workflows\/publish\.yml: /);
    assert.match(lines[0].split(': ').slice(1).join(': '), PUBLISH_FINDING);
  }));

test('the command reads a workflow filed with the other YAML extension as well', () =>
  inTempRepo({ '.github/workflows/publish.yaml': PUSH_WITH_DEFAULT_TOKEN }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /^AUTOWRITER bot-push-token \.github\/workflows\/publish\.yaml: job publish, /);
  }));

test('the command fails the changes job that judges a pull request by its last push, naming ci.yml', () =>
  inTempRepo({ [CI_PATH]: LAST_PUSH_ONLY }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1, run.stdout);
    const lines = run.stderr.trim().split('\n');
    assert.equal(lines.length, 1, run.stderr);
    assert.ok(lines[0].startsWith(`AUTOWRITER classifier-judges-last-push ${CI_PATH}: `), run.stderr);
  }));

test('the command refuses a repository with no workflow directory, because a gate that read none cannot read as a pass', () =>
  inTempRepo({ [CI_PATH]: null }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.deepEqual(run.stderr.trim().split('\n'), [
      `AUTOWRITER workflow-unreadable ${CI_PATH}: ${CI_PATH} is missing, so no job carries the verdict of the required jobs`,
    ]);
  }));
