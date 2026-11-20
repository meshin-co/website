import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rerunFailedJobs } from './pr-github.mjs';
import { json, apiAnswering } from './fixtures/github-fake.mjs';

test('rerunning the failed jobs of a run posts to its rerun-failed-jobs path with no body and resolves undefined', async () => {
  const { api, calls } = apiAnswering(() => json({}, 201));

  const result = await rerunFailedJobs(api, { runId: 44713195235 });

  assert.equal(result, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, 'actions/runs/44713195235/rerun-failed-jobs');
  assert.equal(calls[0].body, undefined);
});

test('a rerun GitHub refuses throws with the status and the message', async () => {
  const { api } = apiAnswering(() => json({ message: 'Workflow is already running' }, 403));

  await assert.rejects(
    rerunFailedJobs(api, { runId: 1 }),
    (error) => error.status === 403 && error.body.message === 'Workflow is already running'
  );
});
