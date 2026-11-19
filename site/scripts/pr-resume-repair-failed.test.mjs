import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { HOLD_LABEL } from './pr-classify.mjs';
import { REPAIR_FAILURE_RESUMES } from './pr-resume-repair-failed.mjs';
import { RESUME_REASONS, resumableReasonOf, resumeDecision } from './pr-resume.mjs';
import { OUTCOMES } from './repair-outcome.mjs';
import {
  AFTER_VERDICT,
  FAILED_AGAIN_AT,
  MAIN_SHA,
  NOW,
  OWN_COMMITS,
  SECOND_FAILURE_ISSUE,
  codeCommitAfter,
  failedAgainAfter,
  ledgerRecord,
  openPull,
  personCommit,
  repairEndedAs,
  repairFailed,
  resumeEntry,
  withLastEscalation,
  withResumes,
} from './fixtures/resume-world.mjs';
import { READER, WRITER, named, refusal, sweepWorld, writes } from './fixtures/resume-sweep-harness.mjs';

const EARLIER = ['2026-11-01T10:00:00.000Z', '2026-11-02T10:00:00.000Z'];
const AFTER_SECOND_FAILURE = '2026-11-04T11:00:00.000Z';
const LATER = new Date('2026-11-04T12:00:00.000Z');

const decide = (input) =>
  resumeDecision({
    ledger: repairFailed(),
    commitsOnBranch: OWN_COMMITS,
    mainChanges: [codeCommitAfter()],
    forced: false,
    now: NOW,
    ...input,
  });
const resumed = (by) => ({ resume: true, by });
const left = (reason) => ({ resume: false, reason });
const failedAfter = (...resumes) => failedAgainAfter(withResumes(repairFailed(), ...resumes));
const failedAfterOneResume = () => failedAfter(resumeEntry(AFTER_VERDICT));

test('the escalation a failed repair files reads as resumable, for the reason repair-failed', () => {
  assert.equal(resumableReasonOf(repairFailed()), 'repair-failed');
});

for (const outcome of OUTCOMES.filter((candidate) => !['repaired', 'stale', 'failed'].includes(candidate))) {
  test(`a repair that ended as ${outcome} is not read as a failed repair: only the job that failed is resumable`, () => {
    assert.equal(resumableReasonOf(repairEndedAs(outcome)), null);
  });
}

test('a failed-repair text under a kind that is not a hard stop is not read as resumable', () => {
  assert.equal(resumableReasonOf(withLastEscalation(repairFailed(), { kind: 'credential' })), null);
});

test('a failed repair is resumed once main has changed since it, by the way every other main change is', () => {
  assert.deepEqual(decide({}), resumed('main-change'));
});

test('a failed repair is not resumed at once: with nothing changed on main the pull request stays escalated', () => {
  assert.deepEqual(decide({ mainChanges: [] }), left('no-main-change-since-decision'));
});

test('the cap on resuming a failed repair is one', () => {
  assert.equal(REPAIR_FAILURE_RESUMES, 1);
});

test('the same pull request that failed its repair again after the one resume is not resumed, and the refusal says the resume was spent', () => {
  const refusal = decide({
    ledger: failedAfterOneResume(),
    mainChanges: [codeCommitAfter(MAIN_SHA, '2026-11-04T10:30:00.000Z')],
  });

  assert.deepEqual(refusal, left('resume-spent'));
  assert.ok(RESUME_REASONS.includes('resume-spent'));
});

test('a resume the owner made by hand is the one resume: a failed repair after it stays escalated', () => {
  const byOwner = failedAfter(resumeEntry(AFTER_VERDICT, { by: 'owner', mainSha: null }));

  assert.deepEqual(decide({ ledger: byOwner }), left('resume-spent'));
});

test('a failed repair after a resume that was made for another reason is the first failed repair, so it is resumed once', () => {
  const another = withResumes(repairFailed(), resumeEntry(EARLIER[0]));

  assert.deepEqual(decide({ ledger: another }), resumed('main-change'));
});

test('the owner can still force a spent resume, because a person deciding is what the cap hands the pull request to', () => {
  assert.deepEqual(decide({ ledger: failedAfterOneResume(), forced: true }), resumed('owner'));
});

test('a failed repair still counts toward the two automatic resumes a pull request may have', () => {
  const full = withResumes(repairFailed(), resumeEntry(EARLIER[0]), resumeEntry(EARLIER[1]));

  assert.deepEqual(decide({ ledger: full }), left('cap-reached'));
});

test('a person on the branch stops a failed repair from being resumed, as it stops every other', () => {
  const commitsOnBranch = [...OWN_COMMITS, personCommit('d'.repeat(40))];

  assert.deepEqual(decide({ commitsOnBranch }), left('human-touched'));
});

const resumable = (options = {}) =>
  sweepWorld({ ledgers: [ledgerRecord(repairFailed())], main: [codeCommitAfter()], ...options });
const spentWorld = (options = {}) =>
  sweepWorld({
    ledgers: [ledgerRecord(failedAfterOneResume())],
    main: [codeCommitAfter(MAIN_SHA, AFTER_SECOND_FAILURE)],
    now: LATER,
    ...options,
  });
const resumedItem = { kind: 'resumed', pullRequest: 84, by: 'main-change', mainSha: MAIN_SHA, problems: [] };
const leftItem = (reason) => ({ kind: 'left', pullRequest: 84, reason });
const SPENT_TEXT = 'not resumed: the one resume a failed repair gets was already spent';

test('a pull request whose repair job failed is resumed by the sweep: the ledger is written as the bot with the PAT, the issue is told, the watcher is started', async () => {
  const { sweep, calls } = resumable();

  assert.deepEqual(await sweep.run(), [resumedItem]);
  assert.deepEqual(writes(calls), ['putLedger', 'commentOnIssue', 'dispatchSuccessor']);
  const [[, token, put]] = named(calls, 'putLedger');
  const written = JSON.parse(put.text);

  assert.equal(token, WRITER);
  assert.equal(named(calls, 'commentOnIssue')[0][1], READER);
  assert.equal(named(calls, 'dispatchSuccessor')[0][1], WRITER);
  assert.deepEqual(written.resumes, [{ at: NOW.toISOString(), by: 'main-change', mainSha: MAIN_SHA, failedJobs: [] }]);
  assert.deepEqual(validateLedger(written).map(describeProblem), []);
});

test('once resumed the pull request is not resumed again by a repeat of the sweep, which finds the chain the resume started', async () => {
  const { sweep, calls } = resumable();
  await sweep.run();

  assert.deepEqual(await sweep.run(), [leftItem('chain-alive')]);
  assert.equal(named(calls, 'putLedger').length, 1);
  assert.equal(named(calls, 'dispatchSuccessor').length, 1);
});

test('a second failed repair after that resume is refused as spent, and the only write is a note to the person on the escalation issue of that failure', async () => {
  const { sweep, calls } = spentWorld();

  assert.deepEqual(await sweep.run(), [leftItem('resume-spent')]);
  assert.deepEqual(writes(calls), ['commentOnIssue']);
  assert.deepEqual(named(calls, 'commentOnIssue'), [
    ['commentOnIssue', READER, { number: SECOND_FAILURE_ISSUE, body: SPENT_TEXT }],
  ]);
});

test('the note is made once: a repeat of the sweep finds it on the issue and writes nothing', async () => {
  const { sweep, calls, comments } = spentWorld();
  await sweep.run();

  assert.deepEqual(await sweep.run(), [leftItem('resume-spent')]);
  assert.equal(named(calls, 'commentOnIssue').length, 1);
  assert.deepEqual(
    named(calls, 'listIssueComments').map(([, token, args]) => [token, args]),
    [
      [READER, { number: SECOND_FAILURE_ISSUE }],
      [READER, { number: SECOND_FAILURE_ISSUE }],
    ]
  );
  assert.deepEqual(comments.get(SECOND_FAILURE_ISSUE), [{ body: SPENT_TEXT }]);
});

test('a comment that is not the note leaves the note to be made', async () => {
  const { sweep, calls, comments } = spentWorld();
  comments.set(SECOND_FAILURE_ISSUE, [{ body: 'looking at it' }]);
  await sweep.run();

  assert.equal(named(calls, 'commentOnIssue').length, 1);
});

test('a spent failed repair whose escalation delivered no issue has nobody to tell, and that is not a failure', async () => {
  const undelivered = withLastEscalation(failedAfterOneResume(), {
    receipts: [
      {
        channel: 'issue',
        attemptedAt: FAILED_AGAIN_AT,
        delivered: false,
        status: 500,
        issue: null,
        error: 'Server Error',
      },
    ],
  });
  const { sweep, calls } = sweepWorld({
    ledgers: [ledgerRecord(undelivered)],
    main: [codeCommitAfter(MAIN_SHA, AFTER_SECOND_FAILURE)],
    now: LATER,
  });

  assert.deepEqual(await sweep.run(), [leftItem('resume-spent')]);
  assert.deepEqual(writes(calls), []);
  assert.equal(named(calls, 'listIssueComments').length, 0);
});

test('when the note cannot be made the pull request is reported failed, so the run is red, and the next sweep makes it', async () => {
  const refused = refusal(
    'POST',
    `issues/${SECOND_FAILURE_ISSUE}/comments`,
    403,
    'Resource not accessible by integration'
  );
  const failWith = { commentOnIssue: refused };
  const { sweep, comments } = spentWorld({ failWith });
  const [item] = await sweep.run();

  assert.equal(item.kind, 'failed');
  assert.equal(item.pullRequest, 84);
  assert.match(item.message, /answered 403/);

  failWith.commentOnIssue = undefined;
  assert.deepEqual(await sweep.run(), [leftItem('resume-spent')]);
  assert.deepEqual(comments.get(SECOND_FAILURE_ISSUE), [{ body: SPENT_TEXT }]);
});

test('a person on the pull request is told nothing, as the pull request is theirs', async () => {
  const held = [
    ['a commit by a person', { branchCommits: { 84: [...OWN_COMMITS, personCommit('d'.repeat(40))] } }],
    ['the hold label', { pulls: [openPull({ labels: [{ name: HOLD_LABEL }] })] }],
    ['a draft', { pulls: [openPull({ draft: true })] }],
  ];

  for (const [name, options] of held) {
    const { sweep, calls } = spentWorld(options);

    assert.deepEqual(await sweep.run(), [leftItem('human-touched')], name);
    assert.deepEqual(writes(calls), [], name);
  }
});

test('the owner can still force a spent failed repair, and it is recorded as the owner', async () => {
  const { sweep, calls } = spentWorld();
  const [item] = await sweep.run({ pullRequest: 84 });

  assert.equal(item.kind, 'resumed');
  assert.equal(item.by, 'owner');
  assert.equal(named(calls, 'commentOnIssue')[0][2].body, 'resumed: owner');
});

test('a person who edited the pull request, or put it on hold, keeps a failed repair from being resumed', async () => {
  const held = [
    ['a commit by a person', { branchCommits: { 84: [...OWN_COMMITS, personCommit('d'.repeat(40))] } }],
    ['the hold label', { pulls: [openPull({ labels: [{ name: HOLD_LABEL }] })] }],
    ['a draft', { pulls: [openPull({ draft: true })] }],
  ];

  for (const [name, options] of held) {
    const { sweep, calls } = resumable(options);

    assert.deepEqual(await sweep.run(), [leftItem('human-touched')], name);
    assert.deepEqual(writes(calls), [], name);
  }
});
