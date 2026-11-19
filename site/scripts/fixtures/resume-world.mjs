import { readFileSync } from 'node:fs';

import { newLedger } from '../autowriter-ledger.mjs';
import { BOT_EMAIL, BOT_NAME } from '../pr-classify.mjs';
import { repairFinding } from '../pr-watch-repair.mjs';
import { ESCALATION_KIND } from '../repair-outcome.mjs';

const MAILBOX_OF_THE_BOT = new RegExp(`${BOT_NAME}@[^"\\s]+`, 'g');

export const rehomed = (text, botEmail) => text.replace(MAILBOX_OF_THE_BOT, botEmail);

export const capture = (name) =>
  JSON.parse(rehomed(readFileSync(new URL(`./pr-resume/${name}.json`, import.meta.url), 'utf8'), BOT_EMAIL));

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

const REPAIR_RUN = 'https://github.com/meshin-co/website/actions/runs/43931342504';
const PULL_REQUEST_PAGE = 'https://github.com/meshin-co/website/pull/84';
export const FAILED_AGAIN_AT = '2026-11-04T10:00:00.000Z';
export const SECOND_FAILURE_ISSUE = 91;

export const repairEnding = (outcome, number = 84) =>
  repairFinding(
    { result: { reason: outcome, kind: ESCALATION_KIND[outcome] }, number },
    { run: REPAIR_RUN, pullRequest: PULL_REQUEST_PAGE }
  );

export const repairEndedAs = (outcome) => withLastEscalation(realLedger(), repairEnding(outcome));
export const repairFailed = () => repairEndedAs('failed');

export const failedAgainAfter = (ledger, raisedAt = FAILED_AGAIN_AT) => {
  const [first] = ledger.escalations;
  const receipts = first.receipts.map((receipt) => ({ ...receipt, issue: SECOND_FAILURE_ISSUE }));
  const again = { ...first, ...repairEnding('failed'), receipts, id: `esc-${ledger.escalations.length + 1}`, raisedAt };
  return {
    ...ledger,
    verdict: { ...ledger.verdict, decidedAt: raisedAt },
    escalations: [...ledger.escalations, again],
  };
};

export const unjudgedSlug = (number) => `unjudged-${number}`;
export const unjudged = (number) => ({
  pull: pullOnBranch(unjudgedSlug(number), number),
  record: ledgerRecord(
    newLedger({ slug: unjudgedSlug(number), runId: String(number), pullRequest: number }),
    `audits/autowriter/2026/11/${unjudgedSlug(number)}.json`
  ),
});
