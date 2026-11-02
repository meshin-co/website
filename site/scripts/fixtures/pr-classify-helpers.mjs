import { newLedger } from '../autowriter-ledger.mjs';
import { classifyPullRequest } from '../pr-classify.mjs';
import { asInput, hoursAfterOpening, scenario, withAggregate, withJob } from './pr-watch.mjs';

export const classify = (bundle, extra = {}) => classifyPullRequest(asInput(bundle, extra));
export const green = () => withAggregate(scenario('green'));
export const at = (bundle, hours) => ({ now: hoursAfterOpening(bundle, hours) });
export const openPullRequest = (bundle) => asInput(bundle).pullRequest;
export const classifyAltered = (bundle, patch, extra = {}) =>
  classify(bundle, { pullRequest: { ...openPullRequest(bundle), ...patch }, ...extra });

export const human = { name: 'Owner', email: 'owner@example.com' };
export const commitBy = (sha, author, committer = author) => ({ sha, commit: { author, committer } });
export const lastCommitBy = (bundle, author, committer) => [
  ...asInput(bundle).commits.slice(0, -1),
  commitBy(bundle.pullRequest.head.sha, author, committer),
];

export const ledgerWith = (attempts, verdict = { state: 'open', reason: null, decidedAt: null }) => ({
  ...newLedger({ slug: 'a-slug', runId: '1', pullRequest: 72 }),
  attempts: Array.from({ length: attempts }, (_, index) => ({
    number: index + 1,
    judgedCommit: 'a'.repeat(40),
    recordedAt: '2026-11-01T23:30:00.000Z',
    failingRule: 'gate:content',
    failingPath: null,
    tokens: { input: 0, output: 0 },
    costUsd: 0,
  })),
  verdict,
});

export const decided = (state) => ({ state, reason: 'a human took over', decidedAt: '2026-11-02T08:00:00.000Z' });

export const stillRunning = (bundle) => withJob(bundle, 'build', { status: 'queued', conclusion: null });
