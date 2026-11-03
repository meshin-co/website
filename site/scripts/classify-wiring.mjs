import yaml from 'js-yaml';

export const WORKFLOW_PATH = '.github/workflows/ci.yml';

const CHANGES_JOB = 'changes';
const CLASSIFIER_SCRIPT = 'scripts/run-classify-diff.mjs';
const BASE_REFERENCE = 'github.event.pull_request.base.sha';
const PATH_LOGIC = /\||&&|;|\$\(|`|\bcase\b|\bgrep\b|\bawk\b|\bsed\b|\bgit\b|--name-only|\*\.md/;

const finding = (rule, detail) => ({ rule, detail });

const parsed = (workflowText) => {
  const workflow = yaml.load(workflowText);
  return workflow !== null && typeof workflow === 'object' && !Array.isArray(workflow) ? workflow : {};
};

const runOf = (step) => String(step.run ?? '');

const labelOf = (step, at) => step.name ?? step.id ?? `step ${at + 1}`;

const viewOf = (step, workflow) => ({
  id: step.id ?? null,
  run: runOf(step).trim(),
  env: step.env ?? {},
  workingDirectory: step['working-directory'] ?? workflow.defaults?.run?.['working-directory'] ?? '.',
});

export function classifierStep(workflowText) {
  const workflow = parsed(workflowText);
  const step = workflow.jobs?.[CHANGES_JOB]?.steps?.find((candidate) => runOf(candidate).includes(CLASSIFIER_SCRIPT));
  return step ? viewOf(step, workflow) : null;
}

export function verdictStep(workflowText) {
  const workflow = parsed(workflowText);
  const job = workflow.jobs?.[CHANGES_JOB];
  const id = /steps\.([\w-]+)\.outputs\.code/.exec(String(job?.outputs?.code ?? ''))?.[1];
  const step = id === undefined ? undefined : job.steps?.find((candidate) => candidate.id === id);
  return step ? viewOf(step, workflow) : null;
}

function callFindings(classifier) {
  if (!classifier) {
    return [
      finding(
        'classifier-not-called',
        `No step of the ${CHANGES_JOB} job runs ${CLASSIFIER_SCRIPT}, so the rule that decides which gates a diff draws is not the module's.`
      ),
    ];
  }
  return ['--before', '--after']
    .filter((flag) => !classifier.run.includes(flag))
    .map((flag) =>
      finding(
        'classifier-arguments',
        `The ${CHANGES_JOB} step that runs ${CLASSIFIER_SCRIPT} passes no ${flag}, so the module cannot know which commits to compare.`
      )
    );
}

function baseFindings(classifier) {
  if (!classifier) return [];
  const before = String(classifier.env.BEFORE ?? '');
  if (before.includes(BASE_REFERENCE)) return [];
  return [
    finding(
      'classifier-judges-last-push',
      `The BEFORE of the ${CHANGES_JOB} step that runs ${CLASSIFIER_SCRIPT} is ${JSON.stringify(before)}, which does not name ${BASE_REFERENCE}, so a pull request is judged by its last push alone and a push that changes only a ledger or prose reads as prose and skips every gate; BEFORE must name ${BASE_REFERENCE} and fall back to github.event.before for a push to main.`
    ),
  ];
}

const reexpressionFindings = (steps) =>
  steps.flatMap((step, at) =>
    PATH_LOGIC.test(runOf(step))
      ? [
          finding(
            'classifier-reexpressed',
            `The step "${labelOf(step, at)}" of the ${CHANGES_JOB} job runs shell that reads or filters paths or chains another command, so a second rule can disagree with ${CLASSIFIER_SCRIPT}; the step must be the one call and nothing else.`
          ),
        ]
      : []
  );

function outputFindings(job, classifier) {
  if (!classifier) return [];
  const expected = `\${{ steps.${classifier.id}.outputs.code }}`;
  const actual = String(job.outputs?.code ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (classifier.id !== null && actual === expected) return [];
  const where =
    classifier.id === null
      ? 'The classifier step has no id'
      : `The ${CHANGES_JOB} job output "code" is ${JSON.stringify(actual)}`;
  const need =
    classifier.id === null ? 'steps.<id>.outputs.code of the classifier step' : `steps.${classifier.id}.outputs.code`;
  return [
    finding(
      'classifier-output-unwired',
      `${where}, so the gated jobs cannot read the verdict; the output must be ${need}.`
    ),
  ];
}

function historyFindings(steps) {
  const checkout = steps.find((step) => String(step.uses ?? '').startsWith('actions/checkout'));
  if (checkout && String(checkout.with?.['fetch-depth']) === '0') return [];
  return [
    finding(
      'classifier-history-shallow',
      `The checkout of the ${CHANGES_JOB} job does not set fetch-depth: 0, so the before commit may be absent and the diff falls back to the parent.`
    ),
  ];
}

function nodeFindings(steps) {
  const classifierAt = steps.findIndex((step) => runOf(step).includes(CLASSIFIER_SCRIPT));
  const pinned = steps.findIndex(
    (step) => String(step.uses ?? '').startsWith('actions/setup-node') && step.with?.['node-version-file']
  );
  if (pinned !== -1 && (classifierAt === -1 || pinned < classifierAt)) return [];
  return [
    finding(
      'classifier-node-unpinned',
      `The ${CHANGES_JOB} job has no actions/setup-node step with a node-version-file before the classifier, so it runs under whatever Node the runner image ships.`
    ),
  ];
}

export function classifierWiringFindings(workflowText) {
  const job = parsed(workflowText).jobs?.[CHANGES_JOB];
  if (!job) {
    return [
      finding(
        'changes-job-missing',
        `The workflow has no job "${CHANGES_JOB}", so nothing decides which gates a diff must draw.`
      ),
    ];
  }
  const steps = job.steps ?? [];
  const classifier = classifierStep(workflowText);
  return [
    ...callFindings(classifier),
    ...baseFindings(classifier),
    ...reexpressionFindings(steps),
    ...outputFindings(job, classifier),
    ...historyFindings(steps),
    ...nodeFindings(steps),
  ];
}
