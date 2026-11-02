import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { explain, failureOf, keysInEnvironment, runProcess } from './writer-cli.mjs';
import { WriterError } from './writer-error.mjs';

const KEY = 'sk-test-0123456789abcdef';

test('the secrets of the environment are every vendor key it holds, named and valued', () => {
  assert.deepEqual(keysInEnvironment({ AUTOWRITER_OPENAI_API_KEY: KEY, OTHER: 'x' }), [
    { name: 'AUTOWRITER_OPENAI_API_KEY', value: KEY },
  ]);
  assert.deepEqual(keysInEnvironment({}), [{ name: 'AUTOWRITER_OPENAI_API_KEY', value: undefined }]);
});

test('a writer error becomes a failure with its kind, its variables, its spend and a redacted message', () => {
  const error = new WriterError('credential', `the key ${KEY} was refused`, {
    variables: ['AUTOWRITER_OPENAI_API_KEY'],
  });
  error.spend = { tokens: { input: 1, output: 2 }, costUsd: 0.5 };
  assert.deepEqual(failureOf(error, [{ name: 'AUTOWRITER_OPENAI_API_KEY', value: KEY }]), {
    ok: false,
    kind: 'credential',
    variables: ['AUTOWRITER_OPENAI_API_KEY'],
    message: 'the key [redacted:AUTOWRITER_OPENAI_API_KEY] was refused',
    spend: { tokens: { input: 1, output: 2 }, costUsd: 0.5 },
  });
});

test('an error that is not a writer error is an unexpected failure with no variables and no spend', () => {
  assert.deepEqual(failureOf(new Error('boom'), []), {
    ok: false,
    kind: 'unexpected',
    variables: [],
    message: 'boom',
    spend: null,
  });
});

test('a configuration or credential failure names the secret every vendor needs and the file that describes it', () => {
  for (const kind of ['config', 'credential']) {
    const lines = explain('repair:entry', failureOf(new WriterError(kind, 'AUTOWRITER_OPENAI_API_KEY is not set'), []));
    assert.equal(lines[0], 'repair:entry failed (' + kind + '): AUTOWRITER_OPENAI_API_KEY is not set');
    assert.match(lines[1], /AUTOWRITER_OPENAI_API_KEY for openai/);
    assert.match(lines[1], /site\/\.env\.example/);
  }
});

test('another kind of failure is one line, and an unexpected one adds the stack', () => {
  const vendor = failureOf(new WriterError('vendor', 'openai answered HTTP 500'), []);
  assert.deepEqual(explain('repair:entry', vendor), ['repair:entry failed (vendor): openai answered HTTP 500']);
  const error = new Error('boom');
  const lines = explain('repair:entry', failureOf(error, []), error);
  assert.equal(lines[0], 'repair:entry failed (unexpected): boom');
  assert.equal(lines[1], error.stack);
});

test('a process is run in the directory it is given and its status and output come back', () => {
  const result = runProcess(process.execPath, ['-e', 'console.log(process.cwd()); process.exit(3)'], {
    cwd: import.meta.dirname,
  });
  assert.equal(result.status, 3);
  assert.equal(result.stdout.trim(), import.meta.dirname);
  assert.equal(result.stderr, '');
});
