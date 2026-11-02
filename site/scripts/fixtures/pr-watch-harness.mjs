import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ATTEMPT_CAP, QUARANTINE_HOURS, newLedger } from '../autowriter-ledger.mjs';
import { SECRET, watch } from '../pr-watch.mjs';
import { asInput, hoursAfterOpening, scenario, withAggregate, withJob } from './pr-watch.mjs';

export const PAT = 'pat-secret-value';
export const DEFAULT_TOKEN = 'default-token-value';
export const MERGED_SHA = 'f'.repeat(40);

const WRITES = ['merge', 'dispatch', 'putLedger'];

export const green = () => withAggregate(scenario('green'));
export const queued = (bundle) => withJob(bundle, 'build', { status: 'queued', conclusion: null });
export const cancelled = (bundle) => withJob(bundle, 'build', { conclusion: 'cancelled' });

export const ledgerRecord = (patch = {}) => ({
  value: { ...newLedger({ slug: 'a-slug', runId: '41', pullRequest: 72 }), ...patch },
  blobSha: 'b'.repeat(40),
  path: 'audits/autowriter/a-slug.json',
});

export const spentAttempts = Array.from({ length: ATTEMPT_CAP }, (_, index) => ({
  number: index + 1,
  judgedCommit: 'a'.repeat(40),
  recordedAt: '2026-11-01T23:30:00.000Z',
  failingRule: 'gate:content',
  failingPath: null,
  tokens: { input: 0, output: 0 },
  costUsd: 0,
}));

export const written = (calls) => calls.filter(([name]) => WRITES.includes(name));
export const writtenNames = (calls) => written(calls).map(([name]) => name);

export const readJson = (path) => {
  assert.ok(existsSync(path), `${path} was not written`);
  return JSON.parse(readFileSync(path, 'utf8'));
};

export const callOf = (calls, name) => {
  const call = calls.find(([called]) => called === name);
  assert.ok(call, `no ${name} call was made`);
  return call;
};

function recordingIo({ snapshot, merge, tick, failWith, calls }) {
  return {
    createApi: ({ token }) => ({ token, repo: 'meshin-co/website' }),
    readSnapshot: async (api, number) => {
      calls.push(['readSnapshot', api.token, number]);
      return snapshot;
    },
    mergePullRequest: async (api, args) => {
      calls.push(['merge', api.token, args]);
      if (failWith?.during === 'merge') throw failWith.error;
      return merge;
    },
    dispatchSuccessor: async (api, args) => {
      calls.push(['dispatch', api.token, args]);
      if (failWith?.during === 'dispatch') throw failWith.error;
    },
    putLedger: async (api, args) => {
      calls.push(['putLedger', api.token, args]);
      return { commit: 'e'.repeat(40) };
    },
    tickProblem: async (api, args) => {
      calls.push(['tickProblem', api.token, args]);
      return tick;
    },
  };
}

function recordingFetch(requests) {
  return async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    const isIssue = String(url).endsWith('/issues');
    const issue = JSON.stringify({ number: 9, html_url: 'https://github.test/issues/9' });
    return { status: isIssue ? 201 : 200, text: async () => (isIssue ? issue : 'ok') };
  };
}

export async function harness({
  bundle,
  hours = QUARANTINE_HOURS + 1,
  ledger = null,
  pullRequestPatch = {},
  merge = { merged: true, sha: MERGED_SHA },
  tick = null,
  failWith = null,
  slack = true,
}) {
  const workdir = await mkdtemp(join(tmpdir(), 'watch-'));
  const summary = join(workdir, 'summary.md');
  await writeFile(summary, '');
  const calls = [];
  const requests = [];
  const input = asInput(bundle);
  const snapshot = {
    pullRequest: { ...input.pullRequest, ...pullRequestPatch },
    commits: input.commits,
    checkRuns: input.checkRuns,
    runs: input.runs,
    jobs: input.jobs,
    ledger,
  };
  const env = {
    GITHUB_REPOSITORY: 'meshin-co/website',
    GITHUB_TOKEN: DEFAULT_TOKEN,
    [SECRET]: PAT,
    GITHUB_RUN_ID: '555',
    GITHUB_REF_NAME: 'main',
    GITHUB_STEP_SUMMARY: summary,
    ...(slack ? { SLACK_WEBHOOK_URL: 'https://hooks.slack.test/services/T0/B0/xyz' } : {}),
  };
  const io = recordingIo({ snapshot, merge, tick, failWith, calls });
  const fetch = recordingFetch(requests);
  const now = () => hoursAfterOpening(bundle, hours);
  const run = () => watch({ number: 72, env, fetch, io, workdir, now });
  return { run, calls, requests, summary, env, ledgerPath: join(workdir, 'audits/autowriter/a-slug.json') };
}
