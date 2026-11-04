import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

const WORKFLOW = parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'publish-live.yml'), 'utf8')
);
const CI = parse(readFileSync(resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8'));
const { target, publish } = WORKFLOW.jobs;
const stepRunning = (job, text) => job.steps.find(({ run = '' }) => run.includes(text));

test('the press runs by itself when a ci run finishes on main, and still runs when a person dispatches it', () => {
  assert.deepEqual(WORKFLOW.on.workflow_run, { workflows: [CI.name], types: ['completed'], branches: ['main'] });
  assert.ok('workflow_dispatch' in WORKFLOW.on);
});

test('only a successful push run of ci on main gets as far as choosing a build, and a person always can', () => {
  for (const clause of [
    "github.ref == 'refs/heads/main'",
    "github.event_name == 'workflow_dispatch'",
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
  ])
    assert.ok(target.if.includes(clause), clause);
});

test('an automatic run asks for exactly the ci run that finished, a dispatch for the run it names or the newest', () => {
  const { run } = stepRunning(target, 'run-publish-target.mjs');

  assert.match(run, /\$\{\{ inputs\.ci_run \|\| github\.event\.workflow_run\.id \}\}/);
});

test('an automatic run whose ci run built nothing is skipped, because only prose changed, and a dispatch is never skipped', () => {
  const { run } = stepRunning(target, 'run-publish-target.mjs');

  assert.match(run, /github\.event_name == 'workflow_run' && '--skip-without-dist'/);
});

test('the build is published from the gated run and never rebuilt', () => {
  const download = publish.steps.find(({ uses = '' }) => uses.startsWith('actions/download-artifact'));

  assert.equal(download.with.name, 'dist');
  assert.equal(download.with['run-id'], '${{ needs.target.outputs.run_id }}');
  for (const { run = '' } of [...target.steps, ...publish.steps]) assert.doesNotMatch(run, /npm run build|astro build/);
});

test('nothing is published unless a build was chosen, and publishes take turns', () => {
  assert.equal(publish.needs, 'target');
  assert.equal(publish.if, "needs.target.outputs.run_id != ''");
  assert.deepEqual(WORKFLOW.concurrency, { group: 'publish-live', 'cancel-in-progress': false });
  assert.equal(publish.environment, 'production');
});
