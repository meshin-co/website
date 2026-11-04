import { readFileSync } from 'node:fs';

import { BOT_EMAIL, BOT_NAME } from '../pr-classify.mjs';

export const capture = (name) => JSON.parse(readFileSync(new URL(`./pr-resume/${name}.json`, import.meta.url), 'utf8'));

export const SLUG = 'named-person-responsible-for-ai-risk-in-vendor-procurement';
export const LEDGER_PATH = `audits/autowriter/2026/11/${SLUG}.json`;
export const MAIN_SHA = 'e8874d4602b5944138a0017d3d5e862c9e7a728e';
export const BEFORE_VERDICT = '2026-11-03T11:00:00.000Z';
export const AFTER_VERDICT = '2026-11-03T13:00:00.000Z';
export const NOW = new Date('2026-11-04T09:00:00.000Z');

const real = () => capture('escalated-pull-request');
export const DECIDED_AT = real().ledger.verdict.decidedAt;
export const HEAD = real().pullRequest.head.sha;
export const OWN_COMMITS = real().commits;

const filesOf = (sha) => capture('main-commits').details[sha].files.map(({ filename }) => filename);
export const CODE_FILES = filesOf(MAIN_SHA);
export const PROSE_FILES = filesOf('0090504ca9441d0f2375ba5d485091bbff2ce796');

export const mainCommit = (sha, committedAt, files = CODE_FILES) => ({ sha, committedAt, files });
export const codeCommitAfter = (sha = MAIN_SHA, committedAt = AFTER_VERDICT) => mainCommit(sha, committedAt);
export const proseCommitAfter = (sha = 'b'.repeat(40), committedAt = AFTER_VERDICT) =>
  mainCommit(sha, committedAt, PROSE_FILES);

export const botCommit = (sha) => {
  const who = { name: BOT_NAME, email: BOT_EMAIL, date: '2026-11-03T10:59:27Z' };
  return { sha, commit: { author: who, committer: who } };
};
export const personCommit = (sha, email = 'owner@example.com') => {
  const who = { name: 'Owner', email, date: '2026-11-03T12:00:00Z' };
  return { sha, commit: { author: who, committer: who } };
};

export const watcherDetail = (reason, lines = []) =>
  [
    `The watcher judged head ${HEAD}: escalate, ${reason}.`,
    ...lines,
    'Pull request: https://github.com/meshin-co/website/pull/84',
  ].join('\n');

export const realLedger = () => real().ledger;

export const withLastEscalation = (ledger, patch) => ({
  ...ledger,
  escalations: [...ledger.escalations.slice(0, -1), { ...ledger.escalations.at(-1), ...patch }],
});

export const withVerdict = (ledger, patch) => ({ ...ledger, verdict: { ...ledger.verdict, ...patch } });

export const approvalHeld = () =>
  withLastEscalation(realLedger(), {
    kind: 'hard-stop',
    title: 'Autowriter pull request #84: the CI run waits for a person to approve it, so the push started no CI',
    detail: watcherDetail('approval-required'),
  });

export const resumeEntry = (at, extra = {}) => ({
  at,
  by: 'main-change',
  mainSha: MAIN_SHA,
  failedJobs: ['cheap-gates'],
  ...extra,
});

export const withResumes = (ledger, ...resumes) => ({ ...ledger, resumes });

export const openPull = (patch = {}) => ({ ...real().pullRequest, ...patch });
export const pullOnBranch = (slug, number, patch = {}) =>
  openPull({
    number,
    head: { ...real().pullRequest.head, ref: `autowriter/${slug}`, sha: String(number).padEnd(40, '0') },
    ...patch,
  });
export const ledgerRecord = (ledger = realLedger(), path = LEDGER_PATH) => ({
  value: ledger,
  blobSha: 'a1'.repeat(20),
  path,
});
export const ledgerOf = (slug, number, issue, patch = {}) => {
  const ledger = realLedger();
  const [escalation] = ledger.escalations;
  const receipts = escalation.receipts.map((receipt) => ({ ...receipt, issue }));
  return { ...ledger, slug, pullRequest: number, escalations: [{ ...escalation, receipts }], ...patch };
};
