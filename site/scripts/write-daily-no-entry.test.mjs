import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

const WORKFLOW = parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'write-daily.yml'), 'utf8')
);
const { ceiling, write } = WORKFLOW.jobs;
const WEBHOOK = '${{ secrets.SLACK_WEBHOOK_URL }}';
const COMMAND = 'node scripts/spend-ended.mjs write --decision "$DECISION_FILE" --result "$WRITE_RESULT_FILE"';

const endedSteps = (job) => job.steps.filter(({ run = '' }) => run.includes('scripts/spend-ended.mjs'));
const stepNamed = (job, text) => job.steps.find(({ name = '' }) => name.includes(text));
const positionOf = (job, step) => job.steps.indexOf(step);
const endedBy = (job, ending) => endedSteps(job).filter(({ run }) => run.includes('spend-ended.mjs ' + ending));
const writeEnded = (outcome) =>
  endedBy(write, 'write').find(({ if: condition }) => condition.includes("outcome == '" + outcome + "'"));

test('four steps post the four endings, and no other step runs the command', () => {
  assert.equal(endedSteps(ceiling).length, 1);
  assert.equal(endedSteps(write).length, 3);
  assert.deepEqual(
    WORKFLOW.jobs.configured.steps.filter(({ run = '' }) => run.includes('spend-ended')),
    []
  );
});

test('every added step gets the Slack webhook from secrets and no other secret', () => {
  const steps = [...endedSteps(ceiling), ...endedSteps(write)];
  assert.equal(steps.length, 4);
  for (const step of steps) assert.deepEqual(step.env, { SLACK_WEBHOOK_URL: WEBHOOK }, step.name);
});

test('the ceiling ending posts on every day the ceiling job stopped the writer, after the notice is committed', () => {
  const [step] = endedBy(ceiling, 'ceiling');
  assert.equal(step.run.trim(), 'node scripts/spend-ended.mjs ceiling');
  assert.equal(step.if, "${{ !cancelled() && steps.ceiling.outputs.stopped == 'true' }}");
  assert.ok(positionOf(ceiling, step) > positionOf(ceiling, stepNamed(ceiling, 'commit the spend ceiling notice')));
});

test('the nothing-picked ending posts when the pick step succeeded with a decision other than write', () => {
  const [step] = endedBy(write, 'pick');
  assert.equal(step.run.trim(), 'node scripts/spend-ended.mjs pick --decision "$DECISION_FILE"');
  assert.equal(
    step.if,
    "${{ !cancelled() && steps.pick.outcome == 'success' && steps.pick.outputs.decision != 'write' }}"
  );
});

test('the no-entry ending posts when the write succeeded and the result lists no entry, and never when it lists one', () => {
  const counter = stepNamed(write, 'count the entries');
  assert.equal(counter.id, 'produced');
  assert.equal(counter.if, "${{ !cancelled() && steps.write.outcome == 'success' }}");
  assert.match(counter.run, /jq '\.entries \| length' "\$WRITE_RESULT_FILE"/);
  const step = writeEnded('success');
  assert.equal(step.run.trim(), COMMAND);
  assert.equal(
    step.if,
    "${{ !cancelled() && steps.write.outcome == 'success' && steps.produced.outputs.count == '0' }}"
  );
  assert.ok(positionOf(write, counter) < positionOf(write, step));
});

test('the failed-write ending runs after the ledger is committed and the failure escalated, whatever failed before it', () => {
  const step = writeEnded('failure');
  assert.equal(step.run.trim(), COMMAND);
  assert.equal(step.if, "${{ !cancelled() && steps.write.outcome == 'failure' }}");
  const commit = stepNamed(write, 'commit the ledger, which holds the spend of the failed write');
  const escalate = stepNamed(write, 'escalate a failed write');
  assert.ok(positionOf(write, step) > positionOf(write, commit));
  assert.ok(positionOf(write, step) > positionOf(write, escalate));
});
