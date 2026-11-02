import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUARANTINE_HOURS } from './autowriter-ledger.mjs';
import { BOT_EMAIL, HOLD_LABEL, classifyPullRequest, slugOfBranch } from './pr-classify.mjs';
import {
  classify,
  green,
  at,
  openPullRequest,
  classifyAltered,
  human,
  lastCommitBy,
  ledgerWith,
  decided,
} from './fixtures/pr-classify-helpers.mjs';
import { asInput, botIdentity, hoursAfterOpening, scenario, withPullRequest } from './fixtures/pr-watch.mjs';

test('green checks after the quarantine window is the one case that merges', () => {
  const bundle = green();
  const outcome = classify(bundle, at(bundle, QUARANTINE_HOURS + 1));

  assert.equal(outcome.verdict, 'merge');
  assert.equal(outcome.evidence.head, bundle.pullRequest.head.sha);
  assert.equal(outcome.evidence.pullRequest, 72);
});

test('the quarantine window includes its last instant and excludes the instant before', () => {
  const bundle = green();
  const lastInstant = hoursAfterOpening(bundle, QUARANTINE_HOURS);

  assert.equal(classify(bundle, { now: lastInstant }).verdict, 'merge');
  assert.equal(classify(bundle, { now: new Date(lastInstant.getTime() - 1) }).verdict, 'unsettled');
});

test('green checks inside the quarantine window wait, and say when the window ends', () => {
  const bundle = green();
  const outcome = classify(bundle, at(bundle, 1));

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'quarantine');
  assert.equal(outcome.evidence.mergeableAt, hoursAfterOpening(bundle, QUARANTINE_HOURS).toISOString());
});

test('the quarantine is measured from the pull request alone', () => {
  const bundle = withPullRequest(green(), { created_at: '2026-11-02T00:00:00Z' });

  assert.equal(classify(bundle, { now: new Date('2026-11-02T11:59:59Z') }).verdict, 'unsettled');
  assert.equal(classify(bundle, { now: new Date('2026-11-02T12:00:00Z') }).verdict, 'merge');
});

test('a pull request that is already merged is done, whatever its checks say', () => {
  const outcome = classifyAltered(scenario('cancel-storm'), { state: 'closed', merged: true });

  assert.equal(outcome.verdict, 'done');
  assert.equal(outcome.reason, 'merged');
});

test('a pull request the owner closed is blocked by a human, however green its checks are', () => {
  const bundle = green();
  const outcome = classifyAltered(bundle, { state: 'closed' }, at(bundle, 40));

  assert.equal(outcome.verdict, 'blocked-by-human');
  assert.equal(outcome.reason, 'closed');
});

test('the hold label blocks the merge after the window with every check green', () => {
  const bundle = green();
  const outcome = classifyAltered(bundle, { labels: [{ name: HOLD_LABEL }] }, at(bundle, 40));

  assert.equal(outcome.verdict, 'blocked-by-human');
  assert.equal(outcome.reason, 'hold-label');
});

test('a draft pull request is blocked by a human, because it cannot be merged and someone chose that', () => {
  const bundle = green();
  const outcome = classifyAltered(bundle, { draft: true }, at(bundle, 40));

  assert.equal(outcome.verdict, 'blocked-by-human');
  assert.equal(outcome.reason, 'draft');
});

test('a branch outside the autowriter prefix is not ours to merge', () => {
  const bundle = green();
  const head = { ...openPullRequest(bundle).head, ref: 'feat/somebody-elses' };

  assert.equal(classifyAltered(bundle, { head }, at(bundle, 40)).reason, 'foreign-branch');
});

test('a branch from a fork is not ours, even under the right name', () => {
  const bundle = green();
  const head = { ...openPullRequest(bundle).head, repo: { full_name: 'stranger/website' } };
  const outcome = classifyAltered(bundle, { head }, at(bundle, 40));

  assert.equal(outcome.verdict, 'blocked-by-human');
  assert.equal(outcome.reason, 'foreign-branch');
});

test('the slug of a branch is what follows the prefix, and a malformed one has none', () => {
  assert.equal(slugOfBranch('autowriter/what-is-an-aims'), 'what-is-an-aims');
  assert.equal(slugOfBranch('autowriter/Not_A_Slug'), null);
  assert.equal(slugOfBranch('autowriter/'), null);
  assert.equal(slugOfBranch('feat/x'), null);
});

test('a commit by a human on the branch stops the watcher, with the commit named', () => {
  const bundle = green();
  const outcome = classify(bundle, { commits: lastCommitBy(bundle, human), ...at(bundle, 40) });

  assert.equal(outcome.verdict, 'blocked-by-human');
  assert.equal(outcome.reason, 'human-commit');
  assert.equal(outcome.evidence.commit, bundle.pullRequest.head.sha);
  assert.equal(outcome.evidence.author, 'owner@example.com');
});

test('a commit the bot wrote but a human committed, as after a rebase by hand, is a human commit', () => {
  const bundle = green();
  const outcome = classify(bundle, { commits: lastCommitBy(bundle, botIdentity, human), ...at(bundle, 40) });

  assert.equal(outcome.reason, 'human-commit');
  assert.equal(outcome.evidence.author, BOT_EMAIL);
  assert.equal(outcome.evidence.committer, 'owner@example.com');
});

test('a human commit outranks a failing check, because the human has taken the branch over', () => {
  const bundle = scenario('content-gate-failure');

  assert.equal(classify(bundle, { commits: lastCommitBy(bundle, human) }).verdict, 'blocked-by-human');
});

test('a commit list that does not end at the current head is stale, never a judgement on who pushed', () => {
  const bundle = green();
  const outcome = classify(bundle, { commits: asInput(bundle).commits.slice(0, -1), ...at(bundle, 40) });

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'stale-head');
});

test('checks fetched for an older head than the pull request now has are stale and never merge', () => {
  const bundle = green();
  const moved = 'd'.repeat(40);
  const input = asInput(bundle, at(bundle, QUARANTINE_HOURS + 1));
  const outcome = classifyPullRequest({
    ...input,
    pullRequest: { ...input.pullRequest, head: { ...input.pullRequest.head, sha: moved } },
    commits: [...input.commits.slice(0, -1), { ...input.commits.at(-1), sha: moved }],
  });

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'stale-head');
  assert.equal(outcome.evidence.head, moved);
});

test('a ledger that already escalated makes the pull request done, so an escalation is never raised twice', () => {
  const outcome = classify(scenario('cancel-storm'), { ledger: ledgerWith(0, decided('escalated')) });

  assert.equal(outcome.verdict, 'done');
  assert.equal(outcome.reason, 'ledger-decided');
});

test('a ledger a human stopped makes the pull request done', () => {
  assert.equal(classify(green(), { ledger: ledgerWith(0, decided('stopped')) }).verdict, 'done');
});

test('an open ledger changes nothing about the checks', () => {
  assert.equal(classify(scenario('content-gate-failure'), { ledger: ledgerWith(1) }).verdict, 'repairable');
});
