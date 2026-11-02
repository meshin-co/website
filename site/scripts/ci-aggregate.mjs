import { invokedDirectly } from './invoked-directly.mjs';

export const AGGREGATE_JOB = 'all-required-jobs-passed';
export const AGGREGATE_CHECK_NAME = 'all required jobs passed';

const ALWAYS = 'runs on every push and pull request';
const ON_CODE = 'the diff changed code';
const ON_CODE_PULL_REQUEST = 'the diff changed code on a pull request';
const OUTSIDE_TABLE = 'it is not in the expectation table';

const EXPECTATIONS = {
  changes: { reason: ALWAYS, runs: () => true },
  build: { reason: ON_CODE, runs: ({ code }) => code },
  'types-and-units': { reason: ALWAYS, runs: () => true },
  'cheap-gates': { reason: ON_CODE, runs: ({ code }) => code },
  'visual-and-axe': { reason: ON_CODE, runs: ({ code }) => code },
  'deploy-preview': { reason: ON_CODE_PULL_REQUEST, runs: ({ code, event }) => code && event === 'pull_request' },
};

export const REQUIRED_JOBS = Object.keys(EXPECTATIONS);

const resultOf = (needs, job) => needs[job]?.result;

const classifierVerdict = (needs) => {
  if (resultOf(needs, 'changes') !== 'success') return { code: false, problem: null };
  const printed = needs.changes.outputs?.code;
  if (printed === 'true') return { code: true, problem: null };
  if (printed === 'false') return { code: false, problem: null };
  return { code: false, problem: 'changes printed no code verdict' };
};

const judge = ({ job, result, mustRun, reason }) => {
  if (result === 'success') return null;
  if (result === 'failure') return `${job} failed`;
  if (result === 'cancelled') return `${job} was cancelled`;
  if (result === 'skipped') return mustRun ? `${job} was skipped but had to run (${reason})` : null;
  return `${job} has no usable result (${result})`;
};

const inspectJob = ({ needs, job, expectation, context }) => {
  if (!Object.hasOwn(needs, job)) {
    return { line: `${job}  missing  success`, problem: `${job} has no result in needs` };
  }
  const mustRun = expectation.runs(context);
  const result = resultOf(needs, job);
  const line = `${job}  ${result}  ${mustRun ? 'success' : 'skipped-ok'}`;
  return { line, problem: judge({ job, result, mustRun, reason: expectation.reason }) };
};

export function aggregateVerdict({ needs, event }) {
  const classifier = classifierVerdict(needs);
  const context = { code: classifier.code, event };
  const extras = Object.keys(needs).filter((job) => !Object.hasOwn(EXPECTATIONS, job));
  const inspected = [
    ...REQUIRED_JOBS.map((job) => inspectJob({ needs, job, expectation: EXPECTATIONS[job], context })),
    ...extras.map((job) =>
      inspectJob({ needs, job, expectation: { reason: OUTSIDE_TABLE, runs: () => true }, context })
    ),
  ];
  const problems = inspected.map(({ problem }) => problem).filter(Boolean);
  if (classifier.problem) problems.push(classifier.problem);
  return { lines: inspected.map(({ line }) => line), problems };
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function readInput(env) {
  if (!env.EVENT_NAME) return { error: 'EVENT_NAME is not set, so the expectations cannot be chosen' };
  if (!env.NEEDS) return { error: 'NEEDS is not set, so no job result can be read' };
  let needs;
  try {
    needs = JSON.parse(env.NEEDS);
  } catch {
    return { error: 'NEEDS is not JSON' };
  }
  if (!isPlainObject(needs)) return { error: 'NEEDS is not a JSON object of job results' };
  return { needs, event: env.EVENT_NAME };
}

function main(env) {
  const input = readInput(env);
  if (input.error) {
    console.error(`AGGREGATE ${input.error}`);
    process.exitCode = 2;
    return;
  }
  const { lines, problems } = aggregateVerdict(input);
  for (const line of lines) console.log(line);
  for (const problem of problems) console.error(`AGGREGATE ${problem}`);
  console.log(`aggregate: ${lines.length} jobs checked, ${problems.length} problems`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.env);
