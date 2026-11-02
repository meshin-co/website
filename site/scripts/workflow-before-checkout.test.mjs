import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';

const WORKFLOWS = resolve(import.meta.dirname, '..', '..', '.github', 'workflows');

const load = (file) => yaml.load(readFileSync(join(WORKFLOWS, file), 'utf8'));
const files = () => readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml'));
const isCheckout = (step) => String(step.uses ?? '').startsWith('actions/checkout');

const stepsBeforeCheckout = (workflow) => {
  const fallback = workflow.defaults?.run?.['working-directory'];
  const early = [];
  for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (isCheckout(step)) break;
      if (!step.run) continue;
      const directory = step['working-directory'] ?? job.defaults?.run?.['working-directory'] ?? fallback;
      if (directory && directory !== '.') early.push({ job: name, step: step.name ?? step.run, directory });
    }
  }
  return early;
};

test('no step runs before checkout in a directory the checkout has not created yet', () => {
  const offenders = files().flatMap((file) => stepsBeforeCheckout(load(file)).map((row) => ({ file, ...row })));

  assert.deepEqual(
    offenders,
    [],
    offenders.map(({ file, job, step, directory }) => `${file} ${job}: "${step}" runs in ${directory}`).join('; ')
  );
});

test('the rule is load-bearing: a planted early step in a built directory is caught', () => {
  const planted = {
    defaults: { run: { 'working-directory': 'site' } },
    jobs: { write: { steps: [{ name: 'an early step', run: 'echo hi' }, { uses: 'actions/checkout@v4' }] } },
  };

  assert.deepEqual(stepsBeforeCheckout(planted), [{ job: 'write', step: 'an early step', directory: 'site' }]);
});

test('a step that names the repository root before checkout is allowed, because that directory exists', () => {
  const allowed = {
    defaults: { run: { 'working-directory': 'site' } },
    jobs: {
      ready: { steps: [{ name: 'ask', run: 'echo hi', 'working-directory': '.' }, { uses: 'actions/checkout@v4' }] },
    },
  };

  assert.deepEqual(stepsBeforeCheckout(allowed), []);
});
