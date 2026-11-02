import { siteBrand } from './site-brand.mjs';
import { ATTEMPT_CAP, QUARANTINE_HOURS } from './autowriter-ledger.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { judgeChecks } from './pr-checks.mjs';
import { ESCALATION_KIND, isOutcome } from './repair-outcome.mjs';

export const BOT_NAME = 'autowriter-bot';
export const BOT_EMAIL = `${BOT_NAME}@${siteBrand().name}`;
export const BOT_IDENTITY = { name: BOT_NAME, email: BOT_EMAIL };
export const BRANCH_PREFIX = 'autowriter/';
export const HOLD_LABEL = readEngineConfig().loop.holdLabel;
export const CHAIN_LIMIT_HOURS = QUARANTINE_HOURS + 24;
export const VERDICTS = ['unsettled', 'merge', 'repairable', 'escalate', 'blocked-by-human', 'done'];

const HOUR_MS = 3_600_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugOfBranch(ref) {
  if (!ref.startsWith(BRANCH_PREFIX)) return null;
  const slug = ref.slice(BRANCH_PREFIX.length);
  return SLUG.test(slug) ? slug : null;
}

const verdict = (name, reason, evidence) => ({ verdict: name, reason, kind: null, evidence, observe: '' });

const baseOf = (pullRequest) => ({ head: pullRequest.head.sha, pullRequest: pullRequest.number });

const isOwnBranch = ({ head, base }) => slugOfBranch(head.ref) !== null && head.repo?.full_name === base.repo.full_name;

const handledByHuman = (pullRequest, commits, base, ignoreLag) => {
  if (pullRequest.merged === true) return verdict('done', 'merged', base);
  if (pullRequest.state !== 'open') return verdict('blocked-by-human', 'closed', base);
  if (!isOwnBranch(pullRequest)) return verdict('blocked-by-human', 'foreign-branch', base);
  if (pullRequest.labels.some(({ name }) => name === HOLD_LABEL))
    return verdict('blocked-by-human', 'hold-label', base);
  if (pullRequest.draft === true) return verdict('blocked-by-human', 'draft', base);
  if (!ignoreLag && commits.at(-1)?.sha !== pullRequest.head.sha) return verdict('unsettled', 'stale-head', base);
  const foreign = commits.find(
    ({ commit }) => commit.author.email !== BOT_EMAIL || commit.committer.email !== BOT_EMAIL
  );
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
  ledger !== null && ledger.verdict.state !== 'open' && ledger.verdict.state !== 'merged'
    ? verdict('done', 'ledger-decided', base)
    : null;

function settle({ checks, pullRequest, now, base }) {
  const evidence = { ...base, ...checks.evidence };
  const opened = Date.parse(pullRequest.created_at);
  if (checks.verdict === 'green') {
    const mergeableAt = new Date(opened + QUARANTINE_HOURS * HOUR_MS);
    if (now < mergeableAt)
      return verdict('unsettled', 'quarantine', { ...evidence, mergeableAt: mergeableAt.toISOString() });
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

export function classifyPullRequest({ pullRequest, commits, checkRuns, runs, jobs, ledger, previous, now }) {
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
  return settle({ checks, pullRequest, now, base });
}

export function classifyAfterRepair({ pullRequest, commits, ledger, outcome }) {
  if (!isOutcome(outcome)) throw new Error(`${outcome} is not a repair outcome`);
  const handling = classifyHandling({ pullRequest, commits, ledger }, { ignoreLag: true });
  if (handling) return handling;
  const base = baseOf(pullRequest);
  if (outcome === 'repaired' || outcome === 'stale') return verdict('unsettled', outcome, base);
  return { ...verdict('escalate', outcome, base), kind: ESCALATION_KIND[outcome] };
}
