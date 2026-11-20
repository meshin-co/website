import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import yaml from 'js-yaml';

import { CANCEL_ON_FAILURE_JOB, CANCEL_ON_FAILURE_NEEDS, CI_WORKFLOW_PATH, RERUN_CAP } from './pr-checks.mjs';

const workflow = yaml.load(readFileSync(new URL(`../../${CI_WORKFLOW_PATH}`, import.meta.url), 'utf8'));

test('the cap is one automatic rerun of a run', () => {
  assert.equal(RERUN_CAP, 1);
});

test('the job whose skip shows that nothing failed runs only when a job failed', () => {
  assert.equal(workflow.jobs[CANCEL_ON_FAILURE_JOB].if, 'failure()');
});

test('it waits for exactly the jobs whose cancellation the watcher reads as a job dying on its own', () => {
  assert.deepEqual(workflow.jobs[CANCEL_ON_FAILURE_JOB].needs.toSorted(), CANCEL_ON_FAILURE_NEEDS.toSorted());
});
