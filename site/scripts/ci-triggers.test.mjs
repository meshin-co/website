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
