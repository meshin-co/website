import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CATCH_UP_SUBJECT } from './derived-files.mjs';
import { NO_CHECKS_CATCH_UP_CAP } from './pr-classify.mjs';
import { repairOutputs } from './pr-watch-repair.mjs';
import { harness, readJson, writtenNames } from './fixtures/pr-watch-harness.mjs';
import { classify, green } from './fixtures/pr-classify-helpers.mjs';
import { asInput, scenario, withAggregate, withNoChecksAtAll } from './fixtures/pr-watch.mjs';

const BEHIND = { behindBy: 2, paths: ['site/src/pages/index.astro'] };
const CURRENT = { behindBy: 0, paths: [] };

const noChecks = () => withNoChecksAtAll(green());

function withCatchUps(bundle, count) {
  const { commits } = asInput(bundle);
  const tip = commits.at(-1);
  const caughtUp = (number) => ({
    ...tip,
    sha: String(number).repeat(40),
    parents: [{ sha: 'a'.repeat(40) }, { sha: 'b'.repeat(40) }],
    commit: { ...tip.commit, message: `${CATCH_UP_SUBJECT}a-slug on abc123${number}` },
  });
  return [...commits.slice(0, -1), ...Array.from({ length: count }, (_, at) => caughtUp(at + 1)), tip];
}

test('a pull request whose head has no check runs and that main has moved past is resumed by a catch-up', () => {
  const outcome = classify(noChecks(), { drift: BEHIND });

  assert.equal(outcome.verdict, 'catch-up');
  assert.equal(outcome.reason, 'no-checks');
  assert.equal(outcome.evidence.behindBy, 2);
  assert.deepEqual(
    repairOutputs({ action: 'repair', result: outcome, snapshot: asInput(noChecks()) }).kind,
    'catch-up'
  );
});

test('the same pull request, once a catch-up is already on it, is not resumed again and the refusal names the cap', () => {
  const bundle = noChecks();
  const outcome = classify(bundle, { drift: BEHIND, commits: withCatchUps(bundle, NO_CHECKS_CATCH_UP_CAP) });

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'no-checks-catch-up-cap');
  assert.equal(outcome.kind, 'hard-stop');
});

test('the cap holds however far main has moved or whether it has moved at all', () => {
  const bundle = noChecks();
  for (const drift of [BEHIND, CURRENT, { behindBy: 1, paths: null }]) {
    const outcome = classify(bundle, { drift, commits: withCatchUps(bundle, NO_CHECKS_CATCH_UP_CAP + 1) });

    assert.equal(outcome.verdict, 'escalate', JSON.stringify(drift));
    assert.equal(outcome.reason, 'no-checks-catch-up-cap', JSON.stringify(drift));
  }
});

test('a branch that main has not moved past stays a hard stop, because a catch-up would push nothing to start CI', () => {
  const outcome = classify(noChecks(), { drift: CURRENT });

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'no-checks');
  assert.equal(outcome.kind, 'hard-stop');
});

test('every other hard stop is still never resumed, however far main has moved and however few catch-ups there are', () => {
  const stops = {
    'run-without-jobs': scenario('bot-push-no-checks'),
    'approval-required': scenario('approval-required'),
    'not-a-content-gate': scenario('dependency-failure'),
    'unexpected-conclusion': withAggregate(scenario('green'), 'failure'),
  };
  for (const [reason, bundle] of Object.entries(stops)) {
    const outcome = classify(bundle, { drift: BEHIND });

    assert.equal(outcome.verdict, 'escalate', reason);
    assert.notEqual(outcome.verdict, 'catch-up', reason);
  }
  assert.equal(classify(scenario('bot-push-no-checks'), { drift: BEHIND }).reason, 'run-without-jobs');
  assert.equal(classify(scenario('approval-required'), { drift: BEHIND }).reason, 'approval-required');
});

test('the watcher asks the workflow to repair a resumed pull request and raises no escalation', async () => {
  const { run, calls, requests, outputs } = await harness({ bundle: noChecks(), drift: BEHIND });
  const { action, result } = await run();

  assert.equal(action, 'repair');
  assert.equal(result.reason, 'no-checks');
  assert.deepEqual(writtenNames(calls), []);
  assert.equal(requests.length, 0);
  assert.match(readFileSync(outputs, 'utf8'), /^repair=true\n.*kind=catch-up\n/ms);
});

test('the watcher escalates a pull request that was resumed once, and the issue says why the loop stopped', async () => {
  const bundle = noChecks();
  const { run, requests, ledgerPath } = await harness({
    bundle,
    drift: BEHIND,
    commits: withCatchUps(bundle, NO_CHECKS_CATCH_UP_CAP),
  });
  const { action, result } = await run();
  const { title, body } = requests[0].body;

  assert.equal(action, 'escalated');
  assert.equal(result.reason, 'no-checks-catch-up-cap');
  assert.match(title, /#72/);
  assert.match(title, /catch-up/i);
  assert.match(title, /no check runs/i);
  assert.match(body, /no-checks-catch-up-cap/);
  assert.equal(readJson(ledgerPath).escalations[0].kind, 'hard-stop');
});
