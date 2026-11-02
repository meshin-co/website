import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

const TEXT = readFileSync(resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'write-daily.yml'), 'utf8');
const WORKFLOW = parse(TEXT);
const { ceiling, write } = WORKFLOW.jobs;
const KEY = 'AUTOWRITER_OPENAI_API_KEY';

const needsOf = (job) => [job?.needs ?? []].flat();
const stepsOf = (job) => job?.steps ?? [];
const text = (value) => JSON.stringify(value);
const spendStep = () => stepsOf(ceiling).find((step) => /scripts\/spend-ceiling\.mjs/.test(step.run ?? ''));

test('the workflow marks every step as unattended, so the seal and the Lighthouse record refuse', () => {
  assert.equal(WORKFLOW.env?.AUTOWRITER_UNATTENDED, '1');
});

test('the ceiling job runs before any job that spends, and waits only on the readiness check', () => {
  assert.ok(ceiling, 'no ceiling job');
  const order = Object.keys(WORKFLOW.jobs);
  assert.equal(order.indexOf('ceiling'), 1, 'only the readiness check comes before the ceiling');
  assert.deepEqual(needsOf(ceiling), ['configured']);
});

test('the write job needs the ceiling job and runs only when it did not stop the day', () => {
  assert.ok(needsOf(write).includes('ceiling'));
  assert.match(write.if, /needs\.ceiling\.outputs\.stopped\s*!=\s*'true'/);
  assert.match(write.if, /github\.ref == 'refs\/heads\/main'/);
});

test('the ceiling job hands its stopped answer from the step that runs the command', () => {
  const step = spendStep();
  assert.ok(step?.id, 'the spend-ceiling step needs an id');
  assert.equal(ceiling.outputs.stopped, `${'$'}{{ steps.${step.id}.outputs.stopped }}`);
});

test('the ceiling job checks out the whole history with the bot token, so branch tips are readable and a notice can be pushed', () => {
  const checkout = stepsOf(ceiling).find((step) => /^actions\/checkout@/.test(step.uses ?? ''));
  assert.equal(checkout.with['fetch-depth'], 0);
  assert.equal(checkout.with.token, `${'$'}{{ secrets.AUTOWRITER_PAT }}`);
  assert.ok(stepsOf(ceiling).some((step) => /^actions\/setup-node@/.test(step.uses ?? '')));
});

test('the command gets the token for the issue and the webhook for Slack, and nothing else secret', () => {
  const { env } = spendStep();
  assert.ok(env.GITHUB_TOKEN);
  assert.match(env.SLACK_WEBHOOK_URL, /secrets\.SLACK_WEBHOOK_URL/);
  assert.ok(!text(env).includes(KEY));
});

test('the notice ledger is committed to main only when the command wrote one, and only after the command ran', () => {
  const steps = stepsOf(ceiling);
  const commit = steps.find((step) => /commit-to-main\.mjs/.test(step.run ?? ''));
  assert.ok(commit, 'no step commits the notice');
  assert.match(commit.if, /notice\s*==\s*'written'/);
  assert.match(commit.run, /--path/);
  assert.ok(steps.indexOf(commit) > steps.indexOf(spendStep()));
});

test('the ceiling job never installs, so the check cannot be blocked by a broken dependency', () => {
  for (const step of stepsOf(ceiling)) assert.doesNotMatch(step.run ?? '', /npm (ci|install)|npx /);
  const used = stepsOf(ceiling)
    .map((step) => step.uses)
    .filter(Boolean);
  assert.deepEqual(
    used.map((entry) => entry.split('@')[0]),
    ['actions/checkout', 'actions/setup-node']
  );
});

test('the ceiling job holds no model key and no other secret of the writer', () => {
  const body = text(ceiling);
  for (const name of [KEY, 'GSC_SERVICE_ACCOUNT_JSON', 'GSC_PROPERTY', 'write:entry'])
    assert.ok(!body.includes(name), name);
});

const bindsKey = (job) =>
  [job?.env ?? {}, ...stepsOf(job).map((step) => step?.env ?? {})].some((env) =>
    Object.values(env).some((value) => String(value).includes(`secrets.${KEY} }}`))
  );

test('every job that binds the model key as a value runs after the ceiling job', () => {
  const holders = Object.entries(WORKFLOW.jobs).filter(([, job]) => bindsKey(job));
  assert.ok(holders.length > 0, 'no job binds the key, so this test would pass vacuously');
  for (const [name, job] of holders) {
    assert.ok(needsOf(job).includes('ceiling'), `${name} binds ${KEY} without waiting for the ceiling job`);
  }
});

test('a job that only tests whether the key is set never receives its value', () => {
  const readiness = WORKFLOW.jobs.configured;
  assert.ok(text(readiness).includes(KEY), 'the readiness job names the key');
  assert.equal(bindsKey(readiness), false, 'the readiness job must not put the key in any environment');
});

test('a failure of the ceiling command fails the job, so the write job is skipped and the run goes red', () => {
  for (const step of stepsOf(ceiling)) {
    assert.notEqual(step['continue-on-error'], true);
    assert.doesNotMatch(step.run ?? '', /\|\|\s*(true|:)|set \+e/);
  }
  assert.equal(ceiling['continue-on-error'], undefined);
});
