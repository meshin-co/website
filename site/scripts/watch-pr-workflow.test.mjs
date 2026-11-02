import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

const WORKFLOWS = join(import.meta.dirname, '..', '..', '.github', 'workflows');
const TEXT = readFileSync(join(WORKFLOWS, 'watch-pr.yml'), 'utf8');
const WORKFLOW = parse(TEXT);
const DAILY = parse(readFileSync(join(WORKFLOWS, 'write-daily.yml'), 'utf8'));
const { watch, repair, follow } = WORKFLOW.jobs;

const KEY = 'AUTOWRITER_OPENAI_API_KEY';
const PAT = 'AUTOWRITER_PAT';
const READ_ONLY = { contents: 'read', 'pull-requests': 'read', checks: 'read', actions: 'read' };
const WRITER_VARIABLES = [
  'WRITING_PROVIDER',
  'OPENAI_WRITING_MODEL',
  'OPENAI_WRITING_INPUT_USD_PER_MILLION',
  'OPENAI_WRITING_OUTPUT_USD_PER_MILLION',
  KEY,
];

const expression = (inside) => '$' + `{{ ${inside} }}`;
const needsOf = (job) => [job?.needs ?? []].flat();
const stepsOf = (job) => job?.steps ?? [];
const runsOf = (job) => stepsOf(job).flatMap((step) => (typeof step.run === 'string' ? [step.run] : []));
const usedBy = (job) => stepsOf(job).flatMap((step) => (step.uses ? [step.uses.split('@')[0]] : []));
const checkoutOf = (job) => stepsOf(job).find((step) => /^actions\/checkout@/.test(step.uses ?? ''));
const stepRunning = (job, pattern) => stepsOf(job).find((step) => pattern.test(step.run ?? ''));
const found = (step, name) => {
  assert.ok(step, `the workflow has no ${name} step`);
  return step;
};

const rewrite = stepsOf(repair).find((step) => step.id === 'rewrite');
const push = stepRunning(repair, /git .*push/);
const judge = stepsOf(watch).find((step) => step.id === 'judge');
const after = stepRunning(follow, /watch:pr/);

const holdersOf = (secret) =>
  Object.entries(WORKFLOW.jobs).flatMap(([name, job]) =>
    stepsOf(job).flatMap((step, index) =>
      Object.values(step.env ?? {}).some((value) => String(value).includes(`secrets.${secret}`))
        ? [`${name}[${index}]`]
        : []
    )
  );
const mentions = (secret) => TEXT.split(`secrets.${secret}`).length - 1;

test('the workflow marks every process it starts as unattended, so the seal and the Lighthouse record refuse', () => {
  assert.equal(WORKFLOW.env?.AUTOWRITER_UNATTENDED, '1');
  for (const job of Object.values(WORKFLOW.jobs)) assert.equal(job.env, undefined);
});

test('the jobs are the watcher, the repair and the follow-up, in the order the work flows', () => {
  assert.deepEqual(Object.keys(WORKFLOW.jobs), ['watch', 'repair', 'follow']);
});

test('the watch job keeps its guard, its tick environment, its limit and its permissions', () => {
  assert.equal(watch.if, "github.ref == 'refs/heads/main'");
  assert.equal(watch.environment, 'autowriter-tick');
  assert.equal(watch['timeout-minutes'], 5);
  assert.deepEqual(watch.permissions, { ...READ_ONLY, issues: 'write' });
});

test('the watch step is named judge, and its job hands the repair what it judged', () => {
  assert.match(found(judge, 'judge').run, /npm run watch:pr -- --pr "\$PULL_REQUEST" --observed "\$OBSERVED"/);
  assert.deepEqual(watch.outputs, {
    repair: expression('steps.judge.outputs.repair'),
    head: expression('steps.judge.outputs.head'),
    branch: expression('steps.judge.outputs.branch'),
  });
});

test('the repair job runs after the watcher, only when the watcher asked for a repair', () => {
  assert.deepEqual(needsOf(repair), ['watch']);
  assert.equal(repair?.if, "needs.watch.outputs.repair == 'true'");
  assert.equal(repair?.['runs-on'], 'ubuntu-latest');
  assert.equal(repair?.['timeout-minutes'], 30);
});

test('the repair job may read the repository, the pull request, the checks and the runs, and write nothing', () => {
  assert.deepEqual(repair?.permissions, READ_ONLY);
});

test('the repair job hands the follow-up the outcome of the step that ran the repair', () => {
  found(rewrite, 'rewrite');
  assert.deepEqual(repair?.outputs, { outcome: expression('steps.rewrite.outputs.outcome') });
});

test('the follow-up runs after both jobs, even after a repair that failed, and only when a repair was asked for', () => {
  assert.deepEqual(needsOf(follow).toSorted(), ['repair', 'watch']);
  assert.equal(follow?.if, "always() && needs.watch.outputs.repair == 'true'");
});

test('the follow-up has the permissions, the limit and the shape of the watch job, and no environment to wait in', () => {
  assert.deepEqual(follow?.permissions, watch.permissions);
  assert.equal(follow?.['timeout-minutes'], watch['timeout-minutes']);
  assert.equal(follow?.['runs-on'], watch['runs-on']);
  assert.equal(follow?.environment, undefined);
  assert.deepEqual(usedBy(follow), usedBy(watch));
  assert.ok(usedBy(follow).length > 0);
});

test('no job asks for write access to anything but issues, and only the two jobs that raise an escalation do', () => {
  assert.deepEqual(Object.keys(WORKFLOW.jobs), ['watch', 'repair', 'follow']);
  for (const [name, job] of Object.entries(WORKFLOW.jobs)) {
    const writes = Object.entries(job.permissions ?? {}).filter(([, level]) => level !== 'read');
    assert.deepEqual(writes, name === 'repair' ? [] : [['issues', 'write']], name);
  }
});

test('layer one against two repairs of one pull request: whole runs of the workflow queue one behind another', () => {
  assert.deepEqual(WORKFLOW.concurrency, { group: `watch-pr-${expression('inputs.pr')}`, 'cancel-in-progress': false });
});

test('layer one holds for the repair job too, because no job sets a concurrency group of its own', () => {
  assert.ok(repair, 'the workflow has no repair job');
  for (const [name, job] of Object.entries(WORKFLOW.jobs)) assert.equal(job.concurrency, undefined, name);
});

test('layer two against two repairs: the repair is pinned to the head the watcher judged, and says stale when it moved', () => {
  assert.equal(found(rewrite, 'rewrite').env.HEAD_SHA, expression('needs.watch.outputs.head'));
  assert.match(rewrite.run, /--head "\$HEAD_SHA"/);
  assert.equal(found(checkoutOf(repair), 'repair checkout').with.ref, expression('needs.watch.outputs.head'));
});

test('layer three against two repairs: the push is a plain fast-forward, which a branch that moved refuses', () => {
  assert.equal(found(push, 'push').if, "steps.rewrite.outputs.commit != ''");
  assert.match(push.run, /push origin "HEAD:refs\/heads\/\$BRANCH"/);
  assert.doesNotMatch(push.run, /--force|--force-with-lease|--mirror|--delete|\s-f\s|\s\+/);
});

test('the repair job checks out the head the watcher judged, whole, with no credential left on disk', () => {
  const { with: options } = found(checkoutOf(repair), 'repair checkout');

  assert.equal(options.ref, expression('needs.watch.outputs.head'));
  assert.equal(options['fetch-depth'], 0);
  assert.equal(options['persist-credentials'], false);
  assert.equal(options.token, undefined);
});

test('the repair job sets up the node version the site names, with the npm cache keyed by the lock file', () => {
  const setup = stepsOf(repair).find((step) => /^actions\/setup-node@/.test(step.uses ?? ''));

  assert.deepEqual(found(setup, 'setup-node').with, {
    'node-version-file': 'site/.nvmrc',
    cache: 'npm',
    'cache-dependency-path': 'site/package-lock.json',
  });
});

test('the repair job installs once, after the checkout, in a step that holds no secret and no credential', () => {
  const installs = stepsOf(repair).filter((step) => /^npm ci$/.test(step.run ?? ''));
  const order = stepsOf(repair).indexOf(installs[0]);

  assert.equal(installs.length, 1);
  assert.equal(installs[0].env, undefined);
  assert.ok(order > stepsOf(repair).indexOf(found(checkoutOf(repair), 'repair checkout')));
  assert.ok(order < stepsOf(repair).indexOf(found(rewrite, 'rewrite')));
  assert.ok(order < stepsOf(repair).indexOf(found(push, 'push')));
});

test('the watch job and the follow-up install nothing, because each holds a token that can merge', () => {
  assert.ok(follow, 'the workflow has no follow job');
  for (const job of [watch, follow]) {
    for (const text of runsOf(job)) assert.doesNotMatch(text, /npm (ci|install)|npx /);
    assert.deepEqual(usedBy(job), ['actions/checkout', 'actions/setup-node']);
  }
});

test('the repair step runs the command with the pull request and the head, tolerating its exit status, and echoes what it printed', () => {
  assert.match(
    found(rewrite, 'rewrite').run,
    /npm run --silent repair:entry -- --pr "\$PULL_REQUEST" --head "\$HEAD_SHA"/
  );
  assert.match(rewrite.run, /\|\| status=\$\?/);
  assert.match(rewrite.run, /cat "\$RUNNER_TEMP\//);
  assert.match(rewrite.run, /echo "outcome=.*" >> "\$GITHUB_OUTPUT"/);
  assert.match(rewrite.run, /echo "commit=.*" >> "\$GITHUB_OUTPUT"/);
});

test('the repair step gets the writer variables as the daily writer does, and the read token', () => {
  const daily = DAILY.jobs.write.steps.find((step) => step.id === 'write');
  const { env } = found(rewrite, 'rewrite');

  for (const name of WRITER_VARIABLES) assert.equal(env[name], daily.env[name], name);
  assert.equal(env.GITHUB_TOKEN, expression('github.token'));
  assert.equal(env.PULL_REQUEST, expression('inputs.pr'));
});

test('the model key is the environment of one step of one job, the repair step, and nowhere else', () => {
  assert.deepEqual(holdersOf(KEY), [`repair[${stepsOf(repair).indexOf(found(rewrite, 'rewrite'))}]`]);
  assert.equal(mentions(KEY), 1);
  assert.equal(WORKFLOW.env[KEY], undefined);
});

test('the bot token is the environment of one step in each job that needs it, and of none at job or workflow level', () => {
  assert.deepEqual(holdersOf(PAT), [
    `watch[${stepsOf(watch).indexOf(found(judge, 'judge'))}]`,
    `repair[${stepsOf(repair).indexOf(found(push, 'push'))}]`,
    `follow[${stepsOf(follow).indexOf(found(after, 'follow-up'))}]`,
  ]);
  assert.equal(mentions(PAT), 3);
  assert.equal(WORKFLOW.env[PAT], undefined);
});

test('no step before the push in the repair job holds the bot token, so the install runs with no push credential', () => {
  const before = stepsOf(repair).slice(0, stepsOf(repair).indexOf(found(push, 'push')));

  assert.ok(before.length >= 4, 'too few steps before the push to mean anything');
  for (const step of before) assert.doesNotMatch(JSON.stringify(step), new RegExp(PAT));
});

test('the push authenticates with a header given to that one command, and writes no credential to the git configuration', () => {
  assert.equal(found(push, 'push').env[PAT], expression(`secrets.${PAT}`));
  assert.equal(push.env.BRANCH, expression('needs.watch.outputs.branch'));
  assert.match(push.run, /git -c "http\.https:\/\/github\.com\/\.extraheader=AUTHORIZATION: basic \$credential" push/);
  assert.match(push.run, /::add-mask::\$credential/);
  assert.doesNotMatch(push.run, /git config|credential\.helper|--global|--local/);
});

test('the follow-up step gets the read token, the bot token and the webhook, and the two results it reads', () => {
  const { env, run } = found(after, 'follow-up');

  assert.equal(env.GITHUB_TOKEN, expression('github.token'));
  assert.equal(env[PAT], expression(`secrets.${PAT}`));
  assert.equal(env.SLACK_WEBHOOK_URL, expression('secrets.SLACK_WEBHOOK_URL'));
  assert.equal(env.PULL_REQUEST, expression('inputs.pr'));
  assert.equal(env.REPAIR_RESULT, expression('needs.repair.result'));
  assert.equal(env.REPAIR_OUTCOME, expression('needs.repair.outputs.outcome'));
  assert.match(run, /npm run watch:pr -- --pr "\$PULL_REQUEST" --after-repair "\$OUTCOME"/);
});

test('no script of any job interpolates an expression, because an expression in a script is a command injection', () => {
  const scripts = Object.values(WORKFLOW.jobs).flatMap(runsOf);

  assert.ok(scripts.length >= 5, 'the scan found too few scripts to mean anything');
  for (const text of scripts) assert.equal(text.includes('$' + '{{'), false, text);
});
