import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUARANTINE_HOURS } from './autowriter-ledger.mjs';
import { HOLD_LABEL, classifyAfterRepair, classifyHandling, classifyPullRequest } from './pr-classify.mjs';
import { at, classify, decided, green, ledgerWith, openPullRequest } from './fixtures/pr-classify-helpers.mjs';
import { asInput, scenario } from './fixtures/pr-watch.mjs';

const DECIDED_AT = decided('escalated').decidedAt;

const resume = (instant, extra = {}) => ({
  at: instant,
  by: 'main-change',
  mainSha: 'c'.repeat(40),
  failedJobs: ['cheap-gates'],
  ...extra,
});

const escalatedThenResumed = (...resumes) => ({ ...ledgerWith(0, decided('escalated')), resumes });
const LATER = '2026-11-02T09:00:00.000Z';
const EARLIER = '2026-11-02T07:00:00.000Z';

const handlingOf = (bundle, ledger) =>
  classifyHandling({ pullRequest: openPullRequest(bundle), commits: asInput(bundle).commits, ledger });

test('an escalated pull request with no resume is still done, so an escalation is never raised twice', () => {
  const outcome = classify(green(), { ledger: ledgerWith(0, decided('escalated')) });

  assert.equal(outcome.verdict, 'done');
  assert.equal(outcome.reason, 'ledger-decided');
});

test('an escalated pull request resumed after its decision is judged on its checks again, and merges when they are green', () => {
  const bundle = green();
  const outcome = classify(bundle, {
    ...at(bundle, QUARANTINE_HOURS + 1),
    ledger: escalatedThenResumed(resume(LATER)),
  });

  assert.equal(outcome.verdict, 'merge');
  assert.equal(outcome.reason, 'green-after-quarantine');
});

test('a resumed pull request whose content gate fails is repairable, so the repair loop runs again', () => {
  const outcome = classify(scenario('content-gate-failure'), { ledger: escalatedThenResumed(resume(LATER)) });

  assert.equal(outcome.verdict, 'repairable');
});

test('a resumed pull request whose job that is not a content gate fails again is escalated again', () => {
  const outcome = classify(scenario('dependency-failure'), { ledger: escalatedThenResumed(resume(LATER)) });

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.kind, 'unrepairable');
});

test('a resume that is older than the decision does not lift it: the pull request is escalated again and done', () => {
  const outcome = classify(green(), { ledger: escalatedThenResumed(resume(EARLIER)) });

  assert.equal(outcome.verdict, 'done');
  assert.equal(outcome.reason, 'ledger-decided');
});

test('a resume at the very instant of the decision does not lift it', () => {
  assert.equal(classify(green(), { ledger: escalatedThenResumed(resume(DECIDED_AT)) }).reason, 'ledger-decided');
});

test('a resume one millisecond after the decision lifts it', () => {
  const lifted = classify(green(), { ledger: escalatedThenResumed(resume('2026-11-02T08:00:00.001Z')) });

  assert.notEqual(lifted.reason, 'ledger-decided');
});

test('a pull request resumed once and escalated again is done until it is resumed a second time', () => {
  const again = { ...ledgerWith(0, { state: 'escalated', reason: 'again', decidedAt: '2026-11-02T10:00:00.000Z' }) };
  const bundle = green();

  assert.equal(classify(bundle, { ledger: { ...again, resumes: [resume(LATER)] } }).reason, 'ledger-decided');
  assert.notEqual(
    classify(bundle, { ledger: { ...again, resumes: [resume(LATER), resume('2026-11-02T11:00:00.000Z')] } }).reason,
    'ledger-decided'
  );
});

test('the handling guards agree: a resumed ledger has no handling verdict, an unresumed escalated one is done', () => {
  assert.equal(handlingOf(green(), escalatedThenResumed(resume(LATER))), null);
  assert.equal(handlingOf(green(), ledgerWith(0, decided('escalated'))).reason, 'ledger-decided');
});

test('after a repair, a resumed pull request is judged again instead of being done', () => {
  const bundle = green();
  const input = {
    pullRequest: openPullRequest(bundle),
    commits: asInput(bundle).commits,
    outcome: 'repaired',
  };

  assert.equal(classifyAfterRepair({ ...input, ledger: escalatedThenResumed(resume(LATER)) }).reason, 'repaired');
  assert.equal(classifyAfterRepair({ ...input, ledger: ledgerWith(0, decided('escalated')) }).reason, 'ledger-decided');
});

test('a resume lifts the decision and nothing else: a closed pull request and a held one stay blocked', () => {
  const bundle = green();
  const judged = (patch) =>
    classifyPullRequest({
      ...asInput(bundle),
      pullRequest: { ...openPullRequest(bundle), ...patch },
      ledger: escalatedThenResumed(resume(LATER)),
    });

  assert.equal(judged({ state: 'closed' }).reason, 'closed');
  assert.equal(judged({ labels: [{ name: HOLD_LABEL }] }).reason, 'hold-label');
});
