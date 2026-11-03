import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';

import { parse } from 'yaml';

const SCRIPTS = import.meta.dirname;
const WORKFLOWS = join(SCRIPTS, '..', '..', '.github', 'workflows');
const TEXT = readFileSync(join(WORKFLOWS, 'resume-pr.yml'), 'utf8');
const WORKFLOW = parse(TEXT);
const WATCH_TEXT = readFileSync(join(WORKFLOWS, 'watch-pr.yml'), 'utf8');
const { sweep } = WORKFLOW.jobs;

const PAT = 'AUTOWRITER_PAT';
const ENTRY = join(SCRIPTS, 'run-pr-resume.mjs');
const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\b[^'";]*?\bfrom\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

const expression = (inside) => '$' + `{{ ${inside} }}`;
const stepsOf = (job) => job?.steps ?? [];
const runsOf = (job) => stepsOf(job).flatMap((step) => (typeof step.run === 'string' ? [step.run] : []));
const usedBy = (job) => stepsOf(job).flatMap((step) => (step.uses ? [step.uses.split('@')[0]] : []));
const stepUsing = (job, action) => stepsOf(job).find((step) => (step.uses ?? '').startsWith(`${action}@`));
const found = (step, name) => {
  assert.ok(step, `the workflow has no ${name} step`);
  return step;
};
const runner = stepsOf(sweep).find((step) => /resume:pr/.test(step.run ?? ''));
const triggersOf = (text) => Object.keys(parse(text).on ?? {}).sort();

const specifiersOf = (text) => [
  ...[...text.matchAll(STATIC_IMPORT)].map((match) => match[1] ?? match[2]),
  ...[...text.matchAll(DYNAMIC_IMPORT)].map((match) => match[1]),
];
const isBare = (specifier) => !specifier.startsWith('.') && !specifier.startsWith('node:');

function graphFrom(entry) {
  const seen = new Set();
  const bare = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
      if (isBare(specifier)) bare.push(`${specifier} in ${file}`);
      else if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier));
    }
  }
  return { files: seen, bare };
}

test('the workflow is named for what it does, and is marked unattended so the seal and the Lighthouse record refuse', () => {
  assert.equal(WORKFLOW.name, 'Resume escalated pull requests');
  assert.equal(WORKFLOW.env?.AUTOWRITER_UNATTENDED, '1');
  assert.equal(sweep.env, undefined);
});

test('it starts on a push to main and by hand, and on nothing else: a pull request is resumed because main changed', () => {
  assert.deepEqual(triggersOf(TEXT), ['push', 'workflow_dispatch']);
  assert.deepEqual(WORKFLOW.on.push, { branches: ['main'] });
});

test('there is no schedule, because the design has no polling loop and a pull request nobody fixes must cost nothing', () => {
  assert.equal(Object.hasOwn(WORKFLOW.on, 'schedule'), false);
  assert.doesNotMatch(TEXT, /\bcron\b|\bschedule\b/);
});

test('the check for a schedule can fail: it finds one in a planted workflow, and a cron beside the real triggers', () => {
  assert.deepEqual(triggersOf('on:\n  push:\n    branches: [main]\n  schedule:\n    - cron: "17 3 * * *"\n'), [
    'push',
    'schedule',
  ]);
  assert.deepEqual(
    triggersOf(`${TEXT}`.replace('workflow_dispatch:', 'schedule:\n    - cron: "0 * * * *"\n  workflow_dispatch:')),
    ['push', 'schedule', 'workflow_dispatch']
  );
});

test('the dispatch asks for an optional pull request number, which is what makes a run a forced one', () => {
  const { pr } = WORKFLOW.on.workflow_dispatch.inputs;

  assert.deepEqual(Object.keys(WORKFLOW.on.workflow_dispatch.inputs), ['pr']);
  assert.equal(pr.required, false);
  assert.ok([undefined, 'string'].includes(pr.type));
  assert.ok(pr.description.length > 20);
});

test('whole runs queue one behind another and none is cancelled, so two sweeps never write one ledger together', () => {
  assert.deepEqual(WORKFLOW.concurrency, { group: 'resume-pr', 'cancel-in-progress': false });
  assert.equal(sweep.concurrency, undefined);
});

test('there is one job, the sweep, and it keeps its guard, its limit and its working directory', () => {
  assert.deepEqual(Object.keys(WORKFLOW.jobs), ['sweep']);
  assert.equal(sweep.if, "github.ref == 'refs/heads/main'");
  assert.equal(sweep['runs-on'], 'ubuntu-latest');
  assert.equal(sweep['timeout-minutes'], 10);
  assert.equal(sweep.environment, undefined);
  assert.deepEqual(WORKFLOW.defaults, { run: { 'working-directory': 'site' } });
});

test('the job may read the repository and the pull requests, and write issues only: every other write is made with the bot token', () => {
  assert.deepEqual(sweep.permissions, { contents: 'read', 'pull-requests': 'read', issues: 'write' });
  assert.equal(WORKFLOW.permissions, undefined);
});

test('the steps are a checkout, the node version the site names, and the one that runs the sweep', () => {
  assert.deepEqual(usedBy(sweep), ['actions/checkout', 'actions/setup-node']);
  assert.equal(stepsOf(sweep).length, 3);
  assert.equal(runsOf(sweep).length, 1);
  assert.deepEqual(found(stepUsing(sweep, 'actions/checkout'), 'checkout').with, {
    'fetch-depth': 1,
    'persist-credentials': false,
  });
  assert.deepEqual(found(stepUsing(sweep, 'actions/setup-node'), 'setup-node').with, {
    'node-version-file': 'site/.nvmrc',
  });
});

test('the job installs nothing, because the step that runs the sweep holds a token that can write to a branch', () => {
  for (const text of runsOf(sweep)) assert.doesNotMatch(text, /npm (ci|install)|npx /);
  assert.equal(found(stepUsing(sweep, 'actions/setup-node'), 'setup-node').with.cache, undefined);
});

test('the sweep step holds the read token, the bot token and the pull request input, and nothing else', () => {
  const { env } = found(runner, 'sweep');

  assert.deepEqual(env, {
    GITHUB_TOKEN: expression('github.token'),
    [PAT]: expression(`secrets.${PAT}`),
    PULL_REQUEST: expression('inputs.pr'),
  });
});

test('the bot token is the environment of that one step, and of no job or workflow, and no other secret is read', () => {
  assert.equal(TEXT.split(`secrets.${PAT}`).length - 1, 1);
  assert.equal(WORKFLOW.env[PAT], undefined);
  assert.equal(sweep.env, undefined);
  assert.deepEqual(
    [...TEXT.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]),
    [PAT]
  );
});

test('no script interpolates an expression, because an expression in a script is a command injection', () => {
  const scripts = runsOf(sweep);

  assert.equal(scripts.length, 1);
  for (const text of scripts) assert.equal(text.includes('$' + '{{'), false, text);
});

test('the module graph of the command is built from relative files and node: modules only, so the job needs no install', () => {
  const { files, bare } = graphFrom(ENTRY);

  assert.deepEqual(bare, []);
  for (const name of ['run-pr-resume.mjs', 'pr-resume.mjs', 'pr-watch.mjs', 'pr-github.mjs', 'autowriter-ledger.mjs'])
    assert.ok(
      [...files].some((file) => file.endsWith(`/${name}`)),
      `${name} is not in the graph`
    );
  assert.ok(files.size >= 15, `the scan reached only ${files.size} files`);
});

test('the check for a dependency can fail: it finds each way a package gets imported in planted source', () => {
  const planted = [
    "import { parse } from 'yaml';",
    "import 'yaml';",
    "export { parse } from 'yaml';",
    "const later = await import('yaml');",
    "import {\n  parse,\n} from 'yaml';",
  ];
  const clean = [
    "import { readFileSync } from 'node:fs';",
    "import { x } from './x.mjs';",
    "export { y } from '../y.mjs';",
  ];

  for (const text of planted) assert.deepEqual(specifiersOf(text).filter(isBare), ['yaml'], text);
  for (const text of clean) assert.deepEqual(specifiersOf(text).filter(isBare), [], text);
});

test('the watcher this one starts is the workflow of the same repository, at the file name the sweep dispatches', () => {
  assert.equal(parse(WATCH_TEXT).name, 'Watch PR');
  assert.deepEqual(Object.keys(parse(WATCH_TEXT).on.workflow_dispatch.inputs).sort(), ['observed', 'pr']);
});

const STUB_NPM = ['#!/bin/sh', 'printf \'%s\\n\' "$*" >> "$STUB_LOG"', 'exit "${STUB_STATUS:-0}"', ''].join('\n');
const scenes = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) rmSync(scene, { recursive: true, force: true });
});

function runStep({ pullRequest, status = 0 }) {
  const root = mkdtempSync(join(tmpdir(), 'resume-workflow-'));
  scenes.push(root);
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'bin', 'npm'), STUB_NPM);
  chmodSync(join(root, 'bin', 'npm'), 0o755);
  writeFileSync(join(root, 'npm.log'), '');
  writeFileSync(join(root, 'step.sh'), runner.run);
  const outcome = spawnSync('bash', ['-e', join(root, 'step.sh')], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      STUB_LOG: join(root, 'npm.log'),
      STUB_STATUS: String(status),
      PULL_REQUEST: pullRequest,
    },
  });
  return { status: outcome.status, commands: readFileSync(join(root, 'npm.log'), 'utf8').trim().split('\n') };
}

test('with no pull request input the step runs the sweep with no argument, so a push to main sweeps everything', () => {
  assert.deepEqual(runStep({ pullRequest: '' }), { status: 0, commands: ['run --silent resume:pr'] });
});

test('with a pull request input the step passes it as the one argument that forces that pull request', () => {
  assert.deepEqual(runStep({ pullRequest: '84' }), { status: 0, commands: ['run --silent resume:pr -- --pr 84'] });
});

test('the input is passed as one word whatever it holds, so text that looks like a command stays an argument', () => {
  const { commands } = runStep({ pullRequest: '84; echo pwned' });

  assert.deepEqual(commands, ['run --silent resume:pr -- --pr 84; echo pwned']);
});

test('a sweep that fails fails the step, so a run is red whenever a pull request could not be resumed', () => {
  assert.equal(runStep({ pullRequest: '', status: 1 }).status, 1);
  assert.equal(runStep({ pullRequest: '84', status: 2 }).status, 2);
});
