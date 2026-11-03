import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GitHubError } from './pr-github.mjs';
import {
  closeIssue,
  commentOnIssue,
  listOpenIssues,
  listOpenPullRequests,
  listRecentCommits,
  readBranchCommits,
  readCommitFiles,
  readPullRequest,
} from './pr-github.mjs';
import { apiAnswering, json } from './fixtures/github-fake.mjs';
import { capture } from './fixtures/resume-world.mjs';

const PAGE = 100;
const SHA = 'e8874d4602b5944138a0017d3d5e862c9e7a728e';
const answering = (body, status = 200) => apiAnswering(() => json(body, status));
const bodyOf = (call) => JSON.parse(call.body);
const filler = (count, make) => Array.from({ length: count }, (_, index) => make(index + 1));

test('the open pull requests are one request for the open ones, at the page size, and come back as served', async () => {
  const { pullRequest } = capture('escalated-pull-request');
  const { api, calls } = answering([pullRequest]);

  assert.deepEqual(await listOpenPullRequests(api), [pullRequest]);
  assert.deepEqual(
    calls.map(({ method, path }) => [method, path]),
    [['GET', 'pulls?state=open&per_page=100']]
  );
});

test('a full page of open pull requests is refused, because a second page would be silently ignored', async () => {
  const { api } = answering(filler(PAGE, (number) => ({ number })));

  await assert.rejects(
    () => listOpenPullRequests(api),
    /the open pull requests list is incomplete: reading more than one page is not supported/
  );
});

test('one pull request is read by its number, and a number GitHub does not know is an error that names the request', async () => {
  const { merged } = capture('closed-pull-requests');
  const found = answering(merged);

  assert.deepEqual(await readPullRequest(found.api, 81), merged);
  assert.equal(found.calls[0].path, 'pulls/81');
  await assert.rejects(
    () => readPullRequest(answering({ message: 'Not Found' }, 404).api, 9999),
    (error) => error instanceof GitHubError && error.status === 404 && /pulls\/9999/.test(error.message)
  );
});

test('the commits of a pull request are the first page of its commits, in the order GitHub gives them', async () => {
  const { commits } = capture('escalated-pull-request');
  const { api, calls } = answering(commits);

  assert.deepEqual(await readBranchCommits(api, 84), commits);
  assert.equal(calls[0].path, 'pulls/84/commits?per_page=100');
});

test('a full page of commits is refused, because a human commit could sit on a page nobody read', async () => {
  const { api } = answering(filler(PAGE, (number) => ({ sha: String(number) })));

  await assert.rejects(() => readBranchCommits(api, 84), /the commits list is incomplete/);
});

test('the open issues leave out the pull requests the issues list also returns, and keep their author', async () => {
  const { issues } = capture('open-issues');
  const { api, calls } = answering(issues);

  const listed = await listOpenIssues(api);

  assert.equal(calls[0].path, 'issues?state=open&per_page=100');
  assert.deepEqual(
    listed.map(({ number }) => number),
    [85, 82, 79]
  );
  assert.ok(
    issues.some((issue) => issue.pull_request !== undefined),
    'the capture holds no pull request to leave out'
  );
  assert.ok(listed.every(({ user }) => user.login === 'github-actions[bot]'));
});

test('a full page of issues is refused even when some of them are pull requests, because the page limit counts both', async () => {
  const { api } = answering(filler(PAGE, (number) => ({ number, pull_request: {} })));

  await assert.rejects(() => listOpenIssues(api), /the open issues list is incomplete/);
});

test('a comment is a POST of its body to the issue, and nothing else is sent', async () => {
  const { api, calls } = answering({ id: 1 }, 201);

  await commentOnIssue(api, { number: 85, body: 'resumed: main-change, main e8874d4' });

  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, 'issues/85/comments');
  assert.deepEqual(bodyOf(calls[0]), { body: 'resumed: main-change, main e8874d4' });
});

for (const reason of ['completed', 'not_planned']) {
  test(`an issue is closed as ${reason} with one PATCH that changes its state and its reason only`, async () => {
    const { api, calls } = answering({ number: 85, state: 'closed' });

    await closeIssue(api, { number: 85, reason });

    assert.equal(calls[0].method, 'PATCH');
    assert.equal(calls[0].path, 'issues/85');
    assert.deepEqual(bodyOf(calls[0]), { state: 'closed', state_reason: reason });
  });
}

test('the recent commits of a branch are asked for by branch and limit, and come back as a hash and a commit time', async () => {
  const { listed } = capture('main-commits');
  const { api, calls } = answering(listed);

  const recent = await listRecentCommits(api, { branch: 'main', limit: 31 });

  assert.equal(calls[0].path, 'commits?sha=main&per_page=31');
  assert.equal(recent.length, listed.length);
  assert.deepEqual(recent[0], { sha: listed[0].sha, committedAt: listed[0].commit.committer.date });
  assert.deepEqual(
    recent.map(({ sha }) => sha),
    listed.map(({ sha }) => sha)
  );
});

test('a branch name is encoded in the request, so a name with a slash cannot change the path', async () => {
  const { api, calls } = answering([]);

  await listRecentCommits(api, { branch: 'release/1 2', limit: 3 });

  assert.equal(calls[0].path, 'commits?sha=release%2F1%202&per_page=3');
});

test('the files of a commit are its file names, so the files of a real article merge are the ones the build reads', async () => {
  const { details } = capture('main-commits');
  const { api, calls } = answering(details[SHA]);

  const files = await readCommitFiles(api, SHA);

  assert.equal(calls[0].path, `commits/${SHA}`);
  assert.equal(files.length, 32);
  assert.ok(files.includes('site/src/data/post/ai-readiness-assessment-template-for-smb.md'));
});

test('a renamed file is listed under its old name too, so moving code into a prose directory still reads as a change', async () => {
  const { api } = answering({
    files: [{ filename: 'docs/moved.md', previous_filename: 'site/src/moved.ts' }, { filename: 'docs/other.md' }],
  });

  assert.deepEqual(await readCommitFiles(api, SHA), ['docs/moved.md', 'site/src/moved.ts', 'docs/other.md']);
});

test('a commit that lists 300 files, the most GitHub lists on one page, has no list to trust', async () => {
  const some = answering({ files: filler(299, (number) => ({ filename: `audits/a-${number}.json` })) });
  const cut = answering({ files: filler(300, (number) => ({ filename: `audits/a-${number}.json` })) });

  assert.equal((await readCommitFiles(some.api, SHA)).length, 299);
  assert.equal(await readCommitFiles(cut.api, SHA), null);
});
