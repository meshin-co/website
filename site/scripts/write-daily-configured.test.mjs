import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';

const WORKFLOW = resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'write-daily.yml');
const workflow = () => yaml.load(readFileSync(WORKFLOW, 'utf8'));

const REQUIRED_SECRETS = [
  'AUTOWRITER_PAT',
  'AUTOWRITER_OPENAI_API_KEY',
  'GSC_SERVICE_ACCOUNT_JSON',
  'SLACK_WEBHOOK_URL',
];

const SOURCE_OF = /\$\{\{\s*(secrets|vars)\.([A-Z0-9_]+)/g;

const namesRead = (workflow, source) => {
  const found = new Set();
  for (const [, kind, name] of JSON.stringify(workflow).matchAll(SOURCE_OF)) if (kind === source) found.add(name);
  return found;
};

test('a run with no secrets configured stops at the first job instead of failing every morning', () => {
  const jobs = workflow().jobs;
  assert.ok(jobs.configured, 'the workflow has a configured job');
  const body = JSON.stringify(jobs.configured);
  for (const name of REQUIRED_SECRETS) {
    assert.ok(body.includes(name), `the configured job reads ${name}`);
  }
  assert.equal(typeof jobs.configured.outputs?.ready, 'string');
});

test('the readiness job checks every name the run reads, so no absent value is found only after money was spent', () => {
  const loaded = workflow();
  const checked = JSON.stringify(loaded.jobs.configured);
  const optional = new Set(['WRITING_TERM_ARM', 'WRITING_TERM_CAP']);

  const unchecked = [...namesRead(loaded, 'secrets'), ...namesRead(loaded, 'vars')]
    .filter((name) => !optional.has(name))
    .filter((name) => !checked.includes(name));

  assert.deepEqual(unchecked, [], `the readiness job never looks at ${unchecked.join(', ')}`);
});

test('every spending job waits for the readiness verdict, so none can run unconfigured', () => {
  const jobs = workflow().jobs;
  for (const [name, job] of Object.entries(jobs)) {
    if (name === 'configured') continue;
    const needs = [job.needs ?? []].flat();
    assert.ok(needs.includes('configured'), `${name} needs the configured job`);
    assert.match(String(job.if), /needs\.configured\.outputs\.ready == 'true'/, `${name} runs only when ready`);
  }
});

test('the readiness job needs no secret of its own to report that secrets are missing', () => {
  const steps = workflow().jobs.configured.steps ?? [];
  const checkout = steps.find((step) => String(step.uses ?? '').startsWith('actions/checkout'));
  assert.equal(checkout?.with?.token, undefined, 'the readiness job checks out with no bot token');
});
