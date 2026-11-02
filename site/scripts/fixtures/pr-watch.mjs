import { readFileSync } from 'node:fs';

import { AGGREGATE_CHECK_NAME } from '../ci-aggregate.mjs';
import { BOT_EMAIL } from '../pr-classify.mjs';

export const HOUR = 3_600_000;

export const scenario = (name) => JSON.parse(readFileSync(new URL(`./pr-watch/${name}.json`, import.meta.url), 'utf8'));

export const pullRequestRun = (bundle) => bundle.runs.workflow_runs.find(({ event }) => event === 'pull_request');

const mapJobs = (bundle, change) => ({ ...bundle, jobs: { ...bundle.jobs, jobs: change(bundle.jobs.jobs) } });

export const withJob = (bundle, name, patch) =>
  mapJobs(bundle, (jobs) => jobs.map((job) => (job.name === name ? { ...job, ...patch } : job)));

export const withoutJob = (bundle, name) => mapJobs(bundle, (jobs) => jobs.filter((job) => job.name !== name));

export const withAddedJob = (bundle, job) =>
  mapJobs(bundle, (jobs) => [
    ...jobs,
    {
      id: 1,
      run_id: pullRequestRun(bundle).id,
      run_attempt: pullRequestRun(bundle).run_attempt,
      steps: [],
      head_sha: bundle.pullRequest.head.sha,
      status: 'completed',
      ...job,
    },
  ]);

export const withAggregate = (bundle, conclusion = 'success') =>
  withAddedJob(bundle, { name: AGGREGATE_CHECK_NAME, conclusion });

export const withConclusions = (bundle, conclusions) =>
  mapJobs(bundle, (jobs) =>
    jobs.map((job) => (job.name in conclusions ? { ...job, conclusion: conclusions[job.name] } : job))
  );

export const withFailedStep = (bundle, jobName, stepName) =>
  withJob(bundle, jobName, {
    conclusion: 'failure',
    steps: [
      { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1 },
      { name: stepName, status: 'completed', conclusion: 'failure', number: 2 },
    ],
  });

export const withRun = (bundle, patch) => ({
  ...bundle,
  runs: {
    ...bundle.runs,
    workflow_runs: bundle.runs.workflow_runs.map((run) => (run.event === 'pull_request' ? { ...run, ...patch } : run)),
  },
});

export const withoutPullRequestRun = (bundle) => ({
  ...bundle,
  runs: { ...bundle.runs, workflow_runs: bundle.runs.workflow_runs.filter(({ event }) => event !== 'pull_request') },
  jobs: { total_count: 0, jobs: [] },
});

export const withNoChecksAtAll = (bundle) => ({
  ...withoutPullRequestRun(bundle),
  checkRuns: { total_count: 0, check_runs: [] },
  runs: { total_count: 0, workflow_runs: [] },
});

export const withHead = (bundle, sha) => ({
  ...bundle,
  pullRequest: { ...bundle.pullRequest, head: { ...bundle.pullRequest.head, sha } },
});

export const withPullRequest = (bundle, patch) => ({ ...bundle, pullRequest: { ...bundle.pullRequest, ...patch } });

export const botIdentity = { name: 'autowriter-bot', email: BOT_EMAIL };

export const byBot = (bundle) => ({
  ...bundle,
  commits: bundle.commits.map(({ sha, commit }) => ({
    sha,
    commit: {
      author: { ...botIdentity, date: commit.author.date },
      committer: { ...botIdentity, date: commit.committer.date },
    },
  })),
});

export const autowriterBranch = (bundle, slug = 'a-slug') =>
  withPullRequest(bundle, {
    state: 'open',
    merged: false,
    merged_at: null,
    head: { ...bundle.pullRequest.head, ref: `autowriter/${slug}` },
  });

export const openedAt = (bundle) => Date.parse(bundle.pullRequest.created_at);

export const hoursAfterOpening = (bundle, hours) => new Date(openedAt(bundle) + hours * HOUR);

export const asInput = (bundle, extra = {}) => {
  const owned = byBot(autowriterBranch(bundle));
  return {
    pullRequest: owned.pullRequest,
    commits: owned.commits,
    checkRuns: owned.checkRuns,
    runs: owned.runs,
    jobs: owned.jobs,
    ledger: null,
    previous: '',
    now: hoursAfterOpening(owned, 13),
    ...extra,
  };
};
