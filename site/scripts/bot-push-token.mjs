import yaml from 'js-yaml';

import { STATE_BRANCH, STATE_DIRECTORY } from './record-layout.mjs';

const RULE = 'bot-push-token';
const STATE_RULE = 'state-checkout';
const BOT_SECRET = 'AUTOWRITER_PAT';
const BOT_SECRET_EXPRESSION = `secrets.${BOT_SECRET}`;
const PUSH = /\bgit\b[^\n]*\bpush\b/;
const COMMIT_STATE = /\bcommit-state\.mjs\b/;

const stepsOf = (job) => job?.steps ?? [];
const checkoutsOf = (job) => stepsOf(job).filter((step) => /^actions\/checkout@/.test(step.uses ?? ''));
const holdsBotSecret = (value) => String(value ?? '').includes(BOT_SECRET_EXPRESSION);
const stepLabel = (step, at) => step.name ?? step.id ?? `step ${at + 1}`;

const pushesOf = ({ path, text }) =>
  Object.entries(yaml.load(text)?.jobs ?? {}).flatMap(([jobName, job]) =>
    stepsOf(job).flatMap((step, at) =>
      PUSH.test(String(step.run ?? '')) ? [{ path, jobName, job, step, label: stepLabel(step, at) }] : []
    )
  );

function credentialProblem({ job, step }) {
  const checkouts = checkoutsOf(job);
  if (checkouts.length === 0) return 'its job has no checkout, so it pushes with whatever the runner holds';
  if (checkouts.every((checkout) => holdsBotSecret(checkout.with?.token))) return null;
  if (!checkouts.every((checkout) => checkout.with?.['persist-credentials'] === false)) {
    return 'its job checkout leaves the default token on disk (persist-credentials is not false), so the push is made by github-actions[bot] and the pull request run is held for approval';
  }
  if (!holdsBotSecret(step.env?.[BOT_SECRET])) {
    return `the step does not hold ${BOT_SECRET} in its own env, so nothing but the default token can authenticate the push`;
  }
  return null;
}

const isStateCheckout = (step) => step.with?.ref === STATE_BRANCH && step.with?.path === STATE_DIRECTORY;

const commitStatesOf = ({ path, text }) =>
  Object.entries(yaml.load(text)?.jobs ?? {}).flatMap(([jobName, job]) =>
    stepsOf(job).flatMap((step, at) =>
      COMMIT_STATE.test(String(step.run ?? '')) ? [{ path, jobName, job, step, at, label: stepLabel(step, at) }] : []
    )
  );

function stateCheckoutProblem({ job, at }) {
  const checkouts = stepsOf(job).flatMap((step, index) =>
    /^actions\/checkout@/.test(step.uses ?? '') && isStateCheckout(step) ? [{ step, index }] : []
  );
  if (checkouts.length === 0)
    return `its job has no checkout of ${STATE_BRANCH} at ${STATE_DIRECTORY}/, so commit-state has no state to commit in`;
  if (!checkouts.some(({ index }) => index < at))
    return `the checkout of ${STATE_BRANCH} comes after the step, so the state is not there when it runs`;
  if (!checkouts.every(({ step }) => holdsBotSecret(step.with?.token)))
    return `the checkout of ${STATE_BRANCH} does not carry ${BOT_SECRET_EXPRESSION}, so commit-state cannot push the state as the bot`;
  return null;
}

export const commitStateFindings = (workflows) =>
  workflows.flatMap(commitStatesOf).flatMap((commit) => {
    const problem = stateCheckoutProblem(commit);
    return problem === null
      ? []
      : [{ rule: STATE_RULE, path: commit.path, detail: `job ${commit.jobName}, step "${commit.label}": ${problem}` }];
  });

export const pushingSteps = (workflows) =>
  workflows.flatMap(pushesOf).map(({ path, jobName, label }) => ({ path, job: jobName, step: label }));

export function botPushFindings(workflows) {
  return workflows.flatMap(pushesOf).flatMap((push) => {
    const problem = credentialProblem(push);
    return problem === null
      ? []
      : [{ rule: RULE, path: push.path, detail: `job ${push.jobName}, step "${push.label}": ${problem}` }];
  });
}
