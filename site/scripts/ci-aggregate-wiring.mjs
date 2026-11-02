import yaml from 'js-yaml';
import { AGGREGATE_CHECK_NAME, AGGREGATE_JOB, REQUIRED_JOBS } from './ci-aggregate.mjs';

export const WORKFLOW_PATH = '.github/workflows/ci.yml';

const SCRIPT_PATH = 'scripts/ci-aggregate.mjs';
const PULL_REQUEST_TEST = "github.event_name == 'pull_request'";
const OUTSIDE_THE_AGGREGATE = new Set([AGGREGATE_JOB, 'cancel-on-failure', 'regen-baselines']);

const finding = (rule, detail) => ({ rule, detail });

const needsOf = (job) => [job.needs ?? []].flat();

const mentionsAlways = (condition) => String(condition ?? '').includes('always()');

const nameFindings = (job) => {
  const name = String(job.name ?? '');
  const isExpression = name.includes('${{');
  if (isExpression && name.includes(AGGREGATE_CHECK_NAME) && name.includes(PULL_REQUEST_TEST)) return [];
  return [
    finding(
      'aggregate-name',
      `The name of ${AGGREGATE_JOB} must be an expression that yields "${AGGREGATE_CHECK_NAME}" on a pull request and a different name on any other event, so a push run can never shadow the required check; it is now ${JSON.stringify(job.name)}.`
    ),
  ];
};

const conditionFindings = (job) =>
  mentionsAlways(job.if)
    ? []
    : [
        finding(
          'aggregate-not-always',
          `The if of ${AGGREGATE_JOB} must contain always(), or the job is skipped when a dependency fails and GitHub counts a skipped required check as passed; it is now ${JSON.stringify(job.if)}.`
        ),
      ];

const stepFindings = (job) => {
  const step = (job.steps ?? []).find((candidate) => String(candidate.run ?? '').includes(SCRIPT_PATH));
  if (!step) {
    return [
      finding(
        'aggregate-step-not-always',
        `No step of ${AGGREGATE_JOB} runs ${SCRIPT_PATH}, so nothing decides the verdict.`
      ),
    ];
  }
  if (mentionsAlways(step.if)) return [];
  return [
    finding(
      'aggregate-step-not-always',
      `The step of ${AGGREGATE_JOB} that runs ${SCRIPT_PATH} needs if: always(), or a cancelled run skips the step and the job ends green.`
    ),
  ];
};

const coverageFindings = (jobs, needs) =>
  Object.keys(jobs)
    .filter((id) => !OUTSIDE_THE_AGGREGATE.has(id) && !needs.includes(id))
    .map((id) =>
      finding(
        'aggregate-uncovered',
        `job "${id}" is not in the needs of ${AGGREGATE_JOB}, so its failure would not block a merge`
      )
    );

const danglingFindings = (jobs, needs) =>
  needs
    .filter((id) => !Object.hasOwn(jobs, id))
    .map((id) =>
      finding('aggregate-dangling', `The needs of ${AGGREGATE_JOB} lists "${id}", which is not a job in the workflow.`)
    );

const driftFindings = (needs) => {
  const unlisted = REQUIRED_JOBS.filter((id) => !needs.includes(id));
  const unknown = needs.filter((id) => !REQUIRED_JOBS.includes(id));
  if (unlisted.length === 0 && unknown.length === 0) return [];
  const parts = [];
  if (unlisted.length > 0) parts.push(`missing from needs: ${unlisted.join(', ')}`);
  if (unknown.length > 0) parts.push(`not in REQUIRED_JOBS: ${unknown.join(', ')}`);
  return [
    finding(
      'aggregate-table-drift',
      `The needs of ${AGGREGATE_JOB} and REQUIRED_JOBS in ${SCRIPT_PATH} must list the same jobs (${parts.join('; ')}).`
    ),
  ];
};

export function aggregateWiringFindings(workflowText) {
  const jobs = yaml.load(workflowText)?.jobs ?? {};
  const job = jobs[AGGREGATE_JOB];
  if (!job) {
    return [
      finding(
        'aggregate-job-missing',
        `The workflow has no job "${AGGREGATE_JOB}", so no single check carries the verdict of every required job.`
      ),
    ];
  }
  const needs = needsOf(job);
  return [
    ...nameFindings(job),
    ...conditionFindings(job),
    ...stepFindings(job),
    ...coverageFindings(jobs, needs),
    ...danglingFindings(jobs, needs),
    ...driftFindings(needs),
  ];
}
