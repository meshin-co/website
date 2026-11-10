import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { engineFindings } from './check-engine.mjs';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(import.meta.dirname, 'check-engine.mjs');

const run = (args, cwd) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });

test('this repository has no finding', () => {
  const found = engineFindings(REPOSITORY);
  assert.deepEqual(found.findings, []);
  assert.ok(found.values >= 25 && found.anchors >= 20, JSON.stringify(found));
});

test('the command passes on this repository from the repository root, from site and from anywhere', () => {
  for (const cwd of [REPOSITORY, join(REPOSITORY, 'site'), tmpdir()]) {
    const found = run([], cwd);
    assert.equal(found.status, 0, `from ${cwd}: ${found.stdout}${found.stderr}`);
    assert.match(found.stdout, /^engine: 0 findings /m);
    assert.match(found.stdout, /the interview must name every value, secret and variable\)$/m);
  }
});

test('a clean run of this repository does not point at the interview', () => {
  const clean = run([], REPOSITORY);
  assert.doesNotMatch(clean.stdout, /new-site-interview/);
});
