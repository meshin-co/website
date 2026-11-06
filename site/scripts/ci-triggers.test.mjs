import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';

const CI = resolve(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml');
const workflow = () => yaml.load(readFileSync(CI, 'utf8'));
const triggers = () => workflow().on ?? workflow()[true];

test('a branch commit is checked once, not once for the push and again for the pull request', () => {
  const on = triggers();

  assert.deepEqual(on.push?.branches, ['main'], 'push runs only on main; pull_request covers every branch');
  assert.ok('pull_request' in on, 'pull_request still runs, so a branch is checked before it merges');
});

test('main keeps its own run, because publishing reads the last green run on main', () => {
  const on = triggers();

  assert.ok(on.push.branches.includes('main'));
});

test('every job carries a timeout, because a hung step reads exactly like a slow one and blocks the merge for hours', () => {
  const jobs = Object.entries(workflow().jobs);
  const uncapped = jobs.filter(([, job]) => typeof job['timeout-minutes'] !== 'number');

  assert.deepEqual(
    uncapped.map(([name]) => name),
    [],
    'a job with no timeout-minutes runs until the 6 hour default'
  );
  assert.ok(
    jobs.every(([, job]) => job['timeout-minutes'] <= 20),
    'the longest job in a green run takes about 5 minutes, so 20 is already generous'
  );
});
