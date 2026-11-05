import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { parse } from 'yaml';

import { OUTCOMES } from './repair-outcome.mjs';
import { FIXTURE_IDENTITY, GIT_ENVIRONMENT } from './fixtures/route-repo.mjs';

const WORKFLOW_FILE = join(import.meta.dirname, '..', '..', '.github', 'workflows', 'watch-pr.yml');
const { repair, follow } = parse(readFileSync(WORKFLOW_FILE, 'utf8')).jobs;

const stepOf = (job, matches) => (job?.steps ?? []).find(matches);
const scriptOf = (step, name) => {
  assert.ok(step, `the workflow has no ${name} step`);
  return step.run;
};

const REWRITE = stepOf(repair, (step) => step.id === 'rewrite');
const CATCH_UP = stepOf(repair, (step) => step.id === 'catchup');
const PUSH = stepOf(repair, (step) => /git .*push/.test(step.run ?? ''));
const AFTER = stepOf(follow, (step) => /watch:pr/.test(step.run ?? ''));

const HEAD = 'a'.repeat(40);
const COMMIT = 'c'.repeat(40);
const PAT_VALUE = 'ghp_secret-bot-token-1234';
const STUB_NPM = [
  '#!/bin/sh',
  'printf \'%s\\n\' "$*" >> "$STUB_LOG"',
  'cat "$STUB_STDOUT"',
  'exit "${STUB_STATUS:-0}"',
  '',
].join('\n');

const scenes = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) rmSync(scene, { recursive: true, force: true });
});

function scene() {
  const root = mkdtempSync(join(tmpdir(), 'watch-workflow-'));
  scenes.push(root);
  for (const directory of ['bin', 'temp']) mkdirSync(join(root, directory));
  writeFileSync(join(root, 'bin', 'npm'), STUB_NPM);
  chmodSync(join(root, 'bin', 'npm'), 0o755);
  for (const file of ['npm.log', 'npm.out', 'github-output.txt']) writeFileSync(join(root, file), '');
  return root;
}

function runScript(script, { root, cwd = root, env = {}, stdout = '', status = 0 }) {
  writeFileSync(join(root, 'npm.out'), stdout);
  const file = join(root, 'step.sh');
  writeFileSync(file, script);
  const outcome = spawnSync('bash', ['-e', file], {
    cwd,
    encoding: 'utf8',
    env: {
      ...GIT_ENVIRONMENT,
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      RUNNER_TEMP: join(root, 'temp'),
      GITHUB_OUTPUT: join(root, 'github-output.txt'),
      STUB_LOG: join(root, 'npm.log'),
      STUB_STDOUT: join(root, 'npm.out'),
      STUB_STATUS: String(status),
      PULL_REQUEST: '72',
      HEAD_SHA: HEAD,
      ...env,
    },
  });
  return {
    status: outcome.status,
    printed: outcome.stdout + outcome.stderr,
    outputs: readFileSync(join(root, 'github-output.txt'), 'utf8'),
    commands: readFileSync(join(root, 'npm.log'), 'utf8').trim().split('\n').filter(Boolean),
  };
}

const lastLine = (patch) =>
  JSON.stringify({ ok: false, outcome: 'no-convergence', commit: null, reason: 'a reason', ...patch });
const rewriting = (stdout, status = 1) => runScript(scriptOf(REWRITE, 'rewrite'), { root: scene(), stdout, status });
const catching = (stdout, status = 1) => runScript(scriptOf(CATCH_UP, 'catchup'), { root: scene(), stdout, status });
const CATCH_UP_ONLY = ['conflict', 'unconverged'];

test('a repair that made a commit hands the workflow its outcome and the commit to push, and the step passes', () => {
  const printed = `fetching the findings\n${lastLine({ ok: true, outcome: 'repaired', commit: COMMIT })}\n`;
  const found = rewriting(printed, 0);

  assert.equal(found.status, 0);
  assert.equal(found.outputs, `outcome=repaired\ncommit=${COMMIT}\n`);
  assert.ok(found.printed.includes('fetching the findings'), 'the output of the command was not echoed');
  assert.deepEqual(found.commands, [`run --silent repair:entry -- --pr 72 --head ${HEAD}`]);
});

test('a stop after the model was called hands over the ledger-only commit too, and the step passes though the command failed', () => {
  const found = rewriting(`${lastLine({ commit: COMMIT })}\n`, 1);

  assert.equal(found.status, 0);
  assert.equal(found.outputs, `outcome=no-convergence\ncommit=${COMMIT}\n`);
});

test('a stop before any model was called has no commit to push', () => {
  const found = rewriting(`${lastLine({ outcome: 'spend-ceiling', commit: null })}\n`);

  assert.equal(found.outputs, 'outcome=spend-ceiling\ncommit=\n');
});

test("an output that is not the command's JSON is an outcome of failed, with no commit", () => {
  for (const printed of [
    'Error: boom\n',
    '',
    '\n',
    'not json at all',
    '[]\n',
    '{"ok":true}\n',
    '{"outcome":5,"commit":7}\n',
  ]) {
    const found = rewriting(printed);

    assert.equal(found.status, 0, JSON.stringify(printed));
    assert.equal(found.outputs, 'outcome=failed\ncommit=\n', JSON.stringify(printed));
  }
});

test('only the last line is read, so an earlier line of JSON in the output cannot answer for the command', () => {
  const found = rewriting(`${lastLine({ outcome: 'repaired', commit: COMMIT })}\n${lastLine({ outcome: 'stale' })}\n`);

  assert.equal(found.outputs, 'outcome=stale\ncommit=\n');
});

test('a word with a line break cannot write a second workflow output, and a commit that is not a hash is no commit', () => {
  const injected = rewriting(`${lastLine({ outcome: 'repaired\nrepair=true', commit: 'not-a-hash' })}\n`);

  assert.equal(injected.outputs, 'outcome=failed\ncommit=\n');
  assert.equal(injected.outputs.split('\n').filter(Boolean).length, 2);
});

test('a commit that is not exactly forty lowercase hexadecimal digits is no commit, and cannot carry a line break', () => {
  const candidates = ['g'.repeat(40), 'A'.repeat(40), 'abc1234', 'a'.repeat(39), 'a'.repeat(41)];
  candidates.push('aaaa\nfoo=bar'.padEnd(40, 'b'), `${COMMIT}\nfoo=bar`);
  for (const commit of candidates) {
    const found = rewriting(`${lastLine({ outcome: 'repaired', commit })}\n`);

    assert.equal(found.outputs, 'outcome=repaired\ncommit=\n', JSON.stringify(commit));
  }
});

test('an outcome in capitals, with a space or with a path in it is not an outcome the follow-up could read', () => {
  for (const outcome of ['Repaired', 'no convergence', '../stale', 'stale;id', 'a'.repeat(5) + '\n' + 'b'.repeat(5)]) {
    const found = rewriting(`${lastLine({ outcome })}\n`);

    assert.equal(found.outputs, 'outcome=failed\ncommit=\n', JSON.stringify(outcome));
  }
});

test('every outcome the repair command can print passes through the step unchanged', () => {
  for (const outcome of OUTCOMES.filter((word) => !CATCH_UP_ONLY.includes(word))) {
    const found = rewriting(`${lastLine({ outcome })}\n`);

    assert.equal(found.outputs, `outcome=${outcome}\ncommit=\n`, outcome);
  }
});

test('a catch-up hands the workflow the merge commit to push, and every outcome it can print passes unchanged', () => {
  const merged = catching(`${lastLine({ ok: true, outcome: 'repaired', commit: COMMIT })}\n`, 0);

  assert.equal(merged.status, 0);
  assert.equal(merged.outputs, `outcome=repaired\ncommit=${COMMIT}\n`);
  assert.deepEqual(merged.commands, [`run --silent catch-up:entry -- --head ${HEAD}`]);
  for (const outcome of ['stale', 'conflict', 'unconverged', 'failed'])
    assert.equal(catching(`${lastLine({ outcome })}\n`).outputs, `outcome=${outcome}\ncommit=\n`, outcome);
});

test('a word the catch-up command cannot print is failed, and a commit that is not a whole hash is dropped', () => {
  for (const outcome of ['no-convergence', 'unrepairable', 'spend-ceiling', 'credential', 'nonsense'])
    assert.equal(catching(`${lastLine({ outcome })}\n`).outputs, 'outcome=failed\ncommit=\n', outcome);
  assert.equal(catching('no json here\n').outputs, 'outcome=failed\ncommit=\n');
  assert.equal(
    catching(`${lastLine({ outcome: 'repaired', commit: 'abc' })}\n`).outputs,
    'outcome=repaired\ncommit=\n'
  );
});

test('a lowercase word that is not one of the outcomes is failed, so the follow-up is never given a word it refuses', () => {
  for (const outcome of ['fixed', 'repair', 'unknown-outcome', 'no-convergence-at-all', 'staler']) {
    const found = rewriting(`${lastLine({ outcome })}\n`);

    assert.equal(found.outputs, 'outcome=failed\ncommit=\n', outcome);
  }
});

const FOLLOWING = [
  ['repaired', 'success', 'repaired'],
  ['repaired', 'failure', 'failed'],
  ['repaired', 'cancelled', 'failed'],
  ['repaired', 'skipped', 'failed'],
  ['', 'success', 'failed'],
  ['', 'failure', 'failed'],
  ['', 'cancelled', 'failed'],
  ['', 'skipped', 'failed'],
  ['stale', 'success', 'stale'],
  ['no-convergence', 'success', 'no-convergence'],
  ['no-convergence', 'failure', 'no-convergence'],
  ['spend-ceiling', 'success', 'spend-ceiling'],
  ['failed', 'success', 'failed'],
];

for (const [outcome, result, expected] of FOLLOWING) {
  test(`a repair job that ${result === 'success' ? 'passed' : `ended as ${result}`} with the outcome "${outcome}" is followed up as ${expected}`, () => {
    const env = { REPAIR_OUTCOME: outcome, REPAIR_RESULT: result };
    const found = runScript(scriptOf(AFTER, 'follow-up'), { root: scene(), env });

    assert.equal(found.status, 0);
    assert.deepEqual(found.commands, [`run watch:pr -- --pr 72 --after-repair ${expected}`]);
  });
}

test('the follow-up step fails when the watcher command fails, so the run is red and the pull request is not forgotten', () => {
  const env = { REPAIR_OUTCOME: 'stale', REPAIR_RESULT: 'success' };
  const found = runScript(scriptOf(AFTER, 'follow-up'), { root: scene(), env, status: 1 });

  assert.equal(found.status, 1);
});

const git = (cwd, ...args) =>
  execFileSync('git', [...FIXTURE_IDENTITY, ...args], {
    cwd,
    env: GIT_ENVIRONMENT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const BRANCH = 'autowriter/a-slug';

function repository() {
  const root = scene();
  git(root, 'init', '--bare', '--initial-branch=main', 'remote.git');
  git(root, 'clone', '--quiet', 'remote.git', 'person');
  const person = join(root, 'person');
  git(person, 'checkout', '-b', BRANCH);
  git(person, 'commit', '--allow-empty', '-m', 'the head the watcher judged');
  git(person, 'push', '--quiet', 'origin', BRANCH);
  const judged = git(person, 'rev-parse', 'HEAD').trim();
  git(root, 'clone', '--quiet', 'remote.git', 'runner');
  const runner = join(root, 'runner');
  git(runner, 'checkout', '--quiet', '--detach', judged);
  git(runner, 'commit', '--allow-empty', '-m', 'the repair');
  return {
    root,
    runner,
    person,
    judged,
    repaired: git(runner, 'rev-parse', 'HEAD').trim(),
    remote: join(root, 'remote.git'),
  };
}

const tipOf = (remote) => git(remote, 'rev-parse', `refs/heads/${BRANCH}`).trim();
const pushing = (found, env = {}) =>
  runScript(scriptOf(PUSH, 'push'), {
    root: found.root,
    cwd: found.runner,
    env: { AUTOWRITER_PAT: PAT_VALUE, BRANCH, ...env },
  });

test('the push moves the branch from the head the watcher judged to the repair commit', () => {
  const found = repository();
  const pushed = pushing(found);

  assert.equal(pushed.status, 0, pushed.printed);
  assert.equal(tipOf(found.remote), found.repaired);
});

test('the push is refused when the branch moved since the head the watcher judged, and the branch keeps what was pushed', () => {
  const found = repository();
  git(found.person, 'commit', '--allow-empty', '-m', 'a person pushed first');
  git(found.person, 'push', '--quiet', 'origin', BRANCH);
  const theirs = git(found.person, 'rev-parse', 'HEAD').trim();
  const pushed = pushing(found);

  assert.notEqual(pushed.status, 0);
  assert.equal(tipOf(found.remote), theirs);
  assert.notEqual(tipOf(found.remote), found.repaired);
});

test('the push leaves no credential in the git configuration of the checkout, and never prints the token', () => {
  const found = repository();
  const pushed = pushing(found);
  const config = git(found.runner, 'config', '--list') + readFileSync(join(found.runner, '.git', 'config'), 'utf8');
  const encoded = Buffer.from(`x-access-token:${PAT_VALUE}`).toString('base64');
  const echoed = pushed.printed.split('\n').filter((line) => line.includes(encoded));

  assert.equal(pushed.status, 0, pushed.printed);
  assert.doesNotMatch(config, /extraheader|AUTHORIZATION/i);
  assert.equal(config.includes(PAT_VALUE) || config.includes(encoded), false);
  assert.equal(pushed.printed.includes(PAT_VALUE), false);
  assert.deepEqual(echoed, [`::add-mask::${encoded}`]);
});

test('the branch name is data to the push, never a command', () => {
  const found = repository();
  const pushed = pushing(found, { BRANCH: `${BRANCH}; touch injected` });

  assert.notEqual(pushed.status, 0);
  assert.equal(existsSync(join(found.runner, 'injected')), false);
  assert.equal(tipOf(found.remote), found.judged);
});
