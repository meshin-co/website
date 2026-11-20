import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ledgerWithResume, verdictInForce } from './autowriter-ledger.mjs';
import { CATCH_UP_SUBJECT } from './derived-files.mjs';
import { classifyPullRequest, foreignCommit } from './pr-classify.mjs';
import { RESUME_CAP, resumableReasonOf } from './pr-resume.mjs';
import { recordPath } from './record-layout.mjs';
import { HOUR } from './fixtures/pr-watch.mjs';
import { harness, writtenNames } from './fixtures/pr-watch-harness.mjs';
import { named, sweepWorld } from './fixtures/resume-sweep-harness.mjs';
import { MAIN_SHA, botCommit, capture, codeCommitAfter, ledgerRecord } from './fixtures/resume-world.mjs';

const { pullRequest, commits, checkRuns, runs, jobs, ledger, drift } = capture('no-checks-after-escalation');
const SWEPT_AT = new Date('2026-11-20T03:05:00.000Z');
const LEDGER_PATH = recordPath('ledger', ledger.slug, SWEPT_AT);
const RESUMED = ledgerWithResume(ledger, {
  at: SWEPT_AT.toISOString(),
  by: 'main-change',
  mainSha: MAIN_SHA,
  failedJobs: [],
});

const isCatchUp = ({ commit, parents }) => parents.length === 2 && commit.message.startsWith(CATCH_UP_SUBJECT);

const afterResume = () => {
  const head = botCommit('9'.repeat(40));
  return {
    pullRequest: { ...pullRequest, head: { ...pullRequest.head, sha: head.sha } },
    commits: [...commits, head],
    checkRuns,
    runs,
    jobs,
    ledger: RESUMED,
    previous: '',
    now: SWEPT_AT,
    drift,
  };
};

test('the capture is pull request 145 as the watcher met it: a head by the bot with no check run and no workflow run, behind main and in conflict with it', () => {
  assert.equal(commits.at(-1).sha, pullRequest.head.sha);
  assert.equal(foreignCommit(commits), undefined);
  assert.equal(checkRuns.total_count, 0);
  assert.equal(runs.total_count, 0);
  assert.equal(pullRequest.mergeable_state, 'dirty');
  assert.equal(commits.filter(isCatchUp).length, 1);
  assert.ok(drift.behindBy > 0);
});

test('the escalation the retired no-checks cap filed reads as resumable, and the resumes it has spent leave room for one more', () => {
  assert.equal(resumableReasonOf(ledger), 'no-checks-catch-up-cap');
  assert.ok(ledger.resumes.filter(({ by }) => by !== 'owner').length < RESUME_CAP);
});

test('the sweep resumes that pull request once main has changed in code after the verdict, which puts the verdict out of force', async () => {
  const { sweep, calls } = sweepWorld({
    pulls: [pullRequest],
    ledgers: [ledgerRecord(ledger, LEDGER_PATH)],
    branchCommits: { [pullRequest.number]: commits },
    main: [codeCommitAfter(MAIN_SHA, '2026-11-20T03:00:00.000Z')],
    now: SWEPT_AT,
  });
  const [item] = await sweep.run();

  assert.equal(item.kind, 'resumed');
  assert.equal(item.by, 'main-change');
  assert.deepEqual(JSON.parse(named(calls, 'putLedger')[0][2].text), RESUMED);
  assert.equal(verdictInForce(ledger), true);
  assert.equal(verdictInForce(RESUMED), false);
});

test('the watcher judges the bot commit that resume leaves, with no check run on a branch main is ahead of, as a catch-up and not as an escalation', () => {
  const judged = classifyPullRequest(afterResume());

  assert.equal(judged.verdict, 'catch-up');
  assert.equal(judged.reason, 'no-checks');
  assert.equal(judged.evidence.behindBy, drift.behindBy);
});

test('the watcher run on that head asks for the catch-up repair, files no escalation and pushes nothing to the branch', async () => {
  const input = afterResume();
  const { run, calls, requests, outputs } = await harness({
    bundle: input,
    commits: input.commits,
    drift,
    ledger: { value: RESUMED, blobSha: 'b'.repeat(40), path: LEDGER_PATH },
    hours: (SWEPT_AT - Date.parse(pullRequest.created_at)) / HOUR,
  });
  const { action, result } = await run();

  assert.equal(action, 'repair');
  assert.equal(result.reason, 'no-checks');
  assert.deepEqual(writtenNames(calls), []);
  assert.equal(requests.length, 0);
  assert.match(readFileSync(outputs, 'utf8'), /^repair=true\n.*kind=catch-up\n/ms);
});
