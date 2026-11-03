import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAIN_COMMIT_LIMIT,
  RESUME_CAP,
  RESUME_REASONS,
  failedJobsOf,
  mainChangeSince,
  mainCommitsAfterVerdict,
  resumableReasonOf,
  resumeDecision,
} from './pr-resume.mjs';
import { foreignCommit } from './pr-classify.mjs';
import {
  AFTER_VERDICT,
  BEFORE_VERDICT,
  DECIDED_AT,
  HEAD,
  MAIN_SHA,
  NOW,
  approvalHeld,
  botCommit,
  capture,
  codeCommitAfter,
  mainCommit,
  personCommit,
  proseCommitAfter,
  realLedger,
  resumeEntry,
  watcherDetail,
  withLastEscalation,
  withResumes,
  withVerdict,
} from './fixtures/resume-world.mjs';

const OWN_COMMITS = capture('escalated-pull-request').commits;
const decide = (input) =>
  resumeDecision({
    ledger: realLedger(),
    commitsOnBranch: OWN_COMMITS,
    mainChanges: [],
    forced: false,
    now: NOW,
    ...input,
  });
const resumed = (by) => ({ resume: true, by });
const left = (reason) => ({ resume: false, reason });
const EARLIER = ['2026-11-01T10:00:00.000Z', '2026-11-02T10:00:00.000Z'];
const earlierResumes = (...ways) => ways.map((by, index) => resumeEntry(EARLIER[index], { by }));

test('the cap is two automatic resumes, and the main commits read are at most thirty', () => {
  assert.equal(RESUME_CAP, 2);
  assert.equal(MAIN_COMMIT_LIMIT, 30);
});

test('the pull request the owner has on 2026-11-03, escalated with nothing resumable changed on main since, is left', () => {
  assert.deepEqual(decide({}), left('no-main-change-since-decision'));
});

test('the same pull request with a code commit on main after the verdict is resumed because main changed', () => {
  assert.deepEqual(decide({ mainChanges: [codeCommitAfter()] }), resumed('main-change'));
});

test('the commits of that pull request are all the bot, so the real capture is not human-touched', () => {
  assert.ok(OWN_COMMITS.length >= 2);
  assert.equal(foreignCommit(OWN_COMMITS), undefined);
});

const REASONS = [
  ['no ledger on the branch', { ledger: null }, 'not-escalated'],
  [
    'an open verdict',
    { ledger: withVerdict(realLedger(), { state: 'open', reason: null, decidedAt: null }) },
    'not-escalated',
  ],
  ['a merged verdict', { ledger: withVerdict(realLedger(), { state: 'merged' }) }, 'not-escalated'],
  ['a stopped verdict', { ledger: withVerdict(realLedger(), { state: 'stopped' }) }, 'not-escalated'],
  ['a discarded verdict', { ledger: withVerdict(realLedger(), { state: 'discarded' }) }, 'not-escalated'],
  [
    'a resume later than the verdict, so the pull request is already back in the loop',
    { ledger: withResumes(realLedger(), resumeEntry(AFTER_VERDICT)), mainChanges: [codeCommitAfter()] },
    'already-resumed',
  ],
  [
    'a spend ceiling escalation',
    { ledger: withLastEscalation(realLedger(), { kind: 'spend-ceiling' }), mainChanges: [codeCommitAfter()] },
    'not-resumable-kind',
  ],
  [
    'a credential escalation',
    { ledger: withLastEscalation(realLedger(), { kind: 'credential' }), mainChanges: [codeCommitAfter()] },
    'not-resumable-kind',
  ],
  [
    'a no-convergence escalation, which is the attempt cap spent',
    {
      ledger: withLastEscalation(realLedger(), { kind: 'no-convergence', detail: watcherDetail('attempt-cap') }),
      mainChanges: [codeCommitAfter()],
    },
    'not-resumable-kind',
  ],
  [
    'a hard stop that is a skipped required job',
    {
      ledger: withLastEscalation(realLedger(), { kind: 'hard-stop', detail: watcherDetail('skipped-gate') }),
      mainChanges: [codeCommitAfter()],
    },
    'not-resumable-kind',
  ],
  [
    'an unrepairable that the repair raised, which the article itself caused',
    {
      ledger: withLastEscalation(realLedger(), {
        detail:
          'The repair of pull request #84 ended as unrepairable: the findings cannot be repaired.\nRepair run: https://github.com/meshin-co/website/actions/runs/1',
      }),
      mainChanges: [codeCommitAfter()],
    },
    'not-resumable-kind',
  ],
  [
    'the watcher reason of a job that is not a content gate under the kind of a hard stop',
    { ledger: withLastEscalation(realLedger(), { kind: 'hard-stop' }), mainChanges: [codeCommitAfter()] },
    'not-resumable-kind',
  ],
  [
    'an escalation with no watcher line in its detail',
    { ledger: withLastEscalation(realLedger(), { detail: 'Failing: cheap-gates.' }), mainChanges: [codeCommitAfter()] },
    'not-resumable-kind',
  ],
  [
    'a ledger that is escalated with no escalation on it',
    { ledger: { ...realLedger(), escalations: [] }, mainChanges: [codeCommitAfter()] },
    'not-resumable-kind',
  ],
  [
    'a commit on the branch by a person',
    { commitsOnBranch: [...OWN_COMMITS, personCommit('d'.repeat(40))], mainChanges: [codeCommitAfter()] },
    'human-touched',
  ],
  [
    'a commit the GitHub web editor made, whose committer is GitHub',
    {
      commitsOnBranch: [
        {
          sha: 'd'.repeat(40),
          commit: { author: botCommit('x').commit.author, committer: { email: 'noreply@github.com' } },
        },
      ],
      mainChanges: [codeCommitAfter()],
    },
    'human-touched',
  ],
  [
    'two automatic resumes already made',
    {
      ledger: withResumes(realLedger(), ...earlierResumes('main-change', 'main-change')),
      mainChanges: [codeCommitAfter()],
    },
    'cap-reached',
  ],
  [
    'a held-run resume and a main-change resume already made',
    {
      ledger: withResumes(realLedger(), ...earlierResumes('approval-held', 'main-change')),
      mainChanges: [codeCommitAfter()],
    },
    'cap-reached',
  ],
  ['no commit on main at all', { mainChanges: [] }, 'no-main-change-since-decision'],
  [
    'a main commit older than the verdict, even a code one',
    { mainChanges: [codeCommitAfter(MAIN_SHA, BEFORE_VERDICT)] },
    'no-main-change-since-decision',
  ],
  [
    'a main commit at the very instant of the verdict',
    { mainChanges: [codeCommitAfter(MAIN_SHA, DECIDED_AT)] },
    'no-main-change-since-decision',
  ],
  ['a main commit that changed only prose', { mainChanges: [proseCommitAfter()] }, 'no-main-change-since-decision'],
  [
    'a main commit dated after now, which has not happened yet',
    { mainChanges: [codeCommitAfter(MAIN_SHA, '2026-11-05T00:00:00.000Z')] },
    'no-main-change-since-decision',
  ],
];

for (const [name, input, reason] of REASONS) {
  test(`${name} leaves the pull request, with the reason ${reason}`, () => {
    assert.deepEqual(decide(input), left(reason));
  });
}

test('every reason a decision can give is one of the six the design names, and each of the six is given somewhere above', () => {
  assert.deepEqual(RESUME_REASONS, [
    'not-escalated',
    'not-resumable-kind',
    'cap-reached',
    'no-main-change-since-decision',
    'human-touched',
    'already-resumed',
  ]);
  const given = new Set(REASONS.map(([, input]) => decide(input).reason));
  assert.deepEqual([...given].sort(), [...RESUME_REASONS].sort());
});

test('the reasons are checked in an order that names the most basic one: a person and a spent cap together say human-touched', () => {
  const both = {
    ledger: withResumes(realLedger(), ...earlierResumes('main-change', 'main-change')),
    commitsOnBranch: [personCommit('d'.repeat(40))],
    mainChanges: [codeCommitAfter()],
  };

  assert.deepEqual(decide(both), left('human-touched'));
  assert.deepEqual(
    decide({ ...both, ledger: withLastEscalation(both.ledger, { kind: 'credential' }) }),
    left('not-resumable-kind')
  );
});

test('a code commit among prose ones is enough, wherever it sits in the list', () => {
  for (const mainChanges of [
    [codeCommitAfter(), proseCommitAfter()],
    [proseCommitAfter('1'.repeat(40)), codeCommitAfter(), proseCommitAfter('2'.repeat(40))],
  ]) {
    assert.deepEqual(decide({ mainChanges }), resumed('main-change'));
  }
});

test('a main commit one millisecond after the verdict counts, and one at or before it does not', () => {
  assert.deepEqual(
    decide({ mainChanges: [codeCommitAfter(MAIN_SHA, '2026-11-03T11:09:44.266Z')] }),
    resumed('main-change')
  );
  assert.deepEqual(
    decide({ mainChanges: [codeCommitAfter(MAIN_SHA, DECIDED_AT)] }),
    left('no-main-change-since-decision')
  );
});

test('a main commit whose files could not be read counts as a change, because nobody can say it was prose', () => {
  assert.deepEqual(decide({ mainChanges: [mainCommit(MAIN_SHA, AFTER_VERDICT, null)] }), resumed('main-change'));
});

test('a commit with an empty file list counts as a change, as it does for the classifier of the CI run', () => {
  assert.deepEqual(decide({ mainChanges: [mainCommit(MAIN_SHA, AFTER_VERDICT, [])] }), resumed('main-change'));
});

const manyProse = (count) =>
  Array.from({ length: count }, (_, index) => proseCommitAfter(String(index + 1).padStart(40, '0')));

test('thirty prose commits since the verdict are not a change, and thirty-one are: more than thirty counts as changed', () => {
  assert.deepEqual(decide({ mainChanges: manyProse(30) }), left('no-main-change-since-decision'));
  assert.deepEqual(decide({ mainChanges: manyProse(31) }), resumed('main-change'));
});

test('commits older than the verdict do not count toward the thirty', () => {
  const old = Array.from({ length: 5 }, (_, index) =>
    proseCommitAfter(String(index + 1).padStart(40, '9'), BEFORE_VERDICT)
  );

  assert.deepEqual(decide({ mainChanges: [...manyProse(30), ...old] }), left('no-main-change-since-decision'));
});

test('the change that resumes a pull request is the newest commit that changed it, and the window leaves out the rest', () => {
  const newest = codeCommitAfter('9'.repeat(40), '2026-11-03T15:00:00.000Z');
  const older = codeCommitAfter('8'.repeat(40), '2026-11-03T12:00:00.000Z');
  const prose = proseCommitAfter('7'.repeat(40), '2026-11-03T16:00:00.000Z');
  const before = codeCommitAfter('6'.repeat(40), BEFORE_VERDICT);

  assert.equal(mainChangeSince(realLedger(), [prose, newest, older, before], NOW).sha, '9'.repeat(40));
  assert.equal(mainChangeSince(realLedger(), [prose, before], NOW), null);
  assert.deepEqual(
    mainCommitsAfterVerdict(realLedger(), [prose, newest, older, before], NOW).map(({ sha }) => sha[0]),
    ['7', '9', '8']
  );
});

test('when more than thirty commits landed, the newest one is the change, whatever its files were', () => {
  const commits = manyProse(31).map((commit) => ({ ...commit, files: null }));

  assert.equal(mainChangeSince(realLedger(), commits, NOW).sha, commits[0].sha);
});

test('a pull request whose run waits for approval is resumed at once, with no main change, as a held run', () => {
  assert.deepEqual(decide({ ledger: approvalHeld() }), resumed('approval-held'));
  assert.equal(resumableReasonOf(approvalHeld()), 'approval-required');
});

test('a held run is resumed at once only the first time: the second wait needs a main change like any other', () => {
  const again = withResumes(approvalHeld(), resumeEntry(EARLIER[0], { by: 'approval-held', mainSha: null }));

  assert.deepEqual(decide({ ledger: again }), left('no-main-change-since-decision'));
  assert.deepEqual(decide({ ledger: again, mainChanges: [codeCommitAfter()] }), resumed('main-change'));
});

test('a held run is still subject to a person on the branch, and to the cap', () => {
  assert.deepEqual(
    decide({ ledger: approvalHeld(), commitsOnBranch: [personCommit('d'.repeat(40))] }),
    left('human-touched')
  );
  const spent = withResumes(approvalHeld(), ...earlierResumes('main-change', 'main-change'));

  assert.deepEqual(decide({ ledger: spent }), left('cap-reached'));
});

test('the owner resumes a pull request whatever its kind, its branch and main, and it is recorded as the owner', () => {
  const cases = {
    'a kind that is never resumed': { ledger: withLastEscalation(realLedger(), { kind: 'credential' }) },
    'a person on the branch': { commitsOnBranch: [personCommit('d'.repeat(40))] },
    'a main that did not change': { mainChanges: [] },
    'prose on main only': { mainChanges: [proseCommitAfter()] },
  };
  for (const [name, input] of Object.entries(cases)) {
    assert.deepEqual(decide({ ...input, forced: true }), resumed('owner'), name);
  }
});

test('the owner cannot resume what is not escalated, what is already resumed, or what has spent the cap', () => {
  const alreadyResumed = withResumes(realLedger(), resumeEntry(AFTER_VERDICT));
  const spent = withResumes(realLedger(), ...earlierResumes('main-change', 'main-change'));

  assert.deepEqual(decide({ forced: true, ledger: null }), left('not-escalated'));
  assert.deepEqual(
    decide({ forced: true, ledger: withVerdict(realLedger(), { state: 'merged' }) }),
    left('not-escalated')
  );
  assert.deepEqual(decide({ forced: true, ledger: alreadyResumed }), left('already-resumed'));
  assert.deepEqual(decide({ forced: true, ledger: spent }), left('cap-reached'));
});

test('resumes by the owner do not count toward the cap of automatic ones', () => {
  const owners = withResumes(
    realLedger(),
    resumeEntry(EARLIER[0], { by: 'owner', mainSha: null }),
    resumeEntry(EARLIER[1], { by: 'owner', mainSha: null })
  );
  const oneAutomatic = withResumes(realLedger(), resumeEntry(EARLIER[0], { by: 'owner' }), resumeEntry(EARLIER[1]));

  assert.deepEqual(decide({ ledger: owners, mainChanges: [codeCommitAfter()] }), resumed('main-change'));
  assert.deepEqual(decide({ ledger: oneAutomatic, mainChanges: [codeCommitAfter()] }), resumed('main-change'));
});

test('a verdict made again after a resume binds again, and the cap counts every automatic resume of the pull request', () => {
  const again = withVerdict(withResumes(realLedger(), resumeEntry(EARLIER[0])), {
    decidedAt: '2026-11-03T14:00:00.000Z',
  });

  assert.deepEqual(
    decide({ ledger: again, mainChanges: [codeCommitAfter(MAIN_SHA, '2026-11-03T13:00:00.000Z')] }),
    left('no-main-change-since-decision')
  );
  assert.deepEqual(
    decide({ ledger: again, mainChanges: [codeCommitAfter(MAIN_SHA, '2026-11-03T15:00:00.000Z')] }),
    resumed('main-change')
  );
});

test('only the last escalation of a ledger decides its kind', () => {
  const first = realLedger().escalations[0];
  const credentialLast = { ...realLedger(), escalations: [first, { ...first, id: 'esc-2', kind: 'credential' }] };
  const resumableLast = {
    ...realLedger(),
    escalations: [
      { ...first, id: 'esc-1', kind: 'credential' },
      { ...first, id: 'esc-2' },
    ],
  };

  assert.equal(resumableReasonOf(credentialLast), null);
  assert.equal(resumableReasonOf(resumableLast), 'not-a-content-gate');
});

test('the failed jobs are the names in the Failing line, without their gate, as the watcher writes the line', () => {
  assert.deepEqual(failedJobsOf(realLedger().escalations[0]), [
    'cheap-gates',
    'visual-and-axe (1)',
    'visual-and-axe (2)',
  ]);
  assert.deepEqual(failedJobsOf({ detail: watcherDetail('approval-required') }), []);
  assert.deepEqual(failedJobsOf({ detail: watcherDetail('not-a-content-gate', ['Failing: build, build.']) }), [
    'build',
  ]);
  assert.deepEqual(
    failedJobsOf({ detail: watcherDetail('not-a-content-gate', ['Failing: cheap-gates (gate:links).']) }),
    ['cheap-gates']
  );
});

test('the head the watcher judged is not needed to read its reason, and a reason is read from the line only', () => {
  const noise = withLastEscalation(realLedger(), {
    detail: `see escalate, approval-required.\n${watcherDetail('not-a-content-gate')}`,
  });

  assert.equal(resumableReasonOf(noise), 'not-a-content-gate');
  assert.equal(HEAD.length, 40);
  assert.equal(MAIN_SHA.length, 40);
});
