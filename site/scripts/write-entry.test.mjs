import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { runCli } from './write-entry.mjs';
import { WriterError } from './writer-error.mjs';

const KEY = 'AUTOWRITER_OPENAI_API_KEY';
const secret = () => `sk-test-${randomBytes(18).toString('hex')}`;

const snapshot = (directory) =>
  readdirSync(directory, { recursive: true })
    .map((name) => join(directory, name))
    .filter((file) => statSync(file).isFile())
    .map((file) => [file, readFileSync(file, 'utf8')])
    .sort();

function world(files = { 'decision.json': '{"decision":"write"}' }) {
  const root = mkdtempSync(join(tmpdir(), 'write-entry-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return root;
}

async function invoke({ argv = [], env = {}, generate, root = world() }) {
  const out = [];
  const err = [];
  let fetched = 0;
  const before = snapshot(root);
  const code = await runCli(argv, {
    env,
    repoRoot: root,
    cwd: root,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    fetch: async () => {
      fetched += 1;
      throw new Error('unreachable');
    },
    generate,
    now: () => new Date('2026-11-02T06:00:00Z'),
  });
  return { code, out, err, fetched, untouched: JSON.stringify(snapshot(root)) === JSON.stringify(before), root };
}

const lastJson = (lines) => JSON.parse(lines.at(-1));
const configured = (key) => ({
  WRITING_PROVIDER: 'openai',
  OPENAI_WRITING_MODEL: 'gpt-6.1-terra',
  OPENAI_WRITING_INPUT_USD_PER_MILLION: '1',
  OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '5',
  ...(key === undefined ? {} : { [KEY]: key }),
});

test('without the vendor key the run fails naming the secret, writes nothing and calls no vendor', async () => {
  const run = await invoke({ argv: ['--decision', 'decision.json'], env: configured() });
  assert.equal(run.code, 1);
  assert.match(run.err.join('\n'), /AUTOWRITER_OPENAI_API_KEY is not set/);
  assert.match(run.err[0], /^write:entry failed \(credential\): /);
  assert.match(run.err.join('\n'), /site\/\.env\.example/);
  assert.equal(run.untouched, true);
  assert.equal(run.fetched, 0);
  assert.deepEqual(lastJson(run.out), {
    ok: false,
    kind: 'credential',
    variables: ['AUTOWRITER_OPENAI_API_KEY'],
    message: 'AUTOWRITER_OPENAI_API_KEY is not set',
    spend: null,
  });
});

test('with no arguments and no environment it names the provider and the secret, not the usage', async () => {
  const run = await invoke({});
  assert.equal(run.code, 1);
  assert.match(run.err.join('\n'), /WRITING_PROVIDER/);
  assert.match(run.err.join('\n'), /AUTOWRITER_OPENAI_API_KEY for openai/);
  assert.equal(lastJson(run.out).kind, 'config');
});

test('a provider that has no adapter is refused with its own value and the supported names', async () => {
  const run = await invoke({
    argv: ['--decision', 'decision.json'],
    env: { ...configured(secret()), WRITING_PROVIDER: 'anthropic' },
  });
  assert.equal(run.code, 1);
  assert.match(lastJson(run.out).message, /WRITING_PROVIDER is "anthropic" \(supported: openai\)/);
  assert.equal(run.untouched, true);
});

test('a rate that is not a number names its variable and keeps the key out of the report', async () => {
  const key = secret();
  const env = { ...configured(key), OPENAI_WRITING_INPUT_USD_PER_MILLION: 'cheap' };
  const run = await invoke({ argv: ['--decision', 'decision.json'], env });
  assert.equal(run.code, 1);
  assert.deepEqual(lastJson(run.out).variables, ['OPENAI_WRITING_INPUT_USD_PER_MILLION']);
  assert.equal(run.err.join('\n').includes(key), false);
});

test('a blank key counts as missing', async () => {
  const run = await invoke({ argv: ['--decision', 'decision.json'], env: configured('   ') });
  assert.equal(run.code, 1);
  assert.deepEqual(lastJson(run.out).variables, ['AUTOWRITER_OPENAI_API_KEY']);
});

test('a complete configuration but no --decision is a usage error, not a failure of the run', async () => {
  const run = await invoke({ argv: [], env: configured(secret()) });
  assert.equal(run.code, 2);
  assert.match(run.err.join('\n'), /usage: npm run write:entry -- --decision <path>/);
  assert.equal(run.out.length, 0);
});

test('an unreadable decision file fails naming the path, before any vendor is reached', async () => {
  const run = await invoke({ argv: ['--decision', 'absent.json'], env: configured(secret()) });
  assert.equal(run.code, 1);
  assert.match(run.err.join('\n'), /absent\.json/);
  assert.equal(run.fetched, 0);
  assert.equal(run.untouched, true);
});

test('a decision that is not a write is refused with its own value named', async () => {
  const root = world({ 'decision.json': '{"decision":"none"}' });
  const run = await invoke({ argv: ['--decision', 'decision.json'], env: configured(secret()), root });
  assert.equal(run.code, 1);
  assert.match(run.err.join('\n'), /"none"/);
});

test('the pipeline gets the parsed decision, the config and the repository root', async () => {
  const decision = { decision: 'write', ledgerPath: 'audits/autowriter/x.json', entries: [], report: 'r' };
  const root = world({ 'decision.json': JSON.stringify(decision) });
  const key = secret();
  let received;
  const summary = { ok: true, slug: 'x' };
  const run = await invoke({
    argv: ['--decision', 'decision.json'],
    env: configured(key),
    root,
    generate: async (request) => {
      received = request;
      return summary;
    },
  });
  assert.equal(run.code, 0);
  assert.ok(received, 'the pipeline was not called');
  assert.deepEqual(received.decision, decision);
  assert.equal(received.repoRoot, root);
  assert.equal(received.config.provider, 'openai');
  assert.equal(received.config.vendor.model, 'gpt-6.1-terra');
  assert.equal(received.config.vendor.apiKey, key);
  assert.deepEqual(lastJson(run.out), summary);
});

test('a failure whose message carries the key is redacted in every line, and the spend is reported', async () => {
  const key = secret();
  const run = await invoke({
    argv: ['--decision', 'decision.json'],
    env: configured(key),
    generate: async () => {
      throw Object.assign(new WriterError('vendor', `openai echoed ${key} back`), {
        spend: { tokens: { input: 5, output: 1 }, costUsd: 0.01 },
      });
    },
  });
  assert.equal(run.code, 1);
  for (const line of [...run.out, ...run.err]) assert.equal(line.includes(key), false);
  assert.match(run.err.join('\n'), /\[redacted:AUTOWRITER_OPENAI_API_KEY\]/);
  assert.deepEqual(lastJson(run.out).spend, { tokens: { input: 5, output: 1 }, costUsd: 0.01 });
  assert.equal(lastJson(run.out).kind, 'vendor');
});

test('an error that is not a WriterError is reported as unexpected, still redacted', async () => {
  const key = secret();
  const run = await invoke({
    argv: ['--decision', 'decision.json'],
    env: configured(key),
    generate: async () => {
      throw new Error(`boom ${key}`);
    },
  });
  assert.equal(run.code, 1);
  assert.equal(lastJson(run.out).kind, 'unexpected');
  for (const line of [...run.out, ...run.err]) assert.equal(line.includes(key), false);
});

test('the run marks the environment it was given as unattended, even when the configuration then fails', async () => {
  const env = configured();
  const run = await invoke({ argv: ['--decision', 'decision.json'], env });
  assert.equal(run.code, 1);
  assert.equal(env.AUTOWRITER_UNATTENDED, '1');
});

test('a child process the run spawns inherits the marker', async () => {
  const saved = { ...process.env };
  Object.assign(process.env, configured(secret()));
  delete process.env.AUTOWRITER_UNATTENDED;
  const root = world();
  const out = [];
  try {
    const code = await runCli(['--decision', 'decision.json'], {
      env: process.env,
      repoRoot: root,
      cwd: root,
      stdout: (line) => out.push(line),
      stderr: () => {},
      generate: async ({ run }) => ({
        ok: true,
        seen: run(process.execPath, ['-p', 'process.env.AUTOWRITER_UNATTENDED'], { cwd: root }).stdout.trim(),
      }),
    });
    assert.equal(code, 0);
    assert.equal(lastJson(out).seen, '1');
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});

test.after(() => {
  for (const name of readdirSync(tmpdir()).filter((entry) => entry.startsWith('write-entry-')))
    rmSync(join(tmpdir(), name), { recursive: true, force: true });
});
