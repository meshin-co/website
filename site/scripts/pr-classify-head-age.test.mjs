import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ATTEMPT_CAP, QUARANTINE_HOURS } from './autowriter-ledger.mjs';
import { CATCH_UP_SUBJECT } from './derived-files.mjs';
import { CATCH_UP_CAP, CHAIN_LIMIT_HOURS } from './pr-classify.mjs';
import { classify, green, ledgerWith, stillRunning } from './fixtures/pr-classify-helpers.mjs';
import { asInput, hoursAfterOpening, scenario, withPullRequest } from './fixtures/pr-watch.mjs';

const MINUTE = 60_000;
const A_WEEK = 168;
const running = () => stillRunning(green());
const plus = (instant, ms) => new Date(instant.getTime() + ms);
const headCommitter = (bundle) => asInput(bundle).commits.at(-1).commit.committer;

function withHeadCommitted(bundle, committer, base = asInput(bundle).commits) {
  const head = base.at(-1);
  return [...base.slice(0, -1), { ...head, commit: { ...head.commit, committer } }];
}

const lookWithHead = (bundle, committer, now) =>
  classify(bundle, { commits: withHeadCommitted(bundle, committer), now });

const pushedAt = (bundle, instant) => ({ ...headCommitter(bundle), date: instant.toISOString() });

test('a head pushed minutes ago is not too old, however old the pull request is: the watcher waits for its CI', () => {
  const bundle = running();
  const pushed = hoursAfterOpening(bundle, A_WEEK);
  const outcome = lookWithHead(bundle, pushedAt(bundle, pushed), plus(pushed, 11.5 * MINUTE));

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'running');
});

test('pull request 137 on 2026-11-18: a head pushed at 13:05:14Z and looked at 13:09:06Z, a week after the opening, waits', () => {
  const bundle = withPullRequest(running(), { created_at: '2026-11-11T09:56:14Z' });
  const outcome = lookWithHead(
    bundle,
    pushedAt(bundle, new Date('2026-11-18T13:05:14Z')),
    new Date('2026-11-18T13:09:06Z')
  );

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'running');
});

test('a head that has not moved for the whole limit still escalates, so a chain that cannot converge still ends', () => {
  const bundle = running();
  const pushed = hoursAfterOpening(bundle, A_WEEK);
  const outcome = lookWithHead(
    bundle,
    pushedAt(bundle, pushed),
    plus(hoursAfterOpening(bundle, A_WEEK + CHAIN_LIMIT_HOURS), 1)
  );

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.kind, 'no-convergence');
  assert.equal(outcome.reason, 'chain-too-old');
});

test('the limit counts from the head to the look: at the limit it still waits, one millisecond past it ends', () => {
  const bundle = running();
  const committer = pushedAt(bundle, hoursAfterOpening(bundle, A_WEEK));
  const limit = hoursAfterOpening(bundle, A_WEEK + CHAIN_LIMIT_HOURS);

  assert.equal(lookWithHead(bundle, committer, limit).verdict, 'unsettled');
  assert.equal(lookWithHead(bundle, committer, plus(limit, 1)).reason, 'chain-too-old');
});

test('a pull request nobody pushed to keeps the limit it had, counted from its opening', () => {
  const bundle = running();
  const limit = hoursAfterOpening(bundle, CHAIN_LIMIT_HOURS);

  assert.equal(classify(bundle, { now: limit }).verdict, 'unsettled');
  assert.equal(classify(bundle, { now: plus(limit, 1) }).reason, 'chain-too-old');
});

test('a head committed long before the pull request was opened does not make the pull request old at once', () => {
  const bundle = running();
  const committer = pushedAt(bundle, hoursAfterOpening(bundle, -100));
  const outcome = lookWithHead(bundle, committer, hoursAfterOpening(bundle, 1));

  assert.equal(outcome.verdict, 'unsettled');
  assert.equal(outcome.reason, 'running');
});

for (const [name, date] of [
  ['has no date', undefined],
  ['has a date that is not a date', 'yesterday'],
]) {
  test(`a head commit that ${name} is aged from the opening of the pull request, so the limit still ends the chain`, () => {
    const bundle = running();
    const { date: ignored, ...undated } = headCommitter(bundle);
    const committer = date === undefined ? undated : { ...undated, date };
    const lookAtHour = (hours) => lookWithHead(bundle, committer, hoursAfterOpening(bundle, hours));

    assert.ok(ignored);
    assert.equal(lookAtHour(CHAIN_LIMIT_HOURS - 1).verdict, 'unsettled');
    assert.equal(lookAtHour(CHAIN_LIMIT_HOURS + 1).reason, 'chain-too-old');
  });
}

function withCatchUps(bundle, count) {
  const commits = asInput(bundle).commits;
  const tip = commits.at(-1);
  const caughtUp = (number) => ({
    ...tip,
    sha: String(number).repeat(40),
    parents: [{ sha: 'a'.repeat(40) }, { sha: 'b'.repeat(40) }],
    commit: { ...tip.commit, message: `${CATCH_UP_SUBJECT}a-slug on abc123${number}` },
  });
  return [...commits.slice(0, -1), ...Array.from({ length: count }, (_, at) => caughtUp(at + 1)), tip];
}

test('a pull request pushed to again and again is ended by the attempt cap, not by the clock: the push restarted the clock and the cap still bites', () => {
  const bundle = scenario('content-gate-failure');
  const pushed = hoursAfterOpening(bundle, A_WEEK);
  const outcome = classify(bundle, {
    commits: withHeadCommitted(bundle, pushedAt(bundle, pushed)),
    ledger: ledgerWith(ATTEMPT_CAP),
    now: plus(pushed, MINUTE),
  });

  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'attempt-cap');
});

test('and by the catch-up cap: a head pushed a minute ago on a week-old pull request that main moved under again is ended after the third catch-up', () => {
  const bundle = green();
  const pushed = hoursAfterOpening(bundle, A_WEEK);
  const caughtUp = withCatchUps(bundle, CATCH_UP_CAP);
  const outcome = classify(bundle, {
    commits: withHeadCommitted(bundle, pushedAt(bundle, pushed), caughtUp),
    drift: { behindBy: 2, paths: ['audits/routes.json'] },
    now: plus(pushed, MINUTE),
  });

  assert.ok(A_WEEK > QUARANTINE_HOURS);
  assert.equal(outcome.verdict, 'escalate');
  assert.equal(outcome.reason, 'catch-up-cap');
});
