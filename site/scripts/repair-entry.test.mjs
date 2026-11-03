import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { runCli } from './repair-entry.mjs';

const KEY = 'AUTOWRITER_OPENAI_API_KEY';
const HEAD = 'a'.repeat(40);
const COMMIT = 'c'.repeat(40);
const NOW = new Date('2026-11-02T08:00:00.000Z');
const secret = () => 'sk-test-' + randomBytes(18).toString('hex');
const configured = (key) => ({
  WRITING_PROVIDER: 'openai',
  OPENAI_WRITING_MODEL: 'gpt-6.1-terra',
  OPENAI_WRITING_INPUT_USD_PER_MILLION: '1',
  OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '5',
  GITHUB_REPOSITORY: 'meshin-co/website',
  GITHUB_TOKEN: 'gh-token-value',
  ...(key === undefined ? {} : { [KEY]: key }),
});

const roots = [];
after(() => roots.forEach(removeRepo));

const snapshot = (directory) =>
  readdirSync(directory, { recursive: true })
    .map((name) => join(directory, name))
    .filter((file) => statSync(file).isFile())
    .map((file) => [file, readFileSync(file, 'utf8')])
    .sort();

async function invoke({ argv = ['--pr', '7', '--head', HEAD], env, repair }) {
  const root = makeRepo();
  roots.push(root);
  const out = [];
  const err = [];
  const asked = [];
  let fetched = 0;
  const before = JSON.stringify(snapshot(root));
  const code = await runCli(argv, {
    env,
    repoRoot: root,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    fetch: async () => {
      fetched += 1;
      throw new Error('unreachable');
    },
    now: () => NOW,
    run: async () => ({ status: 0, stdout: '', stderr: '' }),
    repair: repair && ((request) => (asked.push(request), repair(request))),
  });
  return { code, out, err, asked, fetched, untouched: JSON.stringify(snapshot(root)) === before };
}
const lastJson = (lines) => JSON.parse(lines.at(-1));

test('without the vendor key the repair fails naming the secret, writes nothing and calls no vendor', async () => {
  const run = await invoke({ env: configured() });

  assert.equal(run.code, 1);
  assert.match(run.err[0], /^repair:entry failed \(credential\): /);
  assert.ok(run.err.join('\n').includes('AUTOWRITER_OPENAI_API_KEY is not set'));
  assert.ok(run.err.join('\n').includes('site/.env.example'));
  assert.equal(run.untouched, true);
  assert.equal(run.fetched, 0);
  assert.equal(run.asked.length, 0);
  assert.deepEqual(lastJson(run.out), {
    ok: false,
    outcome: 'credential',
    commit: null,
    reason: 'AUTOWRITER_OPENAI_API_KEY is not set',
    kind: 'credential',
    variables: ['AUTOWRITER_OPENAI_API_KEY'],
    spend: null,
  });
});

test('a blank key counts as missing, and a missing provider is a failed configuration, not a credential', async () => {
  const blank = await invoke({ env: configured('   ') });
  assert.equal(lastJson(blank.out).outcome, 'credential');
  const bare = await invoke({ env: {} });
  assert.equal(bare.code, 1);
  assert.equal(lastJson(bare.out).outcome, 'failed');
  assert.ok(bare.err.join('\n').includes('WRITING_PROVIDER'));
});

test('the pull request and head are read from the arguments, and a repaired entry exits zero with its commit', async () => {
  const run = await invoke({
    env: configured(secret()),
    repair: async () => ({
      outcome: 'repaired',
      commit: COMMIT,
      slug: 'what-is-aims',
      attempt: 1,
      gates: [],
      spend: null,
    }),
  });

  assert.equal(run.code, 0);
  assert.equal(run.asked[0].number, 7);
  assert.equal(run.asked[0].head, HEAD);
  assert.deepEqual(lastJson(run.out), {
    ok: true,
    outcome: 'repaired',
    commit: COMMIT,
    reason: 'repaired what-is-aims in attempt 1',
    slug: 'what-is-aims',
    attempt: 1,
    gates: [],
    spend: null,
  });
});

test('a stop carries its outcome out as the last line and exits one, with no commit', async () => {
  const run = await invoke({
    env: configured(secret()),
    repair: async () => {
      throw new RepairStop('no-convergence', 'the same rule failed on the same path after attempt 1');
    },
  });

  assert.equal(run.code, 1);
  assert.deepEqual(lastJson(run.out), {
    ok: false,
    outcome: 'no-convergence',
    commit: null,
    reason: 'the same rule failed on the same path after attempt 1',
    kind: 'no-convergence',
    variables: [],
    spend: null,
  });
});

test('an unexpected error is a failed outcome with its spend, and the key never reaches either stream', async () => {
  const key = secret();
  const run = await invoke({
    env: configured(key),
    repair: async () => {
      throw Object.assign(new Error('boom with ' + key), { spend: { tokens: { input: 1, output: 2 }, costUsd: 0.5 } });
    },
  });

  assert.equal(run.code, 1);
  assert.equal(lastJson(run.out).outcome, 'failed');
  assert.deepEqual(lastJson(run.out).spend, { tokens: { input: 1, output: 2 }, costUsd: 0.5 });
  assert.equal(run.out.join('\n').includes(key), false);
  assert.equal(run.err.join('\n').includes(key), false);
});

test('a stop that recorded its spend on a local commit carries that commit on the failure line', async () => {
  const spend = { tokens: { input: 1000, output: 500 }, costUsd: 0.0035 };
  const run = await invoke({
    env: configured(secret()),
    repair: async () => {
      throw Object.assign(new RepairStop('unrepairable', 'the rewrite broke the build: boom'), {
        spend,
        commit: COMMIT,
      });
    },
  });

  assert.equal(run.code, 1);
  assert.deepEqual(lastJson(run.out), {
    ok: false,
    outcome: 'unrepairable',
    commit: COMMIT,
    reason: 'the rewrite broke the build: boom',
    kind: 'unrepairable',
    variables: [],
    spend,
  });
});

test('an unexpected error that recorded its spend carries its commit on the failure line too', async () => {
  const run = await invoke({
    env: configured(secret()),
    repair: async () => {
      throw Object.assign(new Error('boom'), {
        spend: { tokens: { input: 1, output: 2 }, costUsd: 0.5 },
        commit: COMMIT,
      });
    },
  });

  assert.equal(lastJson(run.out).outcome, 'failed');
  assert.equal(lastJson(run.out).commit, COMMIT);
});

test('a usage error exits two and names the usage, never reaching the repair', async () => {
  for (const argv of [
    [],
    ['--pr', '7'],
    ['--head', HEAD],
    ['--pr', 'seven', '--head', HEAD],
    ['--pr', '7', '--head', 'abc'],
  ]) {
    const run = await invoke({ argv, env: configured(secret()), repair: async () => ({}) });
    assert.equal(run.code, 2, JSON.stringify(argv));
    assert.ok(run.err.join('\n').includes('usage: npm run repair:entry'));
    assert.equal(run.asked.length, 0);
  }
});

test('run from the repository root with no key, the real script fails naming the secret and writes nothing', () => {
  const repositoryRoot = join(import.meta.dirname, '..', '..');
  const script = join(import.meta.dirname, 'repair-entry.mjs');
  const guard = pathToFileURL(join(import.meta.dirname, 'fixtures', 'no-network.mjs')).href;
  const env = { PATH: process.env.PATH, ...configured() };
  const result = spawnSync(process.execPath, ['--import', guard, script, '--pr', '7', '--head', HEAD], {
    cwd: repositoryRoot,
    env,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stderr);
  assert.ok(result.stderr.includes('AUTOWRITER_OPENAI_API_KEY is not set'), result.stderr);
  assert.equal(JSON.parse(result.stdout.trim().split('\n').at(-1)).outcome, 'credential');
});
