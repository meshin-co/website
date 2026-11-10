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

test('the hook proves a fresh copy of the engine green on every push, with no path list to get wrong', () => {
  const text = hook();
  const proof = text.indexOf('npm run --silent gate:export');

  assert.ok(proof > 0, 'the hook never proves a copy');
  assert.ok(text.indexOf('run-lh-evidence.mjs check') < proof, 'the cheap refusal runs first');
  const conditions = [...text.matchAll(/^fi$/gm)].map(({ index }) => index);
  assert.ok(conditions.length > 0, 'the hook holds no condition, so this proves nothing');
  assert.ok(Math.max(...conditions) < proof, 'the proof sits inside a condition, so some pushes skip it');
});

test('the export proof is declared local-only with a reason that names the hook as what runs it', () => {
  const { localOnlyGates } = JSON.parse(readFileSync(PACKAGE, 'utf8'));

  assert.match(localOnlyGates['gate:export'], /\.githooks\/pre-push runs it on every push/);
  assert.ok(!/run by hand/.test(localOnlyGates['gate:export']), 'the reason still says a person starts it');
});
