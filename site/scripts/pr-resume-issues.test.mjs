import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { capture, codeCommitAfter, openPull } from './fixtures/resume-world.mjs';
import { READER, named, refusal, sweepWorld, writes } from './fixtures/resume-sweep-harness.mjs';

const BOT = { login: 'github-actions[bot]', type: 'Bot' };
const PERSON = { login: 'meshin-dev', type: 'User' };
const TITLE = 'Autowriter pull request #78: a job that is not a content gate failed, so the loop may not repair it';

const realIssues = () => capture('open-issues').issues.filter((issue) => issue.pull_request === undefined);
const closedPulls = () => {
  const { merged, unmerged } = capture('closed-pull-requests');
  return { [merged.number]: merged, [unmerged.number]: unmerged };
};
const issue = (number, title, user = BOT) => ({ number, title, user, state: 'open' });
const onlyIssues = (issues, extra = {}) => sweepWorld({ pulls: [], issues, closed: closedPulls(), ...extra });
const closing = (calls) => named(calls, 'closeIssue').map(([, token, args]) => [token, args.number, args.reason]);

test('the escalation issue of a pull request that merged is told how, with the commit, and closed as completed', async () => {
  const { sweep, calls } = onlyIssues([
    issue(82, 'Autowriter pull request #81: a job that is not a content gate failed'),
  ]);

  assert.deepEqual(await sweep.run(), [{ kind: 'issue-closed', issue: 82, pullRequest: 81, merged: true }]);
  assert.deepEqual(named(calls, 'commentOnIssue'), [
    ['commentOnIssue', READER, { number: 82, body: 'merged as e8874d4' }],
  ]);
  assert.deepEqual(closing(calls), [[READER, 82, 'completed']]);
  assert.deepEqual(writes(calls), ['commentOnIssue', 'closeIssue']);
});

test('the escalation issue of a pull request closed without merging is told so and closed as not planned', async () => {
  const { sweep, calls } = onlyIssues([issue(79, TITLE)]);

  assert.deepEqual(await sweep.run(), [{ kind: 'issue-closed', issue: 79, pullRequest: 78, merged: false }]);
  assert.deepEqual(named(calls, 'commentOnIssue')[0][2], { number: 79, body: 'closed without merging' });
  assert.deepEqual(closing(calls), [[READER, 79, 'not_planned']]);
});

test('GitHub keeps a merge commit on a pull request closed without merging, so only the merged flag decides', async () => {
  const { unmerged } = capture('closed-pull-requests');

  assert.match(unmerged.merge_commit_sha, /^[0-9a-f]{40}$/);
  assert.equal(unmerged.merged, false);
  const { sweep, calls } = onlyIssues([issue(79, TITLE)]);
  await sweep.run();

  assert.doesNotMatch(named(calls, 'commentOnIssue')[0][2].body, /merged as/);
});

test('the escalation issue of a pull request that is still open is left alone', async () => {
  const { sweep, calls } = sweepWorld({
    pulls: [openPull()],
    issues: [issue(85, 'Autowriter pull request #84: a job that is not a content gate failed')],
    main: [],
  });

  await sweep.run();
  assert.deepEqual(writes(calls), []);
  assert.deepEqual(
    named(calls, 'readPullRequest').map(([, , number]) => number),
    [84]
  );
});

test('the open issues of 2026-11-03 as GitHub served them: the two of finished pull requests close and the open one stays', async () => {
  const { sweep, calls } = sweepWorld({
    pulls: [openPull()],
    issues: realIssues(),
    closed: closedPulls(),
    main: [],
  });

  assert.deepEqual(await sweep.run(), [
    { kind: 'left', pullRequest: 84, reason: 'no-main-change-since-decision' },
    { kind: 'issue-closed', issue: 82, pullRequest: 81, merged: true },
    { kind: 'issue-closed', issue: 79, pullRequest: 78, merged: false },
  ]);
  assert.deepEqual(closing(calls), [
    [READER, 82, 'completed'],
    [READER, 79, 'not_planned'],
  ]);
});

const NOT_ESCALATION_ISSUES = [
  ['an issue a person wrote with the same title', issue(200, TITLE, PERSON)],
  ['an issue another app wrote with the same title', issue(201, TITLE, { login: 'dependabot[bot]', type: 'Bot' })],
  ['an issue of the bot with a title that does not name a pull request', issue(202, 'Something else entirely')],
  ['an issue of the bot with no hash before the number', issue(203, 'Autowriter pull request 78: a job failed')],
  ['an issue of the bot with no colon after the number', issue(204, 'Autowriter pull request #78 a job failed')],
  ['an issue of the bot with the words in another case', issue(205, 'autowriter pull request #78: a job failed')],
  ['an issue of the bot with a number that is not one', issue(206, 'Autowriter pull request #7x: a job failed')],
  ['an issue of the bot that only mentions the title', issue(207, 'Re: Autowriter pull request #78: a job failed')],
];

for (const [name, planted] of NOT_ESCALATION_ISSUES) {
  test(`${name} is not an escalation issue, so it is neither read nor closed, while the real one beside it is`, async () => {
    const { sweep, calls } = onlyIssues([planted, issue(79, TITLE)]);

    assert.deepEqual(await sweep.run(), [{ kind: 'issue-closed', issue: 79, pullRequest: 78, merged: false }]);
    assert.deepEqual(closing(calls), [[READER, 79, 'not_planned']]);
    assert.equal(named(calls, 'readPullRequest').length, 1);
  });
}

test('an issue whose pull request GitHub does not know is left, and the issues after it are still closed', async () => {
  const { sweep, calls } = onlyIssues([issue(300, 'Autowriter pull request #999: a job failed'), issue(79, TITLE)]);

  assert.deepEqual(await sweep.run(), [
    { kind: 'issue-left', issue: 300, pullRequest: 999, reason: 'pull-request-not-found' },
    { kind: 'issue-closed', issue: 79, pullRequest: 78, merged: false },
  ]);
  assert.deepEqual(closing(calls), [[READER, 79, 'not_planned']]);
});

test('two issues of one pull request, from an escalation raised again, both close', async () => {
  const { sweep, calls } = onlyIssues([issue(80, TITLE), issue(79, TITLE)]);

  assert.deepEqual(
    (await sweep.run()).map(({ kind, issue: number }) => [kind, number]),
    [
      ['issue-closed', 80],
      ['issue-closed', 79],
    ]
  );
  assert.deepEqual(
    closing(calls).map(([, number]) => number),
    [80, 79]
  );
});

test('an issue that cannot be closed is reported, stays open for the next sweep, and the others are still closed', async () => {
  const denied = refusal('PATCH', 'issues/79', 403, 'Resource not accessible by integration');
  const { sweep, calls } = onlyIssues([issue(79, TITLE), issue(82, 'Autowriter pull request #81: a job failed')], {
    failWith: { closeIssue: ({ number }) => (number === 79 ? denied : undefined) },
  });
  const items = await sweep.run();

  assert.equal(items[0].kind, 'failed');
  assert.equal(items[0].subject, '#79');
  assert.match(items[0].message, /answered 403: Resource not accessible by integration/);
  assert.deepEqual(items[1], { kind: 'issue-closed', issue: 82, pullRequest: 81, merged: true });
  assert.equal(closing(calls).length, 2);
});

test('an issue that cannot be commented on is not closed, so the next sweep tries it again whole', async () => {
  const locked = refusal('POST', 'issues/79/comments', 403, 'Issue is locked');
  const { sweep, calls } = onlyIssues([issue(79, TITLE)], { failWith: { commentOnIssue: locked } });
  const [item] = await sweep.run();

  assert.equal(item.kind, 'failed');
  assert.equal(closing(calls).length, 0);
});

test('the issue list failing is reported, and the pull requests were still looked at first', async () => {
  const { sweep, calls } = sweepWorld({
    main: [codeCommitAfter()],
    failWith: { listOpenIssues: refusal('GET', 'issues?state=open&per_page=100', 500, 'Server Error') },
  });
  const items = await sweep.run();

  assert.equal(items[0].kind, 'resumed');
  assert.equal(items[1].kind, 'failed');
  assert.equal(items[1].subject, 'the open issues');
  assert.equal(named(calls, 'putLedger').length, 1);
});

test('an issue whose pull request cannot be read for a reason other than not existing is a failure, not a pull request that is gone', async () => {
  const down = refusal('GET', 'pulls/78', 500, 'Server Error');
  const { sweep, calls } = onlyIssues([issue(79, TITLE)], { failWith: { readPullRequest: down } });
  const [item] = await sweep.run();

  assert.equal(item.kind, 'failed');
  assert.equal(item.subject, '#79');
  assert.match(item.message, /answered 500: Server Error/);
  assert.equal(closing(calls).length, 0);
});
