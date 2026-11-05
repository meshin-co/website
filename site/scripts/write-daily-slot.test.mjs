import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';

const WORKFLOW = resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'write-daily.yml');
const workflow = () => yaml.load(readFileSync(WORKFLOW, 'utf8'));
const needsOf = (job) => [job.needs ?? []].flat();

test('a due job decides whether the slot is owed before any job that holds a credential or calls a model', () => {
  const { jobs } = workflow();
  assert.ok(jobs.due, 'the workflow has a due job');
  assert.deepEqual(needsOf(jobs.due), ['configured']);
  assert.match(String(jobs.due.if), /needs\.configured\.outputs\.ready == 'true'/);
  assert.equal(jobs.due.outputs.due, '${{ steps.slot.outputs.due }}');
  assert.deepEqual(jobs.due.permissions, { contents: 'read' });
});

test('every job after the slot check waits for it and runs only when the slot is owed, so a satisfied slot costs one short job', () => {
  const { jobs } = workflow();
  for (const name of ['ceiling', 'write']) {
    assert.ok(needsOf(jobs[name]).includes('due'), `${name} needs the due job`);
    assert.match(String(jobs[name].if), /needs\.due\.outputs\.due == 'true'/, `${name} runs only when due`);
  }
});

test('the slot check reads main as it is now, because a run queued behind another must see the claim that run pushed', () => {
  const { jobs } = workflow();
  const checkout = jobs.due.steps.find(({ uses }) => String(uses).startsWith('actions/checkout'));
  assert.equal(checkout.with.ref, 'main');
});

test('the slot check names the event that started the run, so a manual run is never refused and a schedule is judged', () => {
  const { jobs } = workflow();
  const step = jobs.due.steps.find(({ id }) => id === 'slot');
  assert.match(step.run, /node scripts\/slot-due\.mjs --event "\$\{?GITHUB_EVENT_NAME\}?"/);
});

test('the slot check is cheap and holds no secret: it installs nothing and reads no secret or variable', () => {
  const { jobs } = workflow();
  const text = JSON.stringify(jobs.due);
  assert.doesNotMatch(text, /npm ci|npm install/);
  assert.doesNotMatch(text, /secrets\./);
  assert.doesNotMatch(text, /vars\./);
});

test('the workflow still starts by hand, and a manual run goes through the same job', () => {
  const { on } = workflow();
  assert.ok(Object.hasOwn(on, 'workflow_dispatch'));
  assert.ok(Object.hasOwn(on, 'schedule'));
});
