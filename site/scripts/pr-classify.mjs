import { siteBrand } from './site-brand.mjs';
import { ATTEMPT_CAP, QUARANTINE_HOURS, verdictInForce } from './autowriter-ledger.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { judgeChecks } from './pr-checks.mjs';
import { ESCALATION_KIND, isOutcome } from './repair-outcome.mjs';
import { CATCH_UP_SUBJECT, isDerivedPath } from './derived-files.mjs';

export const BOT_NAME = 'autowriter-bot';
export const BOT_EMAIL = `${BOT_NAME}@${siteBrand().name}`;
export const BOT_IDENTITY = { name: BOT_NAME, email: BOT_EMAIL };
export const BRANCH_PREFIX = 'autowriter/';
export const HOLD_LABEL = readEngineConfig().loop.holdLabel;
export const CHAIN_LIMIT_HOURS = QUARANTINE_HOURS + 24;
export const CATCH_UP_CAP = 3;
export const VERDICTS = ['unsettled', 'merge', 'catch-up', 'repairable', 'escalate', 'blocked-by-human', 'done'];

const HOUR_MS = 3_600_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugOfBranch(ref) {
  if (!ref.startsWith(BRANCH_PREFIX)) return null;
  const slug = ref.slice(BRANCH_PREFIX.length);
  return SLUG.test(slug) ? slug : null;
}

const verdict = (name, reason, evidence) => ({ verdict: name, reason, kind: null, evidence, observe: '' });

const baseOf = (pullRequest) => ({ head: pullRequest.head.sha, pullRequest: pullRequest.number });

export const isOwnBranch = ({ head, base }) =>
  slugOfBranch(head.ref) !== null && head.repo?.full_name === base.repo.full_name;

export const foreignCommit = (commits) =>
  commits.find(({ commit }) => commit.author.email !== BOT_EMAIL || commit.committer.email !== BOT_EMAIL);

const handledByHuman = (pullRequest, commits, base, ignoreLag) => {
  if (pullRequest.merged === true) return verdict('done', 'merged', base);
  if (pullRequest.state !== 'open') return verdict('blocked-by-human', 'closed', base);
  if (!isOwnBranch(pullRequest)) return verdict('blocked-by-human', 'foreign-branch', base);
  if (pullRequest.labels.some(({ name }) => name === HOLD_LABEL))
    return verdict('blocked-by-human', 'hold-label', base);
  if (pullRequest.draft === true) return verdict('blocked-by-human', 'draft', base);
  if (!ignoreLag && commits.at(-1)?.sha !== pullRequest.head.sha) return verdict('unsettled', 'stale-head', base);
  const foreign = foreignCommit(commits);
  if (!foreign) return null;
  const { author, committer } = foreign.commit;
  return verdict('blocked-by-human', 'human-commit', {
    ...base,
    commit: foreign.sha,
    author: author.email,
    committer: committer.email,
  });
};

const decidedBefore = (ledger, base) =>
  ledger !== null && ledger.verdict.state !== 'open' && ledger.verdict.state !== 'merged' && verdictInForce(ledger)
    ? verdict('done', 'ledger-decided', base)
    : null;

const NO_DRIFT = { behindBy: 0, paths: [] };

const movesDerivedFiles = ({ behindBy, paths }) => behindBy > 0 && (paths === null || paths.some(isDerivedPath));

const catchUpsIn = (commits) =>
  commits.filter(({ commit, parents }) => parents?.length === 2 && commit.message.startsWith(CATCH_UP_SUBJECT)).length;

function overtakenByMain({ commits, drift, evidence }) {
  const moved = { ...evidence, behindBy: drift.behindBy };
  if (catchUpsIn(commits) >= CATCH_UP_CAP)
    return { ...verdict('escalate', 'catch-up-cap', moved), kind: 'no-convergence' };
  return verdict('catch-up', 'main-moved', moved);
}

function settle({ checks, pullRequest, commits, drift, now, base }) {
  const evidence = { ...base, ...checks.evidence };
  const opened = Date.parse(pullRequest.created_at);
  if (checks.verdict === 'green') {
    const mergeableAt = new Date(opened + QUARANTINE_HOURS * HOUR_MS);
    if (now < mergeableAt)
      return verdict('unsettled', 'quarantine', { ...evidence, mergeableAt: mergeableAt.toISOString() });
    if (movesDerivedFiles(drift)) return overtakenByMain({ commits, drift, evidence });
    return verdict('merge', 'green-after-quarantine', evidence);
  }
  if (checks.verdict === 'unsettled' && now - opened > CHAIN_LIMIT_HOURS * HOUR_MS) {
    return { ...verdict('escalate', 'chain-too-old', evidence), kind: 'no-convergence' };
  }
  return { ...checks, evidence };
}

export function classifyHandling({ pullRequest, commits, ledger }, { ignoreLag = false } = {}) {
  const base = baseOf(pullRequest);
  return handledByHuman(pullRequest, commits, base, ignoreLag) ?? decidedBefore(ledger, base);
}

export function classifyPullRequest({
  pullRequest,
  commits,
  checkRuns,
  runs,
  jobs,
  ledger,
  previous,
  now,
  drift = NO_DRIFT,
}) {
  const early = classifyHandling({ pullRequest, commits, ledger });
  if (early) return early;
  const base = baseOf(pullRequest);
  const checks = judgeChecks({
    head: base.head,
    checkRuns,
    runs,
    jobs,
    previous,
    attemptsUsed: ledger?.attempts.length ?? 0,
    attemptCap: ATTEMPT_CAP,
  });
  return settle({ checks, pullRequest, commits, drift, now, base });
}

export function classifyAfterRepair({ pullRequest, commits, ledger, outcome }) {
  if (!isOutcome(outcome)) throw new Error(`${outcome} is not a repair outcome`);
  const handling = classifyHandling({ pullRequest, commits, ledger }, { ignoreLag: true });
  if (handling) return handling;
  const base = baseOf(pullRequest);
  if (outcome === 'repaired' || outcome === 'stale') return verdict('unsettled', outcome, base);
  return { ...verdict('escalate', outcome, base), kind: ESCALATION_KIND[outcome] };
}
