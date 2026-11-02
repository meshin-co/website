import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(import.meta.dirname, 'repair-entry.mjs');
const GUARD = pathToFileURL(join(import.meta.dirname, 'fixtures', 'no-network.mjs')).href;
const HEAD = 'a'.repeat(40);
const ENV = {
  PATH: process.env.PATH,
  WRITING_PROVIDER: 'openai',
  OPENAI_WRITING_MODEL: 'gpt-6.1-terra',
  OPENAI_WRITING_INPUT_USD_PER_MILLION: '1',
  OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '5',
  GITHUB_REPOSITORY: 'meshin-co/website',
  GITHUB_TOKEN: 'gh-token-value',
  AUTOWRITER_OPENAI_API_KEY: 'sk-test-0123456789abcdef',
};

const repairFrom = (cwd) =>
  spawnSync(process.execPath, ['--import', GUARD, SCRIPT, '--pr', '7', '--head', HEAD], {
    cwd,
    env: ENV,
    encoding: 'utf8',
  });

const WHERE = [
  ['the repository root', REPO_ROOT],
  ['the directory above the repository', dirname(REPO_ROOT)],
  ['the scripts directory', import.meta.dirname],
];

for (const [name, cwd] of WHERE)
  test('run from ' + name + ' with a key, the real script loads its whole chain and stops at the head check', () => {
    const result = repairFrom(cwd);
    const line = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(line.outcome, 'stale', result.stderr);
    assert.match(line.reason, /^the working tree is at [0-9a-f]{40}, not at the judged head a{40}$/);
    assert.equal(result.status, 1);
  });
