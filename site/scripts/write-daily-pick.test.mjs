import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { parse } from 'yaml';

const WORKFLOW = parse(
  readFileSync(join(import.meta.dirname, '..', '..', '.github', 'workflows', 'write-daily.yml'), 'utf8')
);
const { steps } = WORKFLOW.jobs.write;

const stepNamed = (text) => steps.find(({ name = '' }) => name.startsWith(text));
const NAMING = stepNamed('name the files');
const PICK = steps.find(({ id }) => id === 'pick');
const ESCALATE = stepNamed('escalate a pick that failed');
const CLAIM = steps.find(({ id }) => id === 'claim');
const INSTALL = stepNamed('install the site dependencies');

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const STUB_NPM = [
  '#!/usr/bin/env bash',
  'printf \'%s\\0\' "$@" >> "$STUB_LOG"',
  'cat "$STUB_STDOUT"',
  'exit "${STUB_STATUS:-0}"',
  '',
].join('\n');
const STUB_NODE = [
  '#!/usr/bin/env bash',
  'printf \'%s\\0\' "$@" >> "$STUB_LOG"',
  'printf \'\\n\' >> "$STUB_LOG"',
  '',
].join('\n');

function scene() {
  const root = mkdtempSync(join(tmpdir(), 'write-daily-pick-'));
  roots.push(root);
  for (const directory of ['bin', 'temp']) mkdirSync(join(root, directory));
  for (const [name, text] of [
    ['npm', STUB_NPM],
    ['node', STUB_NODE],
  ]) {
    writeFileSync(join(root, 'bin', name), text);
    chmodSync(join(root, 'bin', name), 0o755);
  }
  for (const file of [
    'calls.log',
    'stdout.txt',
    'github-output.txt',
    'summary.md',
    'decision.json',
    'pick-result.json',
  ]) {
    writeFileSync(join(root, file), '');
  }
  return root;
}

function runStep(step, { stdout = '', status = 0, decision, result, env = {} } = {}) {
  const root = scene();
  writeFileSync(join(root, 'stdout.txt'), stdout);
  if (decision !== undefined) writeFileSync(join(root, 'decision.json'), JSON.stringify(decision));
  if (result !== undefined) writeFileSync(join(root, 'pick-result.json'), result);
  const file = join(root, 'step.sh');
  writeFileSync(file, step.run);
  const outcome = spawnSync('bash', ['-e', file], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      HOME: root,
      RUNNER_TEMP: join(root, 'temp'),
      GITHUB_OUTPUT: join(root, 'github-output.txt'),
      GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
      GITHUB_RUN_ID: '4242',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_WORKSPACE: root,
      DECISION_FILE: join(root, 'decision.json'),
      PICK_RESULT_FILE: join(root, 'pick-result.json'),
      STUB_LOG: join(root, 'calls.log'),
      STUB_STDOUT: join(root, 'stdout.txt'),
      STUB_STATUS: String(status),
      ...env,
    },
  });
  const logged = readFileSync(join(root, 'calls.log'), 'utf8');
  return {
    root,
    status: outcome.status,
    printed: outcome.stdout + outcome.stderr,
    outputs: readFileSync(join(root, 'github-output.txt'), 'utf8'),
    result: readFileSync(join(root, 'pick-result.json'), 'utf8'),
    calls: logged
      .split('\n')
      .filter(Boolean)
      .map((call) => call.split('\0').filter(Boolean)),
  };
}

const failure = (patch = {}) => {
  const result = {
    ok: false,
    kind: 'credential',
    message: 'the key was refused',
    spend: { costUsd: 0.0123 },
    ...patch,
  };
  return `${JSON.stringify(result)}\n`;
};

test('the first step names the file the picker result goes to, beside the two files the later steps name', () => {
  const lines = NAMING.run.split('\n').filter(Boolean);
  assert.deepEqual(lines, [
    'echo "DECISION_FILE=$RUNNER_TEMP/decision.json" >> "$GITHUB_ENV"',
    'echo "PICK_RESULT_FILE=$RUNNER_TEMP/pick-result.json" >> "$GITHUB_ENV"',
    'echo "WRITE_RESULT_FILE=$RUNNER_TEMP/write-result.json" >> "$GITHUB_ENV"',
  ]);
  assert.equal(steps.indexOf(NAMING), 0);
});

test('the pick step has the five writer variables the category proposal needs, and the two term settings it already had', () => {
  assert.deepEqual(PICK.env, {
    WRITING_TERM_ARM: "${{ vars.WRITING_TERM_ARM || 'on' }}",
    WRITING_TERM_CAP: "${{ vars.WRITING_TERM_CAP || '1' }}",
    WRITING_PROVIDER: '${{ vars.WRITING_PROVIDER }}',
    OPENAI_WRITING_MODEL: '${{ vars.OPENAI_WRITING_MODEL }}',
    OPENAI_WRITING_INPUT_USD_PER_MILLION: '${{ vars.OPENAI_WRITING_INPUT_USD_PER_MILLION }}',
    OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '${{ vars.OPENAI_WRITING_OUTPUT_USD_PER_MILLION }}',
    AUTOWRITER_OPENAI_API_KEY: '${{ secrets.AUTOWRITER_OPENAI_API_KEY }}',
  });
});

test('the pick step gets the same writer variables as the write step, so a proposal and a draft use one model and one price', () => {
  const writing = stepNamed('write the entries on a local branch').env;
  for (const name of Object.keys(writing)) assert.equal(PICK.env[name], writing[name], name);
});

test('the pick step runs the picker with --write and the files the claim step reads, and the install step runs first', () => {
  assert.ok(steps.indexOf(INSTALL) < steps.indexOf(PICK));
  const { root, status, calls } = runStep(PICK, { decision: { decision: 'write' } });
  assert.equal(status, 0);
  assert.deepEqual(calls[0], [
    'run',
    '--silent',
    'pick:topic',
    '--',
    '--write',
    '--output',
    join(root, 'decision.json'),
    '--summary',
    join(root, 'summary.md'),
    '--run-id',
    '4242-2',
  ]);
});

test('a picker that succeeds hands the decision to the later steps and keeps its last line in the result file', () => {
  const printed = 'choosing\n{"ok":true,"decision":"write"}\n';
  const found = runStep(PICK, { stdout: printed, decision: { decision: 'write' } });
  assert.equal(found.status, 0);
  assert.equal(found.outputs, 'decision=write\n');
  assert.equal(found.result, '{"ok":true,"decision":"write"}\n');
  assert.ok(found.printed.includes('choosing'), 'the output of the picker was not echoed into the log');
});

test('a picker that decides on no entry still hands that decision on, so the nothing-picked ending can post', () => {
  const found = runStep(PICK, { stdout: 'nothing\n', decision: { decision: 'none' } });
  assert.equal(found.status, 0);
  assert.equal(found.outputs, 'decision=none\n');
});

test('a picker that fails fails the step with its own exit status, keeps its last line, and hands no decision on', () => {
  const found = runStep(PICK, { stdout: `looking\n${failure()}`, status: 1, decision: { decision: 'write' } });
  assert.equal(found.status, 1);
  assert.equal(found.outputs, '');
  assert.equal(found.result, failure());
  assert.ok(found.printed.includes('looking'));
});

test('a picker that prints nothing before it fails leaves an empty last line, which the escalation reads as no result', () => {
  const found = runStep(PICK, { stdout: '', status: 3 });
  assert.equal(found.status, 3);
  assert.equal(found.outputs, '');
});

test('the escalation of a failed pick runs straight after the pick, before anything is claimed, and only when the pick failed', () => {
  assert.equal(steps.indexOf(ESCALATE), steps.indexOf(PICK) + 1);
  assert.ok(steps.indexOf(ESCALATE) < steps.indexOf(CLAIM));
  assert.equal(ESCALATE.if, "failure() && steps.pick.outcome == 'failure'");
  assert.deepEqual(ESCALATE.env, {
    GITHUB_TOKEN: '${{ github.token }}',
    SLACK_WEBHOOK_URL: '${{ secrets.SLACK_WEBHOOK_URL }}',
  });
});

test('no other step reads the picker result, and the write result file stays the write step own', () => {
  const readers = steps.filter(({ run = '' }) => run.includes('PICK_RESULT_FILE')).map(({ name }) => name);
  assert.deepEqual(readers, [NAMING.name, PICK.name, ESCALATE.name]);
});

const escalating = (result, options = {}) => runStep(ESCALATE, { result, ...options });
const flagValue = (args, flag) => args[args.indexOf(flag) + 1];

for (const kind of ['credential', 'config', 'model', 'price']) {
  test(`a pick that failed with kind ${kind} is escalated as a credential problem under the slug topic-proposal`, () => {
    const found = escalating(failure({ kind }));
    assert.equal(found.status, 0, found.printed);
    assert.equal(found.calls.length, 1);
    const [args] = found.calls;
    assert.equal(args[0], 'scripts/escalate-run.mjs');
    assert.equal(flagValue(args, '--slug'), 'topic-proposal');
    assert.equal(flagValue(args, '--kind'), 'credential');
    assert.equal(flagValue(args, '--ledger-dir'), join(found.root, 'temp', 'escalations'));
    assert.equal(flagValue(args, '--title'), `Write daily could not choose what to write (${kind})`);
    const detail = flagValue(args, '--detail');
    assert.ok(detail.includes(`npm run pick:topic failed with kind ${kind}: the key was refused.`), detail);
    assert.ok(detail.includes('0.0123 USD'), detail);
    assert.ok(detail.includes('Nothing was claimed and nothing was written'), detail);
  });
}

for (const kind of ['vendor', 'output', 'proposal-failed', 'commit', 'unexpected', 'something-new']) {
  test(`a pick that failed with kind ${kind} is escalated as a hard stop, because only the four credential kinds are the owner's to fix`, () => {
    const found = escalating(failure({ kind }));
    assert.equal(found.status, 0, found.printed);
    assert.equal(flagValue(found.calls[0], '--kind'), 'hard-stop');
    assert.equal(flagValue(found.calls[0], '--slug'), 'topic-proposal');
    assert.equal(flagValue(found.calls[0], '--title'), `Write daily could not choose what to write (${kind})`);
  });
}

test('a pick that failed without printing a result is escalated as a hard stop with the words for no result', () => {
  const noResults = [
    escalating(undefined),
    escalating(''),
    escalating('\n'),
    escalating('Error: boom\n'),
    escalating('[]\n'),
    escalating(undefined, { env: { PICK_RESULT_FILE: join(tmpdir(), 'no-such-dir', 'pick-result.json') } }),
  ];
  for (const found of noResults) {
    assert.equal(found.status, 0, found.printed);
    const [args] = found.calls;
    assert.equal(flagValue(args, '--kind'), 'hard-stop');
    assert.equal(flagValue(args, '--title'), 'Write daily could not choose what to write (unexpected)');
    assert.ok(flagValue(args, '--detail').includes('the picker printed no result'));
    assert.ok(flagValue(args, '--detail').includes('unknown USD'));
  }
});

test('a result without a spend figure still escalates, with the cost shown as unknown', () => {
  const found = escalating('{"ok":false,"kind":"model","message":"the model refused"}\n');
  assert.equal(flagValue(found.calls[0], '--kind'), 'credential');
  assert.ok(flagValue(found.calls[0], '--detail').includes('unknown USD'));
});

test('the escalation step never fails for the shape of the result, so the run reports the pick failure and not a jq error', () => {
  for (const result of ['{"kind":', '"just a string"\n', 'null\n', '42\n']) {
    assert.equal(escalating(result).status, 0, result);
  }
});
