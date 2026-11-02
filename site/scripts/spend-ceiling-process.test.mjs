import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { MONTHLY_SPEND_CEILING_USD } from './autowriter-ledger.mjs';
import { spending, withScene } from './fixtures/spend-run.mjs';

const CEILING = MONTHLY_SPEND_CEILING_USD;
const SCRIPT = resolve(import.meta.dirname, 'spend-ceiling.mjs');
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');

const spawned = (cwd, args, env = {}) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '', ...env },
  });

test(
  'the command line gives the same answer from the repository root, from site and from a temporary directory',
  withScene((scene) => {
    scene.putLedger(spending('small-post', 3));
    scene.commit();
    const elsewhere = mkdtempSync(join(tmpdir(), 'spend-cwd-'));
    try {
      const args = ['--repo-root', scene.root, '--now', '2026-11-10T09:00:00Z'];
      const lines = [REPOSITORY_ROOT, join(REPOSITORY_ROOT, 'site'), elsewhere].map((cwd) => {
        const result = spawned(cwd, args);
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
      });
      assert.equal(new Set(lines).size, 1);
      assert.deepEqual(JSON.parse(lines[0]), {
        month: '2026-11',
        spentUsd: 3,
        ceilingUsd: CEILING,
        reached: false,
        notice: 'none',
      });
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  })
);

test('without --repo-root the command reads this repository, wherever it is started from', () => {
  const elsewhere = mkdtempSync(join(tmpdir(), 'spend-cwd-'));
  try {
    const args = ['--now', '2026-11-10T09:00:00Z'];
    const answers = [REPOSITORY_ROOT, join(REPOSITORY_ROOT, 'site'), elsewhere].map((cwd) => {
      const result = spawned(cwd, args);
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    });
    assert.equal(new Set(answers).size, 1);
    assert.equal(JSON.parse(answers[0]).month, '2026-11');
  } finally {
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

test(
  'a spawned run appends its outputs to the files GitHub names',
  withScene((scene) => {
    scene.putLedger(spending('small-post', 3));
    const files = mkdtempSync(join(tmpdir(), 'spend-files-'));
    try {
      const output = join(files, 'output');
      const summary = join(files, 'summary');
      writeFileSync(output, 'earlier=1\n');
      const args = ['--repo-root', scene.root, '--now', '2026-11-10T09:00:00Z'];
      const result = spawned(files, args, { GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary });
      assert.equal(result.status, 0, result.stderr);
      const lines = 'earlier=1\nstopped=false\nnotice=none\nledger=audits/autowriter/spend-ceiling-2026-11.json\n';
      assert.equal(readFileSync(output, 'utf8'), lines);
      assert.match(readFileSync(summary, 'utf8'), /No model was called by this job/);
    } finally {
      rmSync(files, { recursive: true, force: true });
    }
  })
);

function importClosure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  for (const [, specifier] of text.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
    if (specifier.startsWith('.')) importClosure(resolve(dirname(file), specifier), seen);
    else seen.add(specifier);
  }
  return seen;
}

test('the command needs no npm install: everything it imports is a node builtin or a local file', () => {
  const imported = [...importClosure(SCRIPT)];
  const packages = imported.filter((entry) => !entry.startsWith('/') && !entry.startsWith('node:'));
  assert.deepEqual(packages, []);
  assert.ok(imported.filter((entry) => entry.startsWith('/')).length > 5);
});
