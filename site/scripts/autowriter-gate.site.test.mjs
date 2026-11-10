import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');

const gate = (root) =>
  spawnSync(process.execPath, ['scripts/autowriter-gate.mjs', root], { cwd: SITE, encoding: 'utf8' });

test('the command run against the real repository finds nothing, which is what CI runs', () => {
  const run = gate(REPO);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /, 0 findings$/m);
});
