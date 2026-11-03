import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { newLedger, validateLedger, verdictInForce } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { RESUME_CAP, resumableReasonOf } from './pr-resume.mjs';
import { OUTCOMES } from './repair-outcome.mjs';
import { MAIN_SHA, codeCommitAfter } from './fixtures/resume-world.mjs';
import { named, sweepWorld } from './fixtures/resume-sweep-harness.mjs';
import { HOUR, asInput, hoursAfterOpening, scenario } from './fixtures/pr-watch.mjs';
import { callOf, green, harness, ledgerRecord, spentAttempts } from './fixtures/pr-watch-harness.mjs';

const escalationOf = async (options) => {
  const { run, calls } = await harness(options);
  const { action } = await run();
  const [, , put] = callOf(calls, 'putLedger');
  return { action, put, ledger: JSON.parse(put.text) };
};

const WATCHER_ESCALATIONS = [
  [
    'a job that is not a content gate failed',
    { bundle: scenario('dependency-failure') },
    'unrepairable',
    'not-a-content-gate',
  ],
  [
    'a cancelled run left a job that is not a content gate unexplained',
    { bundle: scenario('cancel-storm') },
    'unrepairable',
    'not-a-content-gate',
  ],
  [
    'the CI run waits for a person to approve it',
    { bundle: scenario('approval-required') },
    'hard-stop',
    'approval-required',
  ],
];

for (const [name, options, kind, reason] of WATCHER_ESCALATIONS) {
  test(`the escalation the watcher files when ${name} is kind ${kind} and reads as resumable for ${reason}`, async () => {
    const { action, ledger } = await escalationOf(options);

    assert.equal(action, 'escalated');
    assert.equal(ledger.escalations.at(-1).kind, kind);
    assert.equal(resumableReasonOf(ledger), reason);
    assert.match(
      ledger.escalations.at(-1).detail,
      new RegExp(`^The watcher judged head [0-9a-f]{40}: escalate, ${reason}\\.`)
    );
  });
}

const NEVER_RESUMABLE = [
  ['a job ran with no jobs inside it', { bundle: scenario('bot-push-no-checks') }],
  ['a required job was skipped, which GitHub counts as passed', { bundle: scenario('prose-only') }],
  ['a required check never appeared', { bundle: scenario('green') }],
  [
    'the attempt cap is spent and the content gate still fails',
    { bundle: scenario('content-gate-failure'), ledger: ledgerRecord({ attempts: spentAttempts }) },
  ],
];

for (const [name, options] of NEVER_RESUMABLE) {
  test(`when ${name}, the escalation the watcher files is never one the resume reads as resumable`, async () => {
    const { action, ledger } = await escalationOf(options);

    assert.equal(action, 'escalated');
    assert.equal(resumableReasonOf(ledger), null);
  });
}

for (const outcome of OUTCOMES.filter((candidate) => !['repaired', 'stale'].includes(candidate))) {
  test(`a repair that ended as ${outcome} files an escalation the resume never reads as resumable`, async () => {
    const { ledger } = await escalationOf({ bundle: green(), afterRepair: outcome });

    assert.equal(resumableReasonOf(ledger), null);
  });
}

const bundle = scenario('dependency-failure');
const pullRequest = asInput(bundle).pullRequest;
const hour = (hours) => hoursAfterOpening(bundle, hours);
const own = asInput(bundle);

async function watcherAt(hours, ledger) {
  const { run, calls } = await harness({ bundle, hours, ledger });
  const { action } = await run();
  assert.equal(action, 'escalated');
  const [, , put] = callOf(calls, 'putLedger');
  return { record: { value: JSON.parse(put.text), blobSha: 'after-watch', path: put.path }, path: put.path };
}

const sweepAt = (hours, record, commits) => {
  const world = sweepWorld({
    pulls: [pullRequest],
    ledgers: [record],
    branchCommits: { [pullRequest.number]: own.commits },
    main: commits,
    now: hour(hours),
  });
  return { ...world, run: () => world.sweep.run() };
};

const mainCommitAt = (hours, sha) => codeCommitAfter(sha, new Date(hour(hours).getTime() + HOUR / 2).toISOString());

test('a pull request nobody fixes is escalated, resumed, escalated and resumed again, and then stays escalated however often main changes', async () => {
  const first = await watcherAt(2, null);
  assert.equal(verdictInForce(first.record.value), true);

  const firstSweep = sweepAt(3, first.record, [mainCommitAt(2, 'a'.repeat(40))]);
  const [firstItem] = await firstSweep.run();
  assert.equal(firstItem.by, 'main-change');
  const afterFirst = JSON.parse(named(firstSweep.calls, 'putLedger')[0][2].text);
  assert.equal(verdictInForce(afterFirst), false);

  const second = await watcherAt(4, { value: afterFirst, blobSha: 'b', path: first.path });
  assert.equal(second.record.value.escalations.length, 2);
  assert.equal(verdictInForce(second.record.value), true);
  assert.deepEqual(second.record.value.resumes, afterFirst.resumes);

  const secondSweep = sweepAt(5, second.record, [mainCommitAt(4, 'b'.repeat(40))]);
  assert.equal((await secondSweep.run())[0].by, 'main-change');
  const afterSecond = JSON.parse(named(secondSweep.calls, 'putLedger')[0][2].text);

  const third = await watcherAt(6, { value: afterSecond, blobSha: 'c', path: first.path });
  assert.equal(third.record.value.escalations.length, 3);
  assert.equal(third.record.value.resumes.length, RESUME_CAP);
  assert.deepEqual(validateLedger(third.record.value).map(describeProblem), []);

  const thirdSweep = sweepAt(7, third.record, [mainCommitAt(6, 'c'.repeat(40)), mainCommitAt(4, 'd'.repeat(40))]);
  assert.deepEqual(await thirdSweep.run(), [{ kind: 'left', pullRequest: pullRequest.number, reason: 'cap-reached' }]);
  assert.equal(named(thirdSweep.calls, 'putLedger').length, 0);
});

test('a resumed pull request whose checks are green is merged by the watcher, and the ledger it records keeps the resume', async () => {
  const opened = Date.parse(green().pullRequest.created_at);
  const stamp = (hours) => new Date(opened + hours * HOUR).toISOString();
  const resumed = {
    ...newLedger({ slug: 'a-slug', runId: '41', pullRequest: 72 }),
    verdict: { state: 'escalated', reason: 'a job that is not a content gate failed', decidedAt: stamp(2) },
    escalations: [
      {
        id: 'esc-1',
        kind: 'unrepairable',
        title: 'a job that is not a content gate failed',
        detail: 'The watcher judged head aa: escalate, not-a-content-gate.',
        raisedAt: stamp(2),
        receipts: [{ channel: 'issue', attemptedAt: stamp(2), delivered: true, status: 201, issue: 9, error: null }],
      },
    ],
    resumes: [{ at: stamp(3), by: 'main-change', mainSha: MAIN_SHA, failedJobs: ['cheap-gates'] }],
  };
  const record = ledgerRecord(resumed);
  const { run, calls } = await harness({ bundle: green(), ledger: record, mergedLedger: record });
  const { action } = await run();
  const [, token, debt] = callOf(calls, 'putLedger');
  const recorded = JSON.parse(debt.text);

  assert.equal(action, 'merged');
  assert.equal(token, 'pat-secret-value');
  assert.equal(recorded.verdict.state, 'merged');
  assert.deepEqual(recorded.resumes, resumed.resumes);
  assert.deepEqual(validateLedger(recorded).map(describeProblem), []);
});
