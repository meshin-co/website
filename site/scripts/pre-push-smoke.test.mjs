import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const HOOK = resolve(import.meta.dirname, '..', '..', '.githooks', 'pre-push');
const PACKAGE = resolve(import.meta.dirname, '..', 'package.json');

const hook = () => readFileSync(HOOK, 'utf8');

test('the hook runs the guard proof, because CI no longer does', () => {
  assert.match(hook(), /npm run --silent test:smoke/);
});

test('the hook watches every path that can change whether a guard fails', () => {
  const watched = hook();

  for (const path of ['site/scripts', 'site/tests/guard-mutations', 'site/package.json', '.github/workflows']) {
    assert.ok(watched.includes(path), `the hook does not watch ${path}`);
  }
});

test('the hook still refuses a tree no Lighthouse run measured, and does that first', () => {
  const text = hook();

  assert.ok(text.indexOf('run-lh-evidence.mjs check') < text.indexOf('test:smoke'), 'the cheap refusal runs first');
});

test('the smoke run is declared local-only with a reason, so gate:plan does not read CI as covering it', () => {
  const { localOnlyGates } = JSON.parse(readFileSync(PACKAGE, 'utf8'));

  assert.ok(localOnlyGates['test:smoke'], 'test:smoke has no localOnlyGates entry');
  assert.match(localOnlyGates['test:smoke'], /pre-push/);
});
