import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { parse } from 'yaml';

const FILE = join(import.meta.dirname, '..', '..', '.github', 'workflows', 'remeasure-pr.yml');
const WORKFLOW = parse(readFileSync(FILE, 'utf8'));
const { measure, record } = WORKFLOW.jobs;
const stepOf = (job, id) => job.steps.find((step) => step.id === id);
const GATE_STEP = stepOf(measure, 'gate');
const scenes = [];

afterEach(() => {
  for (const scene of scenes.splice(0)) rmSync(scene, { recursive: true, force: true });
});

function runGate({ gate, scripts = { 'gate:orphans': 'node x' }, status = 0 }) {
  const root = mkdtempSync(join(tmpdir(), 'remeasure-'));
  scenes.push(root);
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'bin', 'npm'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${root}/npm.log"\nexit ${status}\n`);
  chmodSync(join(root, 'bin', 'npm'), 0o755);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts }));
  writeFileSync(join(root, 'github-output.txt'), '');
  const found = spawnSync('bash', ['-e', '-c', GATE_STEP.run], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      GITHUB_OUTPUT: join(root, 'github-output.txt'),
      GATE: gate,
    },
  });
  return { status: found.status, outputs: readFileSync(join(root, 'github-output.txt'), 'utf8') };
}

test('the run is started by hand with the pull request, its head and the one gate, and queues one behind another per pull request', () => {
  assert.deepEqual(Object.keys(WORKFLOW.on.workflow_dispatch.inputs), ['pr', 'head', 'gate']);
  for (const input of Object.values(WORKFLOW.on.workflow_dispatch.inputs)) assert.equal(input.required, true);
  assert.equal(WORKFLOW.concurrency.group, 'remeasure-pr-${{ inputs.pr }}');
  assert.equal(WORKFLOW.concurrency['cancel-in-progress'], false);
});

test('the job that runs the gate reads the repository, holds no secret and pushes nothing', () => {
  assert.deepEqual(measure.permissions, { contents: 'read' });
  assert.doesNotMatch(JSON.stringify(measure), /secrets\.|AUTOWRITER_PAT|git\s+push/);
  for (const step of measure.steps.filter(({ uses }) => uses?.startsWith('actions/checkout')))
    assert.equal(step.with['persist-credentials'], false);
});

test('the branch is caught up before the build and the build comes before the gate, and the gate is the only one run', () => {
  const position = (matches) => measure.steps.findIndex(matches);
  const caughtUp = position((step) => step.id === 'catchup');
  const built = position((step) => step.run === 'npm run build');

  assert.ok(caughtUp >= 0 && caughtUp < built && built < position((step) => step.id === 'gate'));
  assert.equal(measure.steps.filter((step) => /npm run "\$GATE"/.test(step.run ?? '')).length, 1);
  assert.equal(measure.steps.filter((step) => /gate:/.test(step.run ?? '') && step.id !== 'gate').length, 0);
});

test('no script interpolates an expression, because an expression in a script is a command injection', () => {
  for (const step of [...measure.steps, ...record.steps]) assert.doesNotMatch(step.run ?? '', /\$\{\{/);
  assert.equal(GATE_STEP.env.GATE, '${{ inputs.gate }}');
});

test('a gate that exits 0 reads as clear and one that exits non-zero reads as reproduced', () => {
  assert.deepEqual(runGate({ gate: 'gate:orphans', status: 0 }), { status: 0, outputs: 'result=clear\n' });
  assert.deepEqual(runGate({ gate: 'gate:orphans', status: 1 }), { status: 0, outputs: 'result=reproduced\n' });
});

test('a name that is not a gate, or a gate with no script, fails the job and writes no result, so the re-measure stays requested', () => {
  for (const gate of ['build', 'gate:missing', '', 'gate:orphans; id']) {
    const found = runGate({ gate });

    assert.notEqual(found.status, 0, JSON.stringify(gate));
    assert.equal(found.outputs, '', JSON.stringify(gate));
  }
});

test('the record job waits for a result, holds the bot token, installs nothing and passes the result to the command', () => {
  assert.equal(record.needs, 'measure');
  assert.equal(record.if, "needs.measure.outputs.result != ''");
  const [command] = record.steps.filter((step) => step.run !== undefined);

  assert.equal(command.env.AUTOWRITER_PAT, '${{ secrets.AUTOWRITER_PAT }}');
  assert.equal(command.env.RESULT, '${{ needs.measure.outputs.result }}');
  assert.match(command.run, /^npm run --silent remeasure:record -- --pr "\$PULL_REQUEST" --result "\$RESULT"$/);
  assert.equal(record.steps.filter((step) => /npm (ci|install)/.test(step.run ?? '')).length, 0);
});
