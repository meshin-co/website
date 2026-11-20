import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { judge } from './fixtures/pr-judge.mjs';
import { scenario, withAttempt, withConclusions, withFailedStep, withoutJob } from './fixtures/pr-watch.mjs';
import { VERDICTS } from './pr-classify.mjs';

const RUN = 44713195235;
const SHARD = 'visual-and-axe (2)';

const specimen = () => scenario('shard-timed-out');
const secondLook = (bundle) => judge(bundle, { previous: judge(bundle).observe });
const conclusionsOf = (bundle) =>
  Object.fromEntries(bundle.jobs.jobs.map(({ name, conclusion }) => [name, conclusion]));

test('the specimen is run 44713195235 as GitHub reported it: one shard cancelled at 20m16s and no job failed', () => {
  const bundle = specimen();
  const shard = bundle.jobs.jobs.find(({ name }) => name === SHARD);

  assert.equal(bundle.runs.workflow_runs[0].id, RUN);
  assert.equal(bundle.runs.workflow_runs[0].run_attempt, 1);
  assert.equal((Date.parse(shard.completed_at) - Date.parse(shard.started_at)) / 1000, 20 * 60 + 16);
  assert.deepEqual(conclusionsOf(bundle), {
    changes: 'success',
    'types-and-units': 'success',
    'regen-baselines': 'skipped',
    build: 'success',
    'visual-and-axe (1)': 'success',
    'visual-and-axe (2)': 'cancelled',
    'cheap-gates': 'success',
    'visual-and-axe (3)': 'success',
    'all required jobs passed': 'failure',
    'deploy-preview': 'skipped',
    'cancel-on-failure': 'skipped',
  });
});

test('the first look at a shard that died on its own is unsettled and carries what was seen', () => {
  const outcome = judge(specimen());

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'inconclusive-cancel');
  assert.equal(outcome.observe, `cancelled:${specimen().pullRequest.head.sha}:${RUN}:1`);
});

test('the second look at the same attempt reruns the run instead of escalating', () => {
  const outcome = secondLook(specimen());

  assert.equal(outcome.verdict, 'rerun');
  assert.equal(outcome.reason, 'self-cancelled');
  assert.equal(outcome.kind, null);
  assert.equal(outcome.observe, '');
  assert.ok(VERDICTS.includes(outcome.verdict), outcome.verdict);
  assert.deepEqual(Object.keys(outcome).sort(), ['evidence', 'kind', 'observe', 'reason', 'verdict']);
  assert.deepEqual(outcome.evidence, {
    head: specimen().pullRequest.head.sha,
    run: { id: RUN, attempt: 1 },
    jobs: [SHARD],
  });
});

test('a run already attempted twice, by whoever started the second, is not rerun a second time', () => {
  const outcome = secondLook(withAttempt(specimen(), 2));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'rerun-cap');
  assert.equal(outcome.kind, 'no-convergence');
  assert.deepEqual(outcome.evidence.run, { id: RUN, attempt: 2 });
  assert.deepEqual(outcome.evidence.jobs, [SHARD]);
});

test('the first look at the second attempt is unsettled again, because the cancellation it carries is a new one', () => {
  const rerun = withAttempt(specimen(), 2);
  const outcome = judge(rerun, { previous: judge(specimen()).observe });

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.observe, `cancelled:${specimen().pullRequest.head.sha}:${RUN}:2`);
});

const PERSON = { 'cancel-on-failure': 'cancelled', 'deploy-preview': 'cancelled' };

test('a run a person cancelled has the same shard, and is still a hard stop on the second look', () => {
  const outcome = secondLook(withConclusions(specimen(), PERSON));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'inconclusive-cancel');
  assert.equal(outcome.kind, 'hard-stop');
});

test('a run cancelled by force, which leaves no cancel-on-failure and no deploy-preview, is a hard stop too', () => {
  const forced = withoutJob(withoutJob(specimen(), 'cancel-on-failure'), 'deploy-preview');
  const outcome = secondLook(forced);

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'inconclusive-cancel');
  assert.equal(outcome.kind, 'hard-stop');
});

test('a deploy preview cancelled beside the dead shard is a hard stop, for cancel-on-failure never waited for it', () => {
  const outcome = secondLook(withConclusions(specimen(), { 'deploy-preview': 'cancelled' }));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'inconclusive-cancel');
  assert.equal(outcome.kind, 'hard-stop');
});

test('a cancel-on-failure that ran and succeeded cancelled the run for a failure this attempt does not show', () => {
  const outcome = secondLook(withConclusions(specimen(), { 'cancel-on-failure': 'success' }));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'inconclusive-cancel');
  assert.equal(outcome.kind, 'hard-stop');
});

for (const name of ['cancel-storm', 'dependency-failure']) {
  test(`${name}, a real failure with cancel-on-failure cancelled around it, is never rerun`, () => {
    const outcome = secondLook(scenario(name));

    assert.equal(outcome.verdict, 'escalate');
    assert.equal(outcome.reason, 'not-a-content-gate');
  });
}

test('a content gate that failed beside a cancelled shard is repaired and never rerun', () => {
  const failed = withFailedStep(
    withConclusions(specimen(), { 'visual-and-axe (3)': 'cancelled', 'cancel-on-failure': 'cancelled' }),
    'cheap-gates',
    'Run npm run gate:orphans'
  );
  const outcome = secondLook(failed);

  assert.equal(outcome.verdict, 'repairable');
  assert.equal(outcome.reason, 'content-gate');
});
