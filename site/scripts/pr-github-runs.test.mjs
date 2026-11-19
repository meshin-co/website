import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GitHubError, listIssueComments, listWatcherRuns } from './pr-github.mjs';
import { apiAnswering, json } from './fixtures/github-fake.mjs';

const run = (status, title, extra = {}) => ({ id: 1, status, display_title: title, conclusion: null, ...extra });

test('the runs of the watcher are the newest hundred of its workflow, unfiltered, reduced to status and title', async () => {
  const listed = [
    run('in_progress', 'Watch pull request #138'),
    run('completed', 'Watch pull request', { conclusion: 'success' }),
  ];
  const { api, calls } = apiAnswering(() => json({ total_count: 2, workflow_runs: listed }));

  assert.deepEqual(await listWatcherRuns(api, { workflow: 'watch-pr.yml' }), [
    { status: 'in_progress', title: 'Watch pull request #138' },
    { status: 'completed', title: 'Watch pull request' },
  ]);
  assert.deepEqual(
    calls.map(({ method, path }) => [method ?? 'GET', path]),
    [['GET', 'actions/workflows/watch-pr.yml/runs?per_page=100']]
  );
});

test('a refused read of the runs is a GitHub error, not an empty list that would read as no chains', async () => {
  const { api } = apiAnswering(() => json({ message: 'Resource not accessible by integration' }, 403));

  await assert.rejects(listWatcherRuns(api, { workflow: 'watch-pr.yml' }), GitHubError);
});

test('the comments of an issue are read from its first page', async () => {
  const comments = [{ body: 'resumed: main-change, main e8874d4' }];
  const { api, calls } = apiAnswering(() => json(comments));

  assert.deepEqual(await listIssueComments(api, { number: 91 }), comments);
  assert.deepEqual(
    calls.map(({ method, path }) => [method ?? 'GET', path]),
    [['GET', 'issues/91/comments?per_page=100']]
  );
});

test('a full page of comments is refused, because a note beyond it could not be found', async () => {
  const { api } = apiAnswering(() => json(Array.from({ length: 100 }, () => ({ body: 'x' }))));

  await assert.rejects(listIssueComments(api, { number: 91 }), /the issue comments list is incomplete/);
});
