import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { BOT_IDENTITY, HOLD_LABEL } from './pr-classify.mjs';
import { MAIN_COMMIT_LIMIT } from './pr-resume.mjs';
import {
  AFTER_VERDICT,
  BEFORE_VERDICT,
  LEDGER_PATH,
  MAIN_SHA,
  NOW,
  SLUG,
  codeCommitAfter,
  ledgerOf,
  ledgerRecord,
  openPull,
  personCommit,
  pullOnBranch,
  proseCommitAfter,
  realLedger,
  resumeEntry,
  withLastEscalation,
  withResumes,
  watcherDetail,
} from './fixtures/resume-world.mjs';
import { OWN_COMMITS } from './fixtures/resume-world.mjs';
import { READER, WRITER, named, refusal, sweepWorld, writes } from './fixtures/resume-sweep-harness.mjs';

const resumable = (options = {}) => sweepWorld({ main: [codeCommitAfter()], ...options });
const resumedItem = { kind: 'resumed', pullRequest: 84, by: 'main-change', mainSha: MAIN_SHA, problems: [] };
const left = (reason, pullRequest = 84) => ({ kind: 'left', pullRequest, reason });
const EARLIER = ['2026-11-01T10:00:00.000Z', '2026-11-02T10:00:00.000Z'];
const FAILED_JOBS = ['cheap-gates', 'visual-and-axe (1)', 'visual-and-axe (2)'];

test('the pull request as it stands, escalated with nothing on main since, is left and nothing is written', async () => {
  const { sweep, calls } = sweepWorld({ main: [codeCommitAfter(MAIN_SHA, BEFORE_VERDICT)] });

  assert.deepEqual(await sweep.run(), [left('no-main-change-since-decision')]);
  assert.deepEqual(writes(calls), []);
});

test('a code commit on main after the verdict resumes it: the ledger gets one more entry, written as the bot with the PAT', async () => {
  const { sweep, calls } = resumable();

  assert.deepEqual(await sweep.run(), [resumedItem]);
  const [[, token, put]] = named(calls, 'putLedger');
  const written = JSON.parse(put.text);

  assert.equal(token, WRITER);
  assert.equal(put.path, LEDGER_PATH);
  assert.equal(put.blobSha, 'a1'.repeat(20));
  assert.equal(put.branch, `autowriter/${SLUG}`);
  assert.deepEqual(put.identity, BOT_IDENTITY);
  assert.match(put.message, new RegExp(`^chore\\(autowriter\\): resume ${SLUG} \\(main-change\\)$`));
  assert.deepEqual(written.resumes, [
    { at: NOW.toISOString(), by: 'main-change', mainSha: MAIN_SHA, failedJobs: FAILED_JOBS },
  ]);
  assert.deepEqual({ ...written, resumes: undefined }, { ...realLedger(), resumes: undefined });
  assert.equal(put.text, `${JSON.stringify(written, null, 2)}\n`);
  assert.deepEqual(validateLedger(written).map(describeProblem), []);
});

test('the issue is told with the read token and the watcher is dispatched with the bot token, after the ledger is written', async () => {
  const { sweep, calls } = resumable();
  await sweep.run();

  assert.deepEqual(writes(calls), ['putLedger', 'commentOnIssue', 'dispatchSuccessor']);
  assert.deepEqual(named(calls, 'commentOnIssue'), [
    ['commentOnIssue', READER, { number: 85, body: 'resumed: main-change, main e8874d4' }],
  ]);
  assert.deepEqual(named(calls, 'dispatchSuccessor'), [
    ['dispatchSuccessor', WRITER, { workflow: 'watch-pr.yml', ref: 'main', inputs: { pr: '84' } }],
  ]);
});

test('every read of the pull request and of main is made with the read token, so the bot token only ever writes', async () => {
  const { sweep, calls } = resumable();
  await sweep.run();

  const readers = calls.filter(([name]) => !['putLedger', 'dispatchSuccessor'].includes(name));
  assert.ok(readers.length >= 5, 'the sweep read too little to mean anything');
  for (const [name, token] of readers) assert.equal(token, READER, name);
});

test('a second sweep finds the resume newer than the verdict and does nothing, so a repeat is a no-op', async () => {
  const { sweep, calls } = resumable();
  await sweep.run();
  const writesAfterOne = writes(calls).length;

  assert.deepEqual(await sweep.run(), [left('already-resumed')]);
  assert.equal(writes(calls).length, writesAfterOne);
  assert.equal(named(calls, 'putLedger').length, 1);
});

test('a prose-only change on main does not resume it, and the sweep did read the files of that commit', async () => {
  const { sweep, calls } = sweepWorld({ main: [proseCommitAfter()] });

  assert.deepEqual(await sweep.run(), [left('no-main-change-since-decision')]);
  assert.deepEqual(writes(calls), []);
  assert.deepEqual(
    named(calls, 'readCommitFiles').map(([, , sha]) => sha),
    ['b'.repeat(40)]
  );
});

test('a code change that landed before the verdict does not resume it, and its files are not even read', async () => {
  const { sweep, calls } = sweepWorld({ main: [codeCommitAfter(MAIN_SHA, BEFORE_VERDICT)] });

  assert.deepEqual(await sweep.run(), [left('no-main-change-since-decision')]);
  assert.equal(named(calls, 'readCommitFiles').length, 0);
});

test('the change that is recorded is the newest commit that changed the graph, not a later prose commit and not an older code one', async () => {
  const newest = codeCommitAfter('9'.repeat(40), '2026-11-03T15:00:00.000Z');
  const older = codeCommitAfter('8'.repeat(40), '2026-11-03T12:00:00.000Z');
  const prose = proseCommitAfter('7'.repeat(40), '2026-11-03T16:00:00.000Z');
  const { sweep, calls } = sweepWorld({ main: [prose, newest, older] });

  assert.deepEqual(await sweep.run(), [{ ...resumedItem, mainSha: '9'.repeat(40) }]);
  assert.equal(JSON.parse(named(calls, 'putLedger')[0][2].text).resumes[0].mainSha, '9'.repeat(40));
  assert.equal(named(calls, 'commentOnIssue')[0][2].body, 'resumed: main-change, main 9999999');
});

const NEVER_RESUMED = [
  ['a hard stop that is a skipped required job', { kind: 'hard-stop', detail: watcherDetail('skipped-gate') }],
  ['a credential escalation', { kind: 'credential' }],
  ['a spend ceiling escalation', { kind: 'spend-ceiling' }],
  ['the attempt cap spent', { kind: 'no-convergence', detail: watcherDetail('attempt-cap') }],
  ['a repair that found the article unrepairable', { detail: 'The repair of pull request #84 ended as unrepairable.' }],
];

for (const [name, patch] of NEVER_RESUMED) {
  test(`${name} is never resumed, however much main changed`, async () => {
    const ledger = withLastEscalation(realLedger(), patch);
    const { sweep, calls } = sweepWorld({ ledgers: [ledgerRecord(ledger)], main: [codeCommitAfter()] });

    assert.deepEqual(await sweep.run(), [left('not-resumable-kind')]);
    assert.deepEqual(writes(calls), []);
  });
}

test('two automatic resumes are the cap: a third needs the owner, whatever main did', async () => {
  const spent = withResumes(realLedger(), resumeEntry(EARLIER[0]), resumeEntry(EARLIER[1]));
  const { sweep, calls } = sweepWorld({ ledgers: [ledgerRecord(spent)], main: [codeCommitAfter()] });

  assert.deepEqual(await sweep.run(), [left('cap-reached')]);
  assert.deepEqual(writes(calls), []);
});

test('a commit by a person on the branch stops it, because the pull request is theirs now', async () => {
  const { sweep, calls } = resumable({ branchCommits: { 84: [...OWN_COMMITS, personCommit('d'.repeat(40))] } });

  assert.deepEqual(await sweep.run(), [left('human-touched')]);
  assert.deepEqual(writes(calls), []);
});

const HELD = [
  ['the hold label', { labels: [{ name: HOLD_LABEL }] }],
  ['a draft', { draft: true }],
];

for (const [name, patch] of HELD) {
  test(`${name} on the pull request stops it as a person's, and the owner can still force it`, async () => {
    const stopped = resumable({ pulls: [openPull(patch)] });
    const forced = resumable({ pulls: [openPull(patch)] });

    assert.deepEqual(await stopped.sweep.run(), [left('human-touched')]);
    assert.deepEqual(writes(stopped.calls), []);
    assert.equal((await forced.sweep.run({ pullRequest: 84 }))[0].by, 'owner');
  });
}

test('the owner forces a pull request that every brake would hold, and it is recorded as the owner with no main commit', async () => {
  const ledger = withLastEscalation(realLedger(), { kind: 'credential' });
  const held = {
    ledgers: [ledgerRecord(ledger)],
    branchCommits: { 84: [...OWN_COMMITS, personCommit('d'.repeat(40))] },
  };
  const { sweep, calls } = sweepWorld({ ...held, main: [] });

  assert.deepEqual(await sweep.run({ pullRequest: 84 }), [
    { kind: 'resumed', pullRequest: 84, by: 'owner', mainSha: null, problems: [] },
  ]);
  assert.deepEqual(JSON.parse(named(calls, 'putLedger')[0][2].text).resumes, [
    { at: NOW.toISOString(), by: 'owner', mainSha: null, failedJobs: FAILED_JOBS },
  ]);
  assert.equal(named(calls, 'commentOnIssue')[0][2].body, 'resumed: owner');
  assert.deepEqual(named(calls, 'dispatchSuccessor')[0][2].inputs, { pr: '84' });
});

test('a forced run looks at that one pull request only: it lists no other pull request, reads no main and touches no issue', async () => {
  const { sweep, calls } = sweepWorld({
    main: [],
    issues: [{ number: 79, title: 'x', user: { login: 'github-actions[bot]' } }],
  });
  await sweep.run({ pullRequest: 84 });

  for (const name of ['listOpenPullRequests', 'listRecentCommits', 'listOpenIssues'])
    assert.equal(named(calls, name).length, 0, name);
  assert.deepEqual(
    named(calls, 'readPullRequest').map(([, , number]) => number),
    [84]
  );
});

test('the owner cannot force what is not escalated, what is resumed already, or what has spent the cap', async () => {
  const open = ledgerRecord({ ...realLedger(), verdict: { state: 'open', reason: null, decidedAt: null } });
  const again = ledgerRecord(withResumes(realLedger(), resumeEntry(AFTER_VERDICT)));
  const spent = ledgerRecord(withResumes(realLedger(), resumeEntry(EARLIER[0]), resumeEntry(EARLIER[1])));
  const cases = [
    [[open], 'not-escalated'],
    [[], 'not-escalated'],
    [[again], 'already-resumed'],
    [[spent], 'cap-reached'],
  ];

  for (const [ledgers, reason] of cases) {
    const { sweep, calls } = sweepWorld({ ledgers });
    assert.deepEqual(await sweep.run({ pullRequest: 84 }), [left(reason)]);
    assert.deepEqual(writes(calls), []);
  }
});

test('the owner naming a pull request that is closed, not an autowriter one, or from a fork is refused with a reason', async () => {
  const refused = [
    openPull({ state: 'closed' }),
    openPull({ head: { ...openPull().head, ref: 'feat/something' } }),
    openPull({ head: { ...openPull().head, repo: { full_name: 'someone/website' } } }),
  ];
  for (const pull of refused) {
    const { sweep, calls } = sweepWorld({ pulls: [pull] });
    await assert.rejects(
      () => sweep.run({ pullRequest: 84 }),
      /pull request #84 is not an open autowriter pull request of this repository/
    );
    assert.deepEqual(writes(calls), []);
  }
});

test('a pull request whose CI run waits for approval is resumed at once, as a held run, with nothing changed on main', async () => {
  const held = withLastEscalation(realLedger(), {
    kind: 'hard-stop',
    detail: watcherDetail('approval-required'),
  });
  const { sweep, calls } = sweepWorld({ ledgers: [ledgerRecord(held)], main: [] });

  assert.deepEqual(await sweep.run(), [
    { kind: 'resumed', pullRequest: 84, by: 'approval-held', mainSha: null, problems: [] },
  ]);
  assert.deepEqual(JSON.parse(named(calls, 'putLedger')[0][2].text).resumes[0].failedJobs, []);
  assert.equal(named(calls, 'commentOnIssue')[0][2].body, 'resumed: approval-held');
  assert.equal(named(calls, 'putLedger')[0][1], WRITER);
});

test('a ledger that records no delivered issue has no issue to tell, and that is not a failure', async () => {
  const undelivered = withLastEscalation(realLedger(), {
    receipts: [
      {
        channel: 'issue',
        attemptedAt: '2026-11-03T11:09:43.102Z',
        delivered: false,
        status: 500,
        issue: null,
        error: 'Server Error',
      },
    ],
  });
  const { sweep, calls } = sweepWorld({ ledgers: [ledgerRecord(undelivered)], main: [codeCommitAfter()] });

  assert.deepEqual(await sweep.run(), [resumedItem]);
  assert.equal(named(calls, 'commentOnIssue').length, 0);
  assert.equal(named(calls, 'dispatchSuccessor').length, 1);
});

test('when the dispatch fails after the ledger was written, it is reported with the command to start the watcher, and nothing is written twice', async () => {
  const denied = refusal(
    'POST',
    'actions/workflows/watch-pr.yml/dispatches',
    403,
    'Resource not accessible by personal access token'
  );
  const { sweep, calls } = resumable({ failWith: { dispatchSuccessor: denied } });
  const [item] = await sweep.run();

  assert.equal(item.kind, 'resumed');
  assert.equal(item.problems.length, 1);
  assert.match(
    item.problems[0],
    /the watcher was not dispatched: .*answered 403: Resource not accessible by personal access token/
  );
  assert.match(item.problems[0], /gh workflow run watch-pr\.yml -f pr=84/);
  assert.equal(named(calls, 'putLedger').length, 1);
  assert.deepEqual(await sweep.run(), [left('already-resumed')]);
  assert.equal(named(calls, 'putLedger').length, 1);
  assert.equal(named(calls, 'dispatchSuccessor').length, 1);
});

test('when the comment fails, the watcher is still dispatched and the failure is reported', async () => {
  const gone = refusal('POST', 'issues/85/comments', 404, 'Not Found');
  const { sweep, calls } = resumable({ failWith: { commentOnIssue: gone } });
  const [item] = await sweep.run();

  assert.equal(item.problems.length, 1);
  assert.match(item.problems[0], /the escalation issue #85 was not told: .*answered 404/);
  assert.equal(named(calls, 'dispatchSuccessor').length, 1);
});

test('when the ledger cannot be written nothing else is done, the failure names the pull request, and the next pull request is still resumed', async () => {
  const second = pullOnBranch('second-slug', 90);
  const secondLedger = ledgerRecord(ledgerOf('second-slug', 90, 91), 'audits/autowriter/2026/11/second-slug.json');
  const conflict = refusal('PUT', `contents/${LEDGER_PATH}`, 409, `${LEDGER_PATH} does not match`);
  const { sweep, calls } = sweepWorld({
    pulls: [openPull(), second],
    ledgers: [ledgerRecord(), secondLedger],
    main: [codeCommitAfter()],
    failWith: { putLedger: ({ path }) => (path === LEDGER_PATH ? conflict : undefined) },
  });
  const items = await sweep.run();

  assert.equal(items[0].kind, 'failed');
  assert.equal(items[0].pullRequest, 84);
  assert.match(items[0].message, /answered 409/);
  assert.deepEqual(items[1], { ...resumedItem, pullRequest: 90 });
  assert.deepEqual(
    named(calls, 'dispatchSuccessor').map(([, , { inputs }]) => inputs.pr),
    ['90']
  );
  assert.deepEqual(
    named(calls, 'commentOnIssue').map(([, , { number }]) => number),
    [91]
  );
});

test('pull requests that are not autowriter branches of this repository are not considered at all', async () => {
  const foreign = [
    openPull({ number: 70, head: { ...openPull().head, ref: 'feat/something' } }),
    openPull({ number: 71, head: { ...openPull().head, repo: { full_name: 'someone/website' } } }),
    openPull({ number: 72, head: { ...openPull().head, ref: 'autowriter/Not A Slug' } }),
  ];
  const { sweep, calls } = sweepWorld({ pulls: [...foreign, openPull()], main: [] });

  assert.deepEqual(await sweep.run(), [left('no-main-change-since-decision')]);
  assert.equal(named(calls, 'readLedgerAt').length, 1);
});

test('a pull request with no ledger on its branch, or an open verdict, is not escalated, and main is not read for it', async () => {
  const open = ledgerRecord({ ...realLedger(), verdict: { state: 'open', reason: null, decidedAt: null } });

  for (const ledgers of [[], [open]]) {
    const { sweep, calls } = sweepWorld({ ledgers, main: [codeCommitAfter()] });
    assert.deepEqual(await sweep.run(), [left('not-escalated')]);
    assert.equal(named(calls, 'listRecentCommits').length, 0);
  }
});

test('the ledger is read from the head of the branch, and main from its own branch name, at one more than the limit', async () => {
  const { sweep, calls } = sweepWorld({ main: [] });
  await sweep.run();

  assert.deepEqual(named(calls, 'readLedgerAt')[0][2], { slug: SLUG, ref: openPull().head.sha });
  assert.deepEqual(named(calls, 'listRecentCommits')[0][2], { branch: 'main', limit: MAIN_COMMIT_LIMIT + 1 });
});

test('two escalated pull requests share one read of main and one read of each commit', async () => {
  const second = pullOnBranch('second-slug', 90);
  const secondLedger = ledgerRecord(ledgerOf('second-slug', 90, 91), 'audits/autowriter/2026/11/second-slug.json');
  const { sweep, calls } = sweepWorld({
    pulls: [openPull(), second],
    ledgers: [ledgerRecord(), secondLedger],
    main: [proseCommitAfter()],
  });

  assert.deepEqual(await sweep.run(), [
    left('no-main-change-since-decision'),
    left('no-main-change-since-decision', 90),
  ]);
  assert.equal(named(calls, 'listRecentCommits').length, 1);
  assert.equal(named(calls, 'readCommitFiles').length, 1);
});

test('more than thirty commits since the verdict count as a change without reading a file of them', async () => {
  const many = Array.from({ length: MAIN_COMMIT_LIMIT + 1 }, (_, index) =>
    proseCommitAfter(
      String(index + 1).padStart(40, '0'),
      `2026-11-03T${String(12 + Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00.000Z`
    )
  );
  const { sweep, calls } = sweepWorld({ main: many.toReversed() });
  const [item] = await sweep.run();

  assert.equal(item.kind, 'resumed');
  assert.equal(item.mainSha, many.at(-1).sha);
  assert.equal(named(calls, 'readCommitFiles').length, 0);
});

test('the pull request list failing is reported and the issues are still looked at', async () => {
  const { sweep, calls } = sweepWorld({
    failWith: { listOpenPullRequests: refusal('GET', 'pulls?state=open&per_page=100', 500, 'Server Error') },
  });
  const items = await sweep.run();

  assert.equal(items[0].kind, 'failed');
  assert.match(items[0].message, /answered 500/);
  assert.equal(named(calls, 'listOpenIssues').length, 1);
});
