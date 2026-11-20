import { ledgerText, ledgerWithResume, verdictInForce } from './autowriter-ledger.mjs';
import { needsFullGraph } from './build-surface.mjs';
import { createChains } from './pr-chains.mjs';
import { BOT_IDENTITY, HOLD_LABEL, foreignCommit, isOwnBranch, slugOfBranch } from './pr-classify.mjs';
import {
  closeIssue,
  commentOnIssue,
  createApi,
  dispatchSuccessor,
  listIssueComments,
  listOpenIssues,
  listOpenPullRequests,
  listRecentCommits,
  listWatcherRuns,
  putLedger,
  readBranchCommits,
  readCommitFiles,
  readLedgerAt,
  readPullRequest,
} from './pr-github.mjs';
import { createRemeasurer } from './pr-remeasure.mjs';
import { createIssueSettler, escalationIssueOf, shortSha } from './pr-resume-issues.mjs';
import { isRepairFailure, repairFailureResumeSpent } from './pr-resume-repair-failed.mjs';
import { hasMeasuredMain, remeasureSpent, staleVerdictOf } from './pr-resume-stale.mjs';
import { asItems, attempted, failure, settled } from './pr-resume-steps.mjs';
import { WORKFLOW } from './pr-watch.mjs';

export const RESUME_CAP = 2;
export const MAIN_COMMIT_LIMIT = 30;
export const RESUME_REASONS = [
  'not-escalated',
  'not-resumable-kind',
  'cap-reached',
  'resume-spent',
  'remeasure-spent',
  'no-main-change-since-decision',
  'human-touched',
  'already-resumed',
];
export const GITHUB = {
  createApi,
  closeIssue,
  commentOnIssue,
  dispatchSuccessor,
  listIssueComments,
  listOpenIssues,
  listOpenPullRequests,
  listRecentCommits,
  listWatcherRuns,
  putLedger,
  readBranchCommits,
  readCommitFiles,
  readLedgerAt,
  readPullRequest,
};

const KIND_OF_RESUMABLE_REASON = {
  'not-a-content-gate': 'unrepairable',
  'approval-required': 'hard-stop',
  'no-checks-catch-up-cap': 'hard-stop',
};
const WATCHER_JUDGEMENT = /^The watcher judged head \S+: escalate, ([a-z-]+)\.$/m;
const FAILING_LINE = /^Failing: (.+)\.$/m;
const GATE_SUFFIX = / \(gate:[a-z0-9:-]+\)$/;
const SPENT_NOTE = 'not resumed: the one resume a failed repair gets was already spent';

const stop = (reason) => ({ resume: false, reason });
const resumes = (ledger) => ledger.resumes ?? [];
const automaticResumes = (ledger) => resumes(ledger).filter(({ by }) => by !== 'owner').length;
const heldRunResumed = (ledger) => resumes(ledger).some(({ by }) => by === 'approval-held');

export function resumableReasonOf({ escalations }) {
  const last = escalations.at(-1);
  if (last !== undefined && isRepairFailure(last)) return 'repair-failed';
  const reason = WATCHER_JUDGEMENT.exec(last?.detail ?? '')?.[1];
  return reason !== undefined && KIND_OF_RESUMABLE_REASON[reason] === last.kind ? reason : null;
}

export function failedJobsOf({ detail }) {
  const named = FAILING_LINE.exec(detail)?.[1].split(', ') ?? [];
  return [...new Set(named.map((entry) => entry.replace(GATE_SUFFIX, '')))];
}

export function mainCommitsAfterVerdict({ verdict }, commits, now) {
  const since = Date.parse(verdict.decidedAt);
  return commits.filter(({ committedAt }) => {
    const at = Date.parse(committedAt);
    return at > since && at <= now.getTime();
  });
}

export function mainChangeSince(ledger, commits, now) {
  const after = mainCommitsAfterVerdict(ledger, commits, now);
  if (after.length > MAIN_COMMIT_LIMIT) return after[0];
  return after.find(({ files }) => needsFullGraph(files)) ?? null;
}

export function resumeDecision({ ledger, commitsOnBranch, mainChanges, forced = false, now, mainTip = null }) {
  if (ledger === null || ledger.verdict.state !== 'escalated') return stop('not-escalated');
  if (!verdictInForce(ledger)) return stop('already-resumed');
  const stale = staleVerdictOf(ledger, mainTip);
  const reason = resumableReasonOf(ledger);
  if (!forced && reason === null && stale === null) return stop('not-resumable-kind');
  if (!forced && foreignCommit(commitsOnBranch) !== undefined) return stop('human-touched');
  if (!forced && stale !== null)
    return remeasureSpent(ledger) ? stop('remeasure-spent') : { resume: false, remeasure: true };
  if (automaticResumes(ledger) >= RESUME_CAP && !(forced && stale !== null)) return stop('cap-reached');
  if (forced) return { resume: true, by: 'owner' };
  if (reason === 'approval-required' && !heldRunResumed(ledger)) return { resume: true, by: 'approval-held' };
  if (reason === 'repair-failed' && repairFailureResumeSpent(ledger)) return stop('resume-spent');
  if (mainChangeSince(ledger, mainChanges, now) === null) return stop('no-main-change-since-decision');
  return { resume: true, by: 'main-change' };
}

const heldByPerson = ({ draft, labels }) => draft === true || labels.some(({ name }) => name === HOLD_LABEL);
const awaitsMain = (ledger) => ledger !== null && ledger.verdict.state === 'escalated' && verdictInForce(ledger);
const awaitsWatcher = (ledger) =>
  ledger !== null &&
  (ledger.verdict.state === 'open' || (ledger.verdict.state === 'escalated' && !verdictInForce(ledger)));
const resumeComment = ({ by, mainSha }) => `resumed: ${by}${mainSha === null ? '' : `, main ${shortSha(mainSha)}`}`;
const left = (pull, reason) => ({ kind: 'left', pullRequest: pull.number, reason });

export function createResumeSweep({ io = GITHUB, reader, writer, ref, now = () => new Date() }) {
  const filesOfCommit = new Map();
  const remeasurer = createRemeasurer({ io, reader, writer, ref, now });
  const closeStaleIssues = createIssueSettler({ io, reader, settled });
  let recentCommits;
  let chains;

  const filesOf = (sha) => {
    if (!filesOfCommit.has(sha)) filesOfCommit.set(sha, io.readCommitFiles(reader, sha));
    return filesOfCommit.get(sha);
  };

  const recent = () => (recentCommits ??= io.listRecentCommits(reader, { branch: ref, limit: MAIN_COMMIT_LIMIT + 1 }));

  async function mainChangesFor(ledger) {
    const after = mainCommitsAfterVerdict(ledger, await recent(), now());
    if (after.length > MAIN_COMMIT_LIMIT) return after.map((commit) => ({ ...commit, files: null }));
    return Promise.all(after.map(async (commit) => ({ ...commit, files: await filesOf(commit.sha) })));
  }

  async function startWatcher(pull) {
    await chains.began(pull.number);
    return attempted(
      'the watcher was not dispatched',
      () => io.dispatchSuccessor(writer, { workflow: WORKFLOW, ref, inputs: { pr: String(pull.number) } }),
      `; start it with: gh workflow run ${WORKFLOW} -f pr=${pull.number}`
    );
  }

  async function resume({ pull, record, slug, by, change }) {
    const { value: ledger, path, blobSha } = record;
    const entry = {
      at: now().toISOString(),
      by,
      mainSha: change?.sha ?? null,
      failedJobs: failedJobsOf(ledger.escalations.at(-1)),
    };
    await io.putLedger(writer, {
      path,
      text: ledgerText(path, ledgerWithResume(ledger, entry)),
      blobSha,
      branch: pull.head.ref,
      message: `chore(autowriter): resume ${slug} (${by})`,
      identity: BOT_IDENTITY,
    });
    const issue = escalationIssueOf(ledger);
    const told =
      issue === null
        ? null
        : await attempted(`the escalation issue #${issue} was not told`, () =>
            io.commentOnIssue(reader, { number: issue, body: resumeComment(entry) })
          );
    const problems = [told, await startWatcher(pull)].filter((problem) => problem !== null);
    return { kind: 'resumed', pullRequest: pull.number, by, mainSha: entry.mainSha, problems };
  }

  async function tellSpent(ledger) {
    const issue = escalationIssueOf(ledger);
    if (issue === null) return;
    const comments = await io.listIssueComments(reader, { number: issue });
    if (!comments.some(({ body }) => body === SPENT_NOTE))
      await io.commentOnIssue(reader, { number: issue, body: SPENT_NOTE });
  }

  async function keepWatched(pull, commitsOnBranch) {
    if (heldByPerson(pull) || foreignCommit(commitsOnBranch) !== undefined) return left(pull, 'human-touched');
    const refusal = await chains.refusal(pull.number, false);
    if (refusal !== null) return left(pull, refusal);
    const problem = await startWatcher(pull);
    if (problem !== null) return failure(`#${pull.number}`, new Error(problem), { pullRequest: pull.number });
    return { kind: 'started', pullRequest: pull.number };
  }

  async function leftAsIs({ pull, ledger, commitsOnBranch, reason, forced }) {
    if (!forced && awaitsWatcher(ledger)) return keepWatched(pull, commitsOnBranch);
    if (reason !== 'resume-spent') return left(pull, reason);
    if (heldByPerson(pull)) return left(pull, 'human-touched');
    await tellSpent(ledger);
    return left(pull, reason);
  }

  async function consider(pull, { forced }) {
    const slug = slugOfBranch(pull.head.ref);
    const record = await io.readLedgerAt(reader, { slug, ref: pull.head.sha });
    const ledger = record?.value ?? null;
    const commitsOnBranch = await io.readBranchCommits(reader, pull.number);
    const mainChanges = !forced && awaitsMain(ledger) ? await mainChangesFor(ledger) : [];
    const mainTip = hasMeasuredMain(ledger) ? ((await recent())[0]?.sha ?? null) : null;
    const decision = resumeDecision({ ledger, commitsOnBranch, mainChanges, forced, now: now(), mainTip });
    if (!decision.resume && !decision.remeasure)
      return leftAsIs({ pull, ledger, commitsOnBranch, reason: decision.reason, forced });
    if (!forced && heldByPerson(pull)) return left(pull, 'human-touched');
    const refusal = await chains.refusal(pull.number, forced);
    if (refusal !== null) return left(pull, refusal);
    if (decision.remeasure) return remeasurer.request({ pull, record, slug, stale: staleVerdictOf(ledger, mainTip) });
    const change = decision.by === 'main-change' ? mainChangeSince(ledger, mainChanges, now()) : null;
    return resume({ pull, record, slug, by: decision.by, change });
  }

  const considered = (pull, options) =>
    settled(`#${pull.number}`, () => consider(pull, options), { pullRequest: pull.number });

  async function resumeOpenPullRequests() {
    const items = [];
    const open = (await io.listOpenPullRequests(reader)).filter(isOwnBranch);
    for (const pull of open.sort((first, second) => first.number - second.number))
      items.push(await considered(pull, { forced: false }));
    return items;
  }

  async function resumeNamed(number) {
    const pull = await io.readPullRequest(reader, number);
    if (pull.state !== 'open' || !isOwnBranch(pull))
      throw new Error(`pull request #${number} is not an open autowriter pull request of this repository`);
    return considered(pull, { forced: true });
  }

  async function run({ pullRequest = null } = {}) {
    chains = createChains(() => io.listWatcherRuns(reader, { workflow: WORKFLOW }));
    if (pullRequest !== null) return [await resumeNamed(pullRequest)];
    return [
      ...(await asItems('the open pull requests', resumeOpenPullRequests)),
      ...(await asItems('the open issues', closeStaleIssues)),
    ];
  }

  return { run };
}
