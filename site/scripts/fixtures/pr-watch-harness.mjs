import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ATTEMPT_CAP, QUARANTINE_HOURS, newLedger } from '../autowriter-ledger.mjs';
import { fingerprint } from '../lh-evidence.mjs';
import { SECRET, watch } from '../pr-watch.mjs';
import { recordPath } from '../record-layout.mjs';
import { LEDGER_PATH } from './github-fake.mjs';
import { asInput, hoursAfterOpening, scenario, withAggregate, withJob } from './pr-watch.mjs';

export const PAT = 'pat-secret-value';
export const DEFAULT_TOKEN = 'default-token-value';
export const MERGED_SHA = 'f'.repeat(40);
export const WEBHOOK = 'https://hooks.slack.test/services/T0/B0/xyz';

const entry = (path, type, sha) => ({ path, mode: type === 'tree' ? '040000' : '100644', type, sha });

export const TREE = [
  entry('site', 'tree', 'd'.repeat(40)),
  entry('site/src', 'tree', 'e'.repeat(40)),
  entry('site/src/data/post/a-slug.md', 'blob', '1'.repeat(40)),
  entry('site/package.json', 'blob', '2'.repeat(40)),
  entry('docs/PRD.md', 'blob', '3'.repeat(40)),
  entry(LEDGER_PATH, 'blob', '4'.repeat(40)),
];

export const treeFilingLedgerAt = (path) =>
  TREE.map((listed) => (listed.path === LEDGER_PATH ? { ...listed, path } : listed));

export const TREE_FINGERPRINT = fingerprint(
  TREE.filter(({ type }) => type !== 'tree').map(({ path, sha }) => [path, sha])
);

const WRITES = ['merge', 'dispatch', 'putLedger'];

export const green = () => withAggregate(scenario('green'));
export const queued = (bundle) => withJob(bundle, 'build', { status: 'queued', conclusion: null });
export const cancelled = (bundle) => withJob(bundle, 'build', { conclusion: 'cancelled' });

export const ledgerRecord = (patch = {}) => ({
  value: { ...newLedger({ slug: 'a-slug', runId: '41', pullRequest: 72 }), ...patch },
  blobSha: 'b'.repeat(40),
  path: LEDGER_PATH,
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

export function slackMessageOf(requests) {
  const posted = requests.filter(({ url }) => url === WEBHOOK);
  assert.equal(posted.length, 1, 'expected exactly one Slack message');
  assert.ok(Array.isArray(posted[0].body.blocks), 'the Slack message carries no blocks');
  return posted[0].body;
}

function recordingIo({ snapshot, merge, tick, failWith, calls, tree, mergedLedger }) {
  const failing = (during) => {
    if (failWith?.during === during) throw failWith.error;
  };
  return {
    createApi: ({ token }) => ({ token, repo: 'meshin-co/website' }),
    readSnapshot: async (api, number) => {
      calls.push(['readSnapshot', api.token, number]);
      return snapshot;
    },
    mergePullRequest: async (api, args) => {
      calls.push(['merge', api.token, args]);
      failing('merge');
      return merge;
    },
    dispatchSuccessor: async (api, args) => {
      calls.push(['dispatch', api.token, args]);
      failing('dispatch');
    },
    putLedger: async (api, args) => {
      calls.push(['putLedger', api.token, args]);
      failing('putLedger');
      return { commit: 'e'.repeat(40) };
    },
    tickProblem: async (api, args) => {
      calls.push(['tickProblem', api.token, args]);
      return tick;
    },
    readTree: async (api, sha) => {
      calls.push(['readTree', api.token, sha]);
      failing('readTree');
      return tree;
    },
    readLedgerAt: async (api, args) => {
      calls.push(['readLedgerAt', api.token, args]);
      failing('readLedgerAt');
      return mergedLedger;
    },
  };
}

function recordingFetch(requests, issueStatus) {
  return async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    const isIssue = String(url).endsWith('/issues');
    const issue = JSON.stringify({ number: 9, html_url: 'https://github.test/issues/9' });
    if (isIssue && issueStatus !== 201) return { status: issueStatus, text: async () => '{"message":"Server Error"}' };
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
  afterRepair = null,
  tree = TREE,
  mergedLedger = ledgerRecord(),
  commits = null,
  issueStatus = 201,
}) {
  const workdir = await mkdtemp(join(tmpdir(), 'watch-'));
  const summary = join(workdir, 'summary.md');
  const outputs = join(workdir, 'outputs.txt');
  await writeFile(summary, '');
  await writeFile(outputs, '');
  const calls = [];
  const requests = [];
  const input = asInput(bundle);
  const snapshot = {
    pullRequest: { ...input.pullRequest, ...pullRequestPatch },
    commits: commits ?? input.commits,
    checkRuns: input.checkRuns,
    runs: input.runs,
    jobs: input.jobs,
    ledger,
  };
  const env = {
    GITHUB_REPOSITORY: 'meshin-co/website',
    GITHUB_SERVER_URL: 'https://github.test',
    GITHUB_TOKEN: DEFAULT_TOKEN,
    [SECRET]: PAT,
    GITHUB_RUN_ID: '555',
    GITHUB_REF_NAME: 'main',
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_OUTPUT: outputs,
    ...(slack ? { SLACK_WEBHOOK_URL: WEBHOOK } : {}),
  };
  const io = recordingIo({ snapshot, merge, tick, failWith, calls, tree, mergedLedger });
  const fetch = recordingFetch(requests, issueStatus);
  const now = () => hoursAfterOpening(bundle, hours);
  const run = () => watch({ number: 72, env, fetch, io, workdir, now, afterRepair });
  const ledgerPath = join(workdir, ledger?.path ?? recordPath('ledger', 'a-slug', now()));
  return { run, calls, requests, summary, outputs, env, io, fetch, now, workdir, ledgerPath };
}
