import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

import { UNATTENDED_VARIABLE, isUnattended } from './human-only.mjs';

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');
const WORKFLOWS = join(REPOSITORY_ROOT, '.github', 'workflows');
const SCRIPTS = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'site', 'package.json'), 'utf8')).scripts;
const AUTOWRITER_WORKFLOWS = ['write-daily.yml', 'watch-pr.yml', 'resume-pr.yml'];
const HUMAN_ONLY_SCRIPTS = ['assets:seal', 'lh:record', 'gate:lh'];
const HUMAN_ONLY_COMMANDS = [
  { name: 'the disposition seal', pattern: /editorial-gate\.mjs[^\n]*--seal/ },
  { name: 'the Lighthouse record', pattern: /run-lh-evidence\.mjs\s+record/ },
  { name: 'the Lighthouse driver', pattern: /run-lh-parallel\.mjs/ },
];
const RUNS_THE_AUTOWRITER = /write:entry|watch:pr|resume:pr|pick:topic|write-entry\.mjs|pr-watch\.mjs|pr-resume/;
const NPM_RUN = /\bnpm\s+(?:run|run-script)\s+(?:(?:--silent|-s|--if-present)\s+)*([A-Za-z0-9:_.-]+)/g;
const NPM_TEST = /\bnpm\s+(?:test|t)\b/;

const workflows = Object.fromEntries(
  readdirSync(WORKFLOWS)
    .filter((name) => name.endsWith('.yml'))
    .map((name) => [name, parse(readFileSync(join(WORKFLOWS, name), 'utf8'))])
);

const stepsOf = (workflow) => Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
const runTextsOf = (workflow) => stepsOf(workflow).flatMap((step) => (typeof step.run === 'string' ? [step.run] : []));

const scriptsNamedIn = (text) => [
  ...[...text.matchAll(NPM_RUN)].map((match) => match[1]),
  ...(NPM_TEST.test(text) ? ['test'] : []),
];

function reachedFrom(texts, scripts) {
  const reached = new Set();
  const queue = texts.flatMap(scriptsNamedIn);
  while (queue.length > 0) {
    const name = queue.shift();
    if (reached.has(name)) continue;
    reached.add(name);
    if (typeof scripts[name] === 'string') queue.push(...scriptsNamedIn(scripts[name]));
  }
  return reached;
}

function humanOnlyReachedFrom(texts, scripts) {
  const reached = reachedFrom(texts, scripts);
  const bodies = [
    ...texts,
    ...[...reached].flatMap((name) => (typeof scripts[name] === 'string' ? [scripts[name]] : [])),
  ];
  return [
    ...HUMAN_ONLY_SCRIPTS.filter((name) => reached.has(name)).map((name) => `npm script ${name}`),
    ...HUMAN_ONLY_COMMANDS.filter(({ pattern }) => bodies.some((body) => pattern.test(body))).map(({ name }) => name),
  ];
}

const marked = (value) => isUnattended({ [UNATTENDED_VARIABLE]: String(value) });

const envOverrides = (workflow) => [
  ...Object.values(workflow.jobs ?? {}).map((job) => job.env?.[UNATTENDED_VARIABLE]),
  ...stepsOf(workflow).map((step) => step.env?.[UNATTENDED_VARIABLE]),
];

for (const name of AUTOWRITER_WORKFLOWS) {
  test(`${name} declares ${UNATTENDED_VARIABLE} at workflow level, so every process it starts inherits the marker`, () => {
    assert.ok(name in workflows, `${name} is missing`);
    assert.equal(marked(workflows[name].env?.[UNATTENDED_VARIABLE]), true);
  });

  test(`no job or step of ${name} overrides the marker with a value that is not one`, () => {
    for (const value of envOverrides(workflows[name]).filter((entry) => entry !== undefined))
      assert.equal(marked(value), true, JSON.stringify(value));
  });
}

test('a workflow that runs the writer, the topic picker, the watcher or the resume sweep is one of the workflows that carry the marker', () => {
  const running = Object.entries(workflows)
    .filter(([, workflow]) => runTextsOf(workflow).some((text) => RUNS_THE_AUTOWRITER.test(text)))
    .map(([name]) => name)
    .sort();

  assert.deepEqual(running, [...AUTOWRITER_WORKFLOWS].sort());
});

test('the pattern that finds the autowriter workflows can fail: it reads each of their commands and passes a bystander', () => {
  const commands = [
    'npm run write:entry',
    'npm run watch:pr -- --pr "$PULL_REQUEST"',
    'npm run --silent resume:pr',
    'node scripts/run-pr-resume.mjs',
    'node scripts/pr-resume.mjs',
    'npm run pick:topic',
  ];
  const bystanders = ['npm run build', 'npm run gate:links', 'npm ci', 'echo resume'];

  for (const text of commands) assert.match(text, RUNS_THE_AUTOWRITER, text);
  for (const text of bystanders) assert.doesNotMatch(text, RUNS_THE_AUTOWRITER, text);
});

test('the three human-only scripts exist, so the scan below is looking for something real', () => {
  for (const name of HUMAN_ONLY_SCRIPTS) assert.equal(typeof SCRIPTS[name], 'string', name);
});

for (const [name, workflow] of Object.entries(workflows)) {
  test(`${name} runs neither the seal, nor the Lighthouse record, nor the Lighthouse gate, directly or through a script`, () => {
    assert.deepEqual(humanOnlyReachedFrom(runTextsOf(workflow), SCRIPTS), []);
  });
}

test('the scan reads something: the workflows hold run steps and reach package scripts', () => {
  const texts = Object.values(workflows).flatMap(runTextsOf);
  assert.ok(texts.length > 10);
  assert.ok(reachedFrom(texts, SCRIPTS).size > 10);
});

test('the scan can fail: it finds each human-only command in a planted workflow step', () => {
  const planted = {
    'npm run lh:record': ['npm script lh:record', 'the Lighthouse record'],
    'npm run --silent gate:lh -- --x': ['npm script gate:lh', 'the Lighthouse driver'],
    'npm run assets:seal': ['npm script assets:seal', 'the disposition seal'],
    'node scripts/editorial-gate.mjs . dist --seal': ['the disposition seal'],
    'node site/scripts/run-lh-evidence.mjs record "$GATE_PHASE"': ['the Lighthouse record'],
    'node scripts/run-lh-parallel.mjs': ['the Lighthouse driver'],
  };
  for (const [text, expected] of Object.entries(planted))
    assert.deepEqual(humanOnlyReachedFrom([text], SCRIPTS).sort(), expected.sort(), text);
});

test('the scan follows one script into another', () => {
  const scripts = {
    all: 'npm run first && npm run --silent second',
    first: 'echo ok',
    second: 'npm run assets:seal',
    'assets:seal': 'x',
  };

  assert.deepEqual(humanOnlyReachedFrom(['npm run all'], scripts), ['npm script assets:seal']);
});

test('the scan does not flag a clean step, a read-only lh:check or the editorial check', () => {
  const clean = [
    'npm run lh:check',
    'npm run gate:editorial',
    'node scripts/editorial-gate.mjs . dist --check',
    'npm ci',
  ];

  assert.deepEqual(humanOnlyReachedFrom(clean, SCRIPTS), []);
});
