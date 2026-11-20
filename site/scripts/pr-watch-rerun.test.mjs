import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GitHubError } from './pr-github.mjs';
import { WORKFLOW } from './pr-watch.mjs';
import { judge } from './fixtures/pr-judge.mjs';
import { scenario, withAttempt, withConclusions } from './fixtures/pr-watch.mjs';
import { PAT, callOf, harness, readJson, written, writtenNames } from './fixtures/pr-watch-harness.mjs';

const RUN = 44713195235;

const specimen = () => scenario('shard-timed-out');
const secondLook = (bundle, extra = {}) => harness({ bundle, observed: judge(bundle).observe, ...extra });

test('the first look at a shard that died on its own writes only the observation, for its successor', async () => {
  const { run, calls } = await harness({ bundle: specimen() });
  const { action, result } = await run();

  assert.equal(result.verdict, 'unsettled');
  assert.equal(action, 'successor');
  assert.deepEqual(writtenNames(calls), ['dispatch']);
  assert.equal(callOf(calls, 'dispatch')[2].inputs.observed, `cancelled:${specimen().pullRequest.head.sha}:${RUN}:1`);
});

test('the second look reruns the failed jobs as the bot, then hands the successor a clean slate', async () => {
  const { run, calls, requests } = await secondLook(specimen());
  const { action, result } = await run();

  assert.equal(result.verdict, 'rerun');
  assert.equal(action, 'successor');
  assert.deepEqual(written(calls), [
    ['rerun', PAT, { runId: RUN }],
    ['dispatch', PAT, { workflow: WORKFLOW, ref: 'main', inputs: { pr: '72', observed: '' } }],
  ]);
  assert.deepEqual(requests, []);
});

test('a run attempted twice that is cancelled again is escalated as no convergence and not rerun', async () => {
  const { run, calls, requests, ledgerPath } = await secondLook(withAttempt(specimen(), 2));
  const { action, result } = await run();

  assert.equal(result.reason, 'rerun-cap');
  assert.equal(action, 'escalated');
  assert.deepEqual(writtenNames(calls), ['putLedger']);
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'no-convergence');
  assert.match(requests[0].body.title, /a CI job died on its own again after the one automatic rerun/);
  assert.match(requests[0].body.body, /Jobs: visual-and-axe \(2\)\./);
});

test('a run a person cancelled is escalated as before and never rerun', async () => {
  const bundle = withConclusions(specimen(), { 'cancel-on-failure': 'cancelled', 'deploy-preview': 'cancelled' });
  const { run, calls, ledgerPath } = await secondLook(bundle);
  const { action, result } = await run();

  assert.equal(result.reason, 'inconclusive-cancel');
  assert.equal(action, 'escalated');
  assert.deepEqual(writtenNames(calls), ['putLedger']);
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'hard-stop');
});

test('a token that may not rerun the run is a credential problem, and no successor follows it', async () => {
  const body = { message: 'Resource not accessible by personal access token' };
  const path = `actions/runs/${RUN}/rerun-failed-jobs`;
  const error = new GitHubError({ method: 'POST', path, status: 403, body });
  const { run, calls, requests } = await secondLook(specimen(), { failWith: { during: 'rerun', error } });

  await assert.rejects(run(), (thrown) => thrown === error);
  assert.match(requests[0].body.title, /AUTOWRITER_PAT/);
  assert.match(requests[0].body.body, /rerun-failed-jobs/);
  assert.equal(
    calls.some(([name]) => name === 'dispatch'),
    false
  );
});
