import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { AGGREGATE_CHECK_NAME, AGGREGATE_JOB, REQUIRED_JOBS, aggregateVerdict } from './ci-aggregate.mjs';

const SCRIPT = new URL('./ci-aggregate.mjs', import.meta.url).pathname;
const SITE = new URL('..', import.meta.url).pathname;

const needsOf = (code, overrides = {}) => {
  const ran = code === 'true';
  const results = {
    changes: 'success',
    'types-and-units': 'success',
    build: ran ? 'success' : 'skipped',
    'cheap-gates': ran ? 'success' : 'skipped',
    'visual-and-axe': ran ? 'success' : 'skipped',
    'deploy-preview': ran ? 'success' : 'skipped',
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(results)
      .filter(([, result]) => result !== undefined)
      .map(([job, result]) => [job, { result, outputs: job === 'changes' ? { code } : {} }])
  );
};

const withChangesOutput = (needs, outputs) => ({ ...needs, changes: { ...needs.changes, outputs } });

test('exports name the job, the check and the seven required jobs in workflow order', () => {
  assert.equal(AGGREGATE_JOB, 'all-required-jobs-passed');
  assert.equal(AGGREGATE_CHECK_NAME, 'all required jobs passed');
  assert.deepEqual(REQUIRED_JOBS, [
    'changes',
    'build',
    'types-and-units',
    'cheap-gates',
    'visual-and-axe',
    'deploy-preview',
  ]);
});

const passing = [
  ['prose pull request, only the always-on jobs ran', 'pull_request', needsOf('false')],
  ['prose push, only the always-on jobs ran', 'push', needsOf('false')],
  ['code pull request, everything green', 'pull_request', needsOf('true')],
  ['code push, deploy-preview skipped', 'push', needsOf('true', { 'deploy-preview': 'skipped' })],
  ['prose diff where a skippable job happened to succeed', 'pull_request', needsOf('false', { build: 'success' })],
];

for (const [label, event, needs] of passing) {
  test(`passes: ${label}`, () => {
    const verdict = aggregateVerdict({ needs, event });
    assert.deepEqual(verdict.problems, []);
    assert.equal(verdict.lines.length, 6);
  });
}

test('code pull request with deploy-preview skipped fails and says why', () => {
  const { problems } = aggregateVerdict({
    needs: needsOf('true', { 'deploy-preview': 'skipped' }),
    event: 'pull_request',
  });
  assert.deepEqual(problems, ['deploy-preview was skipped but had to run (the diff changed code on a pull request)']);
});

test('build skipped on a code diff fails and says why', () => {
  const { problems } = aggregateVerdict({ needs: needsOf('true', { build: 'skipped' }), event: 'push' });
  assert.deepEqual(problems, ['build was skipped but had to run (the diff changed code)']);
});

test('types-and-units skipped fails and says why', () => {
  const { problems } = aggregateVerdict({
    needs: needsOf('false', { 'types-and-units': 'skipped' }),
    event: 'push',
  });
  assert.deepEqual(problems, ['types-and-units was skipped but had to run (runs on every push and pull request)']);
});

for (const job of REQUIRED_JOBS) {
  test(`${job} failing fails the aggregate and names it`, () => {
    const { problems } = aggregateVerdict({ needs: needsOf('true', { [job]: 'failure' }), event: 'pull_request' });
    assert.ok(problems.includes(`${job} failed`), problems.join('; '));
  });

  test(`${job} cancelled fails the aggregate and names it, every other job green`, () => {
    const { problems } = aggregateVerdict({ needs: needsOf('true', { [job]: 'cancelled' }), event: 'pull_request' });
    assert.deepEqual(problems, [`${job} was cancelled`]);
  });
}

for (const job of ['build', 'cheap-gates', 'visual-and-axe', 'deploy-preview']) {
  test(`${job} cancelled on a prose diff is still a problem`, () => {
    const { problems } = aggregateVerdict({ needs: needsOf('false', { [job]: 'cancelled' }), event: 'pull_request' });
    assert.deepEqual(problems, [`${job} was cancelled`]);
  });

  test(`${job} failed on a prose diff is still a problem`, () => {
    const { problems } = aggregateVerdict({ needs: needsOf('false', { [job]: 'failure' }), event: 'pull_request' });
    assert.deepEqual(problems, [`${job} failed`]);
  });
}

test('changes failing fails once and does not pile skipped reports on the others', () => {
  const needs = needsOf('true', {
    changes: 'failure',
    build: 'skipped',
    'cheap-gates': 'skipped',
    'visual-and-axe': 'skipped',
    'deploy-preview': 'skipped',
  });
  needs.changes.outputs = {};
  const { problems } = aggregateVerdict({ needs, event: 'pull_request' });
  assert.deepEqual(problems, ['changes failed']);
});

test('changes cancelled fails once', () => {
  const needs = needsOf('false', { changes: 'cancelled' });
  needs.changes.outputs = {};
  const { problems } = aggregateVerdict({ needs, event: 'push' });
  assert.deepEqual(problems, ['changes was cancelled']);
});

test('a missing required key is a problem', () => {
  const { problems } = aggregateVerdict({ needs: needsOf('true', { 'cheap-gates': undefined }), event: 'push' });
  assert.deepEqual(problems, ['cheap-gates has no result in needs']);
});

for (const value of ['neutral', 'timed_out', '', 'Success']) {
  test(`result ${JSON.stringify(value)} on an expected job has no usable result`, () => {
    const { problems } = aggregateVerdict({ needs: needsOf('true', { build: value }), event: 'push' });
    assert.deepEqual(problems, [`build has no usable result (${value})`]);
  });

  test(`result ${JSON.stringify(value)} on a not-expected job is a problem`, () => {
    const { problems } = aggregateVerdict({ needs: needsOf('false', { build: value }), event: 'push' });
    assert.deepEqual(problems, [`build has no usable result (${value})`]);
  });
}

test('a result object without a result field has no usable result', () => {
  const needs = needsOf('true');
  needs.build = { outputs: {} };
  const { problems } = aggregateVerdict({ needs, event: 'push' });
  assert.deepEqual(problems, ['build has no usable result (undefined)']);
});

test('an extra job in needs must be success', () => {
  const ok = aggregateVerdict({
    needs: { ...needsOf('true', { 'deploy-preview': 'skipped' }), extra: { result: 'success', outputs: {} } },
    event: 'push',
  });
  assert.deepEqual(ok.problems, []);
  const skipped = aggregateVerdict({
    needs: { ...needsOf('true', { 'deploy-preview': 'skipped' }), extra: { result: 'skipped', outputs: {} } },
    event: 'push',
  });
  assert.deepEqual(skipped.problems, ['extra was skipped but had to run (it is not in the expectation table)']);
  const cancelled = aggregateVerdict({
    needs: { ...needsOf('true', { 'deploy-preview': 'skipped' }), extra: { result: 'cancelled', outputs: {} } },
    event: 'push',
  });
  assert.deepEqual(cancelled.problems, ['extra was cancelled']);
});

for (const [label, outputs] of [
  ['absent', {}],
  ['empty', { code: '' }],
  ['not a boolean word', { code: 'yes' }],
]) {
  test(`changes success with the code verdict ${label} names the classifier`, () => {
    const needs = withChangesOutput(needsOf('false'), outputs);
    const { problems } = aggregateVerdict({ needs, event: 'pull_request' });
    assert.ok(problems.includes('changes printed no code verdict'), problems.join('; '));
  });
}

test('one line per required job, with result and expectation', () => {
  const { lines } = aggregateVerdict({ needs: needsOf('false'), event: 'push' });
  assert.deepEqual(lines, [
    'changes  success  success',
    'build  skipped  skipped-ok',
    'types-and-units  success  success',
    'cheap-gates  skipped  skipped-ok',
    'visual-and-axe  skipped  skipped-ok',
    'deploy-preview  skipped  skipped-ok',
  ]);
});

const runCli = (env) =>
  spawnSync(process.execPath, [SCRIPT], { cwd: SITE, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

test('cli exits 0 and reports the count when everything is green', () => {
  const run = runCli({ NEEDS: JSON.stringify(needsOf('true')), EVENT_NAME: 'pull_request' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout.trim().split('\n').at(-1), /^aggregate: 6 jobs checked, 0 problems$/);
  assert.equal(run.stderr, '');
});

test('cli exits 1 when a dependency was cancelled and every other job succeeded', () => {
  const run = runCli({
    NEEDS: JSON.stringify(needsOf('true', { 'visual-and-axe': 'cancelled' })),
    EVENT_NAME: 'pull_request',
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^AGGREGATE visual-and-axe was cancelled$/m);
  assert.match(run.stdout.trim().split('\n').at(-1), /^aggregate: 6 jobs checked, 1 problems$/);
});

test('cli exits 1 and names a failed job on stderr', () => {
  const run = runCli({
    NEEDS: JSON.stringify(needsOf('true', { 'cheap-gates': 'failure' })),
    EVENT_NAME: 'push',
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /AGGREGATE cheap-gates failed/);
});

for (const [label, env] of [
  ['NEEDS absent', { EVENT_NAME: 'push' }],
  ['NEEDS not JSON', { NEEDS: '{not json', EVENT_NAME: 'push' }],
  ['NEEDS an array', { NEEDS: '[]', EVENT_NAME: 'push' }],
  ['NEEDS null', { NEEDS: 'null', EVENT_NAME: 'push' }],
  ['NEEDS a string', { NEEDS: '"success"', EVENT_NAME: 'push' }],
  ['EVENT_NAME absent', { NEEDS: JSON.stringify(needsOf('false')) }],
  ['EVENT_NAME empty', { NEEDS: JSON.stringify(needsOf('false')), EVENT_NAME: '' }],
]) {
  test(`cli exits 2 when ${label}`, () => {
    const run = runCli(env);
    assert.equal(run.status, 2);
    assert.match(run.stderr, /^AGGREGATE /m);
  });
}
