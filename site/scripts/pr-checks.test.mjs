import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ATTEMPT_CAP, CANCELLED_SIBLINGS, failingOf, green, judge } from './fixtures/pr-judge.mjs';
import {
  pullRequestRun,
  scenario,
  withAggregate,
  withConclusions,
  withFailedStep,
  withJob,
  withoutPullRequestRun,
} from './fixtures/pr-watch.mjs';

test('every required job succeeding beside a green aggregate is green, and names the run it read', () => {
  const outcome = judge(green());

  assert.equal(outcome.verdict, 'green');
  assert.deepEqual(outcome.evidence.run, { id: 41360101540, attempt: 1 });
  assert.deepEqual(outcome.evidence.jobs, [
    'build',
    'changes',
    'cheap-gates',
    'deploy-preview',
    'types-and-units',
    'visual-and-axe (1)',
    'visual-and-axe (2)',
    'visual-and-axe (3)',
  ]);
});

test('the head commit judged is carried in the evidence of every verdict', () => {
  const bundle = green();

  assert.equal(judge(bundle).evidence.head, bundle.pullRequest.head.sha);
  assert.equal(judge(scenario('cancel-storm')).evidence.head, scenario('cancel-storm').pullRequest.head.sha);
});

test('a failing push run beside a green pull_request run changes nothing, because only the pull_request run counts', () => {
  const bundle = green();
  const pushRunFailed = {
    ...bundle,
    runs: {
      ...bundle.runs,
      workflow_runs: bundle.runs.workflow_runs.map((run) =>
        run.event === 'push' ? { ...run, conclusion: 'failure' } : run
      ),
    },
  };

  assert.equal(judge(pushRunFailed).verdict, 'green');
});

test('a pull_request run of another workflow is never the run that counts', () => {
  const bundle = green();
  const ciRun = pullRequestRun(bundle);
  const lintRun = { ...ciRun, id: ciRun.id + 1, path: '.github/workflows/lint.yml', conclusion: 'failure' };
  const crowded = { ...bundle, runs: { ...bundle.runs, workflow_runs: [...bundle.runs.workflow_runs, lintRun] } };
  const outcome = judge(crowded);

  assert.equal(outcome.verdict, 'green');
  assert.equal(outcome.evidence.run.id, ciRun.id);
});

test('a green push run with no pull_request run is no evidence, so it is a hard stop on the first look', () => {
  const outcome = judge(withoutPullRequestRun(green()));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'no-pull-request-run');
  assert.equal(outcome.kind, 'hard-stop');
  assert.equal(outcome.observe, '');
});

test('two failing visual shards beside a cancelled cancel-on-failure are named by job and gate, and are unrepairable', () => {
  const outcome = judge(scenario('cancel-storm'));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'not-a-content-gate');
  assert.equal(outcome.kind, 'unrepairable');
  assert.deepEqual(failingOf(outcome), [
    ['visual-and-axe (1)', 'gate:visual'],
    ['visual-and-axe (2)', 'gate:visual'],
  ]);
});

test('one failing content gate among six cancelled siblings is repairable and names only the failing job', () => {
  const storm = withFailedStep(withConclusions(green(), CANCELLED_SIBLINGS), 'cheap-gates', 'Run npm run gate:content');
  const outcome = judge(storm);

  assert.equal(outcome.verdict, 'repairable');
  assert.equal(outcome.reason, 'content-gate');
  assert.deepEqual(failingOf(outcome), [['cheap-gates', 'gate:content']]);
});

test('the real content gate failure is repairable and carries the failing step name', () => {
  const outcome = judge(scenario('content-gate-failure'));

  assert.equal(outcome.verdict, 'repairable');
  assert.equal(outcome.evidence.failing[0].step, 'Run npm run gate:content');
});

test('a cheap-gates step with a custom name still fails as a content gate', () => {
  const outcome = judge(withFailedStep(green(), 'cheap-gates', 'route set never shrinks unexplained'));

  assert.equal(outcome.verdict, 'repairable');
  assert.deepEqual(failingOf(outcome), [['cheap-gates', null]]);
  assert.equal(outcome.evidence.failing[0].step, 'route set never shrinks unexplained');
});

test('the build failing in its own build step is the article and is repairable', () => {
  const outcome = judge(withFailedStep(green(), 'build', 'build, generate headers, measure budgets'));

  assert.equal(outcome.verdict, 'repairable');
});

test('a content job that fails while installing dependencies is infrastructure and unrepairable', () => {
  for (const step of ['Run npm ci', 'Run actions/download-artifact@v4', 'Run actions/checkout@v4']) {
    const outcome = judge(withFailedStep(green(), 'cheap-gates', step));

    assert.equal(outcome.verdict, 'escalate', step);
    assert.equal(outcome.reason, 'not-a-content-gate', step);
  }
});

test('the real dependency failure names both jobs that failed at npm ci', () => {
  const outcome = judge(scenario('dependency-failure'));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.kind, 'unrepairable');
  assert.deepEqual(
    outcome.evidence.failing.map(({ job, step }) => [job, step]),
    [
      ['build', 'Run npm ci'],
      ['types-and-units', 'Run npm ci'],
    ]
  );
});

test('a failing job that is not a content gate is unrepairable', () => {
  for (const job of ['deploy-preview', 'guard-mutations', 'types-and-units']) {
    assert.equal(judge(withFailedStep(green(), job, 'Run npm run something')).verdict, 'escalate', job);
  }
});

test('a job that failed with no failing step is unrepairable, because nothing says which gate it was', () => {
  const outcome = judge(withJob(green(), 'cheap-gates', { conclusion: 'failure' }));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'not-a-content-gate');
});

test('a timed out job is a failure and is named', () => {
  const outcome = judge(
    withFailedStep(
      withJob(green(), 'visual-and-axe (3)', { conclusion: 'timed_out' }),
      'cheap-gates',
      'Run npm run gate:links'
    )
  );

  assert.deepEqual(failingOf(outcome), [
    ['cheap-gates', 'gate:links'],
    ['visual-and-axe (3)', null],
  ]);
});

test('a content gate failure mixed with a failing visual shard is unrepairable, because one failure is not ours', () => {
  const mixed = withFailedStep(
    withFailedStep(green(), 'cheap-gates', 'Run npm run gate:content'),
    'visual-and-axe (2)',
    'Run npm run gate:visual'
  );
  const outcome = judge(mixed);

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'not-a-content-gate');
});

test('a content gate failure with the attempts spent is a loop that will not converge', () => {
  const outcome = judge(scenario('content-gate-failure'), { attemptsUsed: ATTEMPT_CAP });

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'attempt-cap');
  assert.equal(outcome.kind, 'no-convergence');
});

test('a content gate failure with one attempt left is still repairable', () => {
  assert.equal(judge(scenario('content-gate-failure'), { attemptsUsed: ATTEMPT_CAP - 1 }).verdict, 'repairable');
});

test('the aggregate going red beside a real failure is never named as the failing job', () => {
  const bundle = withAggregate(scenario('content-gate-failure'), 'failure');
  const outcome = judge(bundle);

  assert.equal(outcome.verdict, 'repairable');
  assert.deepEqual(failingOf(outcome), [['cheap-gates', 'gate:content']]);
});
