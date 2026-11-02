import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

const INSTALL = /npm (ci|install)\b/;
const PACKAGE = resolve(import.meta.dirname, '..', 'package.json');
const SCRIPTS = resolve(import.meta.dirname, '..');

const entriesOf = (run) => {
  const text = String(run ?? '');
  const found = new Set();
  for (const [, file] of text.matchAll(/node\s+(scripts\/[\w.-]+\.mjs)/g)) found.add(file);
  const defined = JSON.parse(readFileSync(PACKAGE, 'utf8')).scripts ?? {};
  for (const [, name] of text.matchAll(/npm run (?:--silent )?([\w:-]+)/g)) {
    for (const [, file] of String(defined[name] ?? '').matchAll(/(scripts\/[\w.-]+\.mjs)/g)) found.add(file);
  }
  return [...found];
};

const needsPackages = (entry) => {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file) || !existsSync(file)) return false;
    seen.add(file);
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('node:')) continue;
      if (!specifier.startsWith('.')) return true;
      if (walk(resolve(dirname(file), specifier))) return true;
    }
    return false;
  };
  return walk(resolve(SCRIPTS, entry));
};

const stepsBeforeInstall = (workflow) => {
  const early = [];
  for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
    const steps = job.steps ?? [];
    const installs = steps.findIndex((step) => INSTALL.test(step.run ?? ''));
    if (installs < 0) continue;
    for (const step of steps.slice(0, installs)) {
      const needy = entriesOf(step.run).filter(needsPackages);
      if (needy.length > 0) early.push({ job: name, step: step.name ?? step.run, entries: needy });
    }
  }
  return early;
};

test('no step runs a command that needs installed packages before the install that puts them on disk', () => {
  const offenders = files().flatMap((file) => stepsBeforeInstall(load(file)).map((row) => ({ file, ...row })));

  assert.deepEqual(
    offenders,
    [],
    offenders.map(({ file, job, step, entries }) => `${file} ${job}: "${step}" needs ${entries.join(', ')}`).join('; ')
  );
});

test('the install rule is load-bearing: a planted command that needs a package is caught', () => {
  const planted = {
    jobs: { write: { steps: [{ name: 'an early command', run: 'node scripts/entry-files.mjs' }, { run: 'npm ci' }] } },
  };

  assert.deepEqual(stepsBeforeInstall(planted), [
    { job: 'write', step: 'an early command', entries: ['scripts/entry-files.mjs'] },
  ]);
});

test('a command that imports nothing outside Node is allowed before the install', () => {
  const planted = {
    jobs: { write: { steps: [{ name: 'plain node', run: 'node scripts/site-brand.mjs' }, { run: 'npm ci' }] } },
  };

  assert.deepEqual(stepsBeforeInstall(planted), []);
});
