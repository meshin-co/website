import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AGGREGATE_CHECK_NAME } from './ci-aggregate.mjs';
import { green, judge } from './fixtures/pr-judge.mjs';
import {
  scenario,
  withAggregate,
  withConclusions,
  withFailedStep,
  withHead,
  withJob,
  withNoChecksAtAll,
  withoutJob,
  withRun,
} from './fixtures/pr-watch.mjs';

test('cancelled jobs with no failure anywhere are unsettled on the first look and carry what was seen', () => {
  const cancelled = withConclusions(green(), { 'visual-and-axe (1)': 'cancelled', 'deploy-preview': 'skipped' });
  const outcome = judge(cancelled);

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'inconclusive-cancel');
  assert.match(outcome.observe, /^cancelled:[0-9a-f]{40}:41360101540:1$/);
});

test('the same cancellation seen again on the same run attempt is a hard stop', () => {
  const cancelled = withConclusions(green(), { 'visual-and-axe (1)': 'cancelled', 'deploy-preview': 'skipped' });
  const first = judge(cancelled);
  const second = judge(cancelled, { previous: first.observe });

  assert.equal(second.verdict, 'escalate');
  assert.equal(second.reason, 'inconclusive-cancel');
  assert.equal(second.kind, 'hard-stop');
});

test('a cancellation recorded for another run attempt is not the first look repeating', () => {
  const cancelled = withConclusions(green(), { 'visual-and-axe (1)': 'cancelled', 'deploy-preview': 'skipped' });
  const outcome = judge(cancelled, { previous: `cancelled:${'a'.repeat(40)}:41360101540:1` });

  assert.equal(outcome.verdict, 'unsettled');
});

test('a red aggregate beside a cancelled sibling and no real failure is a cancellation, not a failure of the aggregate', () => {
  const cancelled = withAggregate(withConclusions(scenario('green'), { 'visual-and-axe (3)': 'cancelled' }), 'failure');
  const outcome = judge(cancelled);

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'inconclusive-cancel');
});

test('a prose-only pull request ran no content gate, so it is a hard stop and never green', () => {
  const outcome = judge(withAggregate(scenario('prose-only')));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'skipped-gate');
  assert.equal(outcome.kind, 'hard-stop');
  assert.deepEqual(outcome.evidence.jobs, [
    'build',
    'cheap-gates',
    'deploy-preview',
    'guard-mutations',
    'visual-and-axe',
  ]);
});

test('one required job reporting skipped in an otherwise green run is a hard stop', () => {
  const outcome = judge(withConclusions(green(), { 'cheap-gates': 'skipped' }));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'skipped-gate');
  assert.deepEqual(outcome.evidence.jobs, ['cheap-gates']);
});

test('a required job absent from a finished run is a hard stop, because absence proves nothing', () => {
  const outcome = judge(withoutJob(green(), 'deploy-preview'));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'missing-check');
  assert.deepEqual(outcome.evidence.jobs, ['deploy-preview']);
});

test('a required job that ends neutral is neither green nor a failure we can name', () => {
  const outcome = judge(withConclusions(green(), { build: 'neutral' }));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'unexpected-conclusion');
  assert.deepEqual(outcome.evidence.jobs, ['build']);
});

test('a run with no aggregate job is a hard stop, because the merge safety net did not run', () => {
  const outcome = judge(scenario('green'));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'missing-check');
  assert.deepEqual(outcome.evidence.jobs, [AGGREGATE_CHECK_NAME]);
});

test('the aggregate red while every real job is green stops the merge', () => {
  const outcome = judge(withAggregate(scenario('green'), 'failure'));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'unexpected-conclusion');
  assert.deepEqual(outcome.evidence.jobs, [AGGREGATE_CHECK_NAME]);
});

test('a finished run with no jobs and no check runs, as after a push with the default token, is a hard stop', () => {
  const outcome = judge(scenario('bot-push-no-checks'));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'run-without-jobs');
  assert.equal(outcome.kind, 'hard-stop');
});

test('a run waiting for approval has no jobs and never will, so it is a hard stop', () => {
  const outcome = judge(scenario('approval-required'));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'approval-required');
  assert.equal(outcome.kind, 'hard-stop');
});

test('zero check runs on the head commit are a hard stop on the first look and never green', () => {
  const outcome = judge(withNoChecksAtAll(green()));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'no-checks');
  assert.equal(outcome.kind, 'hard-stop');
  assert.equal(outcome.observe, '');
});

test('a run still in progress is unsettled and lists the jobs that have not finished', () => {
  const running = withRun(
    withJob(withJob(green(), 'deploy-preview', { status: 'in_progress', conclusion: null }), 'build', {
      status: 'queued',
      conclusion: null,
    }),
    { status: 'in_progress', conclusion: null }
  );
  const outcome = judge(running);

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'running');
  assert.deepEqual(outcome.evidence.pending, ['build', 'deploy-preview']);
});

test('a queued run with no jobs yet is unsettled, not a run without jobs', () => {
  const queued = withRun(scenario('bot-push-no-checks'), { status: 'queued', conclusion: null });

  assert.equal(judge(queued).verdict, 'unsettled');
  assert.equal(judge(queued).reason, 'running');
});

test('a finished run that still lists a job in progress is unsettled, never green', () => {
  const outcome = judge(withJob(green(), 'build', { status: 'in_progress', conclusion: null }));

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'running');
});

test('a failure beside a job still running waits for the run to end, because the end of the run decides which siblings were cancelled', () => {
  const bundle = withJob(withFailedStep(green(), 'cheap-gates', 'Run npm run gate:content'), 'visual-and-axe (1)', {
    status: 'in_progress',
    conclusion: null,
  });

  assert.equal(judge(bundle).verdict, 'unsettled');
});

test('checks fetched for an older head than the pull request now has are stale, never a judgement', () => {
  const moved = withHead(scenario('cancel-storm'), scenario('bot-push-no-checks').pullRequest.head.sha);
  const outcome = judge(moved);

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'stale-head');
});

test('check runs belonging to another head commit are stale', () => {
  const bundle = green();
  const other = {
    ...bundle,
    checkRuns: {
      ...bundle.checkRuns,
      check_runs: bundle.checkRuns.check_runs.map((run) => ({ ...run, head_sha: 'b'.repeat(40) })),
    },
  };

  assert.equal(judge(other).reason, 'stale-head');
});

test('jobs belonging to another attempt of the run are stale', () => {
  const bundle = green();
  const reattempted = {
    ...bundle,
    jobs: { ...bundle.jobs, jobs: bundle.jobs.jobs.map((job) => ({ ...job, run_attempt: 2 })) },
  };
  const outcome = judge(reattempted);

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'other-run-attempt');
});

test('jobs belonging to another run are stale', () => {
  const bundle = green();
  const other = { ...bundle, jobs: { ...bundle.jobs, jobs: bundle.jobs.jobs.map((job) => ({ ...job, run_id: 1 })) } };

  assert.equal(judge(other).verdict, 'unsettled');
  assert.equal(judge(other).reason, 'other-run-attempt');
});

test('a run cancelled before any job started is a cancellation, unsettled once and then a hard stop', () => {
  const bundle = withRun(scenario('bot-push-no-checks'), { conclusion: 'cancelled' });
  const first = judge(bundle);
  const second = judge(bundle, { previous: first.observe });

  assert.equal(first.verdict, 'unsettled');
  assert.equal(first.reason, 'inconclusive-cancel');
  assert.equal(second.verdict, 'escalate');
});

test('when a pull request was reopened, the newest pull_request run is the one judged', () => {
  const bundle = green();
  const older = {
    ...bundle.runs.workflow_runs.find(({ event }) => event === 'pull_request'),
    id: 5,
    conclusion: 'failure',
  };
  const reopened = { ...bundle, runs: { ...bundle.runs, workflow_runs: [...bundle.runs.workflow_runs, older] } };

  assert.equal(judge(reopened).evidence.run.id, 41360101540);
});
