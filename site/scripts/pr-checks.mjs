import { AGGREGATE_CHECK_NAME, REQUIRED_JOBS } from './ci-aggregate.mjs';

export const CI_WORKFLOW_PATH = '.github/workflows/ci.yml';

const CONTENT_OWNED_JOBS = ['cheap-gates', 'build'];
const SETUP_STEP = /^(Set up job|Complete job|Post |Run actions\/|Run npm ci$|Run npx playwright install)/;
const GATE_STEP = /npm run (gate:[a-z0-9:-]+)/;
const FAILED_JOB = new Set(['failure', 'timed_out', 'startup_failure']);

const verdict = (name, reason, kind, evidence, observe = '') => ({ verdict: name, reason, kind, evidence, observe });
const unsettled = (reason, evidence, observe = '') => verdict('unsettled', reason, null, evidence, observe);
const escalation = (reason, kind, evidence) => verdict('escalate', reason, kind, evidence);

const names = (jobs) => jobs.map(({ name }) => name).sort();
const byJob = (left, right) => left.job.localeCompare(right.job);

export function pickPullRequestRun({ workflow_runs: runs }) {
  const candidates = runs.filter(({ event, path }) => event === 'pull_request' && path === CI_WORKFLOW_PATH);
  return candidates.toSorted((left, right) => right.id - left.id)[0] ?? null;
}

const instancesOf = (jobs, name) => jobs.filter((job) => job.name === name || job.name.startsWith(`${name} (`));

function describeFailure(job) {
  const step = (job.steps ?? []).find(({ conclusion }) => conclusion === 'failure')?.name ?? null;
  return { job: job.name, gate: step?.match(GATE_STEP)?.[1] ?? null, step };
}

const ownedByContent = ({ job, step }) => CONTENT_OWNED_JOBS.includes(job) && step !== null && !SETUP_STEP.test(step);

function judgeFailures({ frame, failing, attemptsUsed, attemptCap }) {
  const evidence = { ...frame, failing };
  if (!failing.every(ownedByContent)) return escalation('not-a-content-gate', 'unrepairable', evidence);
  if (attemptsUsed >= attemptCap) return escalation('attempt-cap', 'no-convergence', evidence);
  return verdict('repairable', 'content-gate', null, evidence);
}

function judgeCancellation({ frame, run, cancelled, previous }) {
  const token = `cancelled:${frame.head}:${run.id}:${run.run_attempt}`;
  const evidence = { ...frame, jobs: cancelled };
  if (previous === token) return escalation('inconclusive-cancel', 'hard-stop', evidence);
  return unsettled('inconclusive-cancel', evidence, token);
}

function judgeRequiredJobs({ frame, jobs }) {
  const required = REQUIRED_JOBS.flatMap((name) => instancesOf(jobs, name));
  const skipped = required.filter(({ conclusion }) => conclusion === 'skipped');
  if (skipped.length > 0) return escalation('skipped-gate', 'hard-stop', { ...frame, jobs: names(skipped) });
  const missing = REQUIRED_JOBS.filter((name) => instancesOf(jobs, name).length === 0);
  if (missing.length > 0) return escalation('missing-check', 'hard-stop', { ...frame, jobs: missing.toSorted() });
  const unexpected = required.filter(({ conclusion }) => conclusion !== 'success');
  if (unexpected.length > 0) {
    return escalation('unexpected-conclusion', 'hard-stop', { ...frame, jobs: names(unexpected) });
  }
  return judgeAggregate({ frame, jobs, required });
}

function judgeAggregate({ frame, jobs, required }) {
  const aggregate = jobs.find(({ name }) => name === AGGREGATE_CHECK_NAME);
  const evidence = { ...frame, jobs: [AGGREGATE_CHECK_NAME] };
  if (!aggregate) return escalation('missing-check', 'hard-stop', evidence);
  if (aggregate.conclusion !== 'success') return escalation('unexpected-conclusion', 'hard-stop', evidence);
  return verdict('green', 'all-required-jobs-succeeded', null, { ...frame, jobs: names(required) });
}

function judgeFinishedJobs({ frame, run, jobs, previous, attemptsUsed, attemptCap }) {
  const failing = jobs
    .filter(({ name, conclusion }) => name !== AGGREGATE_CHECK_NAME && FAILED_JOB.has(conclusion))
    .map(describeFailure)
    .sort(byJob);
  if (failing.length > 0) return judgeFailures({ frame, failing, attemptsUsed, attemptCap });
  const cancelled = names(jobs.filter(({ conclusion }) => conclusion === 'cancelled'));
  if (cancelled.length > 0) return judgeCancellation({ frame, run, cancelled, previous });
  return judgeRequiredJobs({ frame, jobs });
}

function judgeEmptyRun({ frame, run, previous }) {
  if (run.conclusion === 'action_required') return escalation('approval-required', 'hard-stop', frame);
  if (run.conclusion === 'cancelled') return judgeCancellation({ frame, run, cancelled: [], previous });
  return escalation('run-without-jobs', 'hard-stop', frame);
}

const judgeMissingRun = ({ frame, checkRuns }) =>
  escalation(checkRuns.total_count === 0 ? 'no-checks' : 'no-pull-request-run', 'hard-stop', frame);

const headsOf = ({ run, checkRuns, jobs }) => [
  ...(run ? [run.head_sha] : []),
  ...checkRuns.check_runs.map(({ head_sha: sha }) => sha),
  ...jobs.map(({ head_sha: sha }) => sha),
];

const belongsElsewhere = (job, run) => job.run_id !== run.id || job.run_attempt !== run.run_attempt;

export function judgeChecks({ head, checkRuns, runs, jobs, previous, attemptsUsed, attemptCap }) {
  const run = pickPullRequestRun(runs);
  const frame = { head, run: run ? { id: run.id, attempt: run.run_attempt } : null };
  if (headsOf({ run, checkRuns, jobs: jobs.jobs }).some((sha) => sha !== head)) {
    return unsettled('stale-head', frame);
  }
  if (!run) return judgeMissingRun({ frame, checkRuns });
  const pending = names(jobs.jobs.filter(({ status }) => status !== 'completed'));
  if (run.status !== 'completed' || pending.length > 0) return unsettled('running', { ...frame, pending });
  if (jobs.jobs.length === 0) return judgeEmptyRun({ frame, run, previous });
  if (jobs.jobs.some((job) => belongsElsewhere(job, run))) return unsettled('other-run-attempt', frame);
  return judgeFinishedJobs({ frame, run, jobs: jobs.jobs, previous, attemptsUsed, attemptCap });
}
