import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ATTEMPT_CAP, QUARANTINE_HOURS } from './autowriter-ledger.mjs';
import { CHAIN_LIMIT_HOURS, VERDICTS } from './pr-classify.mjs';
import { classify, green, at, ledgerWith, stillRunning } from './fixtures/pr-classify-helpers.mjs';
import { scenario, withAggregate, withNoChecksAtAll } from './fixtures/pr-watch.mjs';

test('a failing content gate with no attempts used is repairable and names the gate and the head judged', () => {
  const bundle = scenario('content-gate-failure');
  const outcome = classify(bundle);

  assert.equal(outcome.verdict, 'repairable');
  assert.equal(outcome.evidence.failing[0].gate, 'gate:content');
  assert.equal(outcome.evidence.head, bundle.pullRequest.head.sha);
});

test('the attempts the ledger records are what the cap counts', () => {
  const outcome = classify(scenario('content-gate-failure'), { ledger: ledgerWith(ATTEMPT_CAP) });

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.kind, 'no-convergence');
  assert.equal(outcome.reason, 'attempt-cap');
});

test('the real cancel storm is an unrepairable escalation naming both failed shards', () => {
  const outcome = classify(scenario('cancel-storm'));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.kind, 'unrepairable');
  assert.deepEqual(
    outcome.evidence.failing.map(({ job }) => job),
    ['visual-and-axe (1)', 'visual-and-axe (2)']
  );
});

test('zero check runs on the head commit stop and escalate, even after the quarantine window', () => {
  const bundle = withNoChecksAtAll(green());
  const outcome = classify(bundle, at(bundle, QUARANTINE_HOURS + 1));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.kind, 'hard-stop');
});

test('no input that carries less than every required check green ever merges, however late it is read', () => {
  const unproven = [
    'prose-only',
    'bot-push-no-checks',
    'approval-required',
    'cancel-storm',
    'content-gate-failure',
    'dependency-failure',
  ].flatMap((name) => [scenario(name), withAggregate(scenario(name))]);

  for (const bundle of [...unproven, withNoChecksAtAll(green()), scenario('green')]) {
    for (const hours of [QUARANTINE_HOURS + 1, 100]) {
      assert.notEqual(classify(bundle, at(bundle, hours)).verdict, 'merge', bundle.source.note);
    }
  }
});

test('a run still going for longer than the window plus a day is a loop that will not converge', () => {
  const bundle = stillRunning(green());
  const outcome = classify(bundle, at(bundle, CHAIN_LIMIT_HOURS + 1));

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.kind, 'no-convergence');
  assert.equal(outcome.reason, 'chain-too-old');
});

test('a run still going inside the limit stays unsettled', () => {
  const bundle = stillRunning(green());
  const outcome = classify(bundle, at(bundle, CHAIN_LIMIT_HOURS - 1));

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'running');
});

test('the age limit never hides a failure that is ready to be repaired', () => {
  const bundle = scenario('content-gate-failure');

  assert.equal(classify(bundle, at(bundle, CHAIN_LIMIT_HOURS + 100)).verdict, 'repairable');
});

test('the chain limit is the quarantine window plus a day', () => {
  assert.equal(CHAIN_LIMIT_HOURS, QUARANTINE_HOURS + 24);
});

test('every verdict is in the closed set and every outcome carries the same keys', () => {
  const bundles = [
    green(),
    scenario('prose-only'),
    scenario('cancel-storm'),
    scenario('content-gate-failure'),
    withNoChecksAtAll(green()),
  ];

  for (const bundle of bundles) {
    const outcome = classify(bundle);
    assert.ok(VERDICTS.includes(outcome.verdict), outcome.verdict);
    assert.deepEqual(Object.keys(outcome).sort(), ['evidence', 'kind', 'observe', 'reason', 'verdict']);
  }
});
