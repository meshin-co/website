import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CREDENTIAL_EXIT_CODE, answerOf, auditExitCode, credentialError, credentialWording } from './audit-command.mjs';

const recorder = () => {
  const lines = [];
  return { lines, error: (line) => lines.push(line) };
};

test('a credential error is an error that says so', () => {
  const error = credentialError('the key is gone');

  assert.ok(error instanceof Error);
  assert.equal(error.message, 'the key is gone');
  assert.equal(error.credential, true);
});

test('the wording names the file and the command, or the secret and the workflow, never both', () => {
  const { file, secret } = credentialWording('audit:example');

  assert.equal(file.home('ANY_NAME'), 'site/.env');
  assert.equal(file.keyGuide, '; site/.env.example says where to get it');
  assert.equal(file.again, 'Then run npm run audit:example again.');
  assert.equal(secret.home('ANY_NAME'), 'the repository secret ANY_NAME');
  assert.equal(secret.keyGuide, '');
  assert.equal(secret.again, 'Then run the Write daily workflow again.');
});

test('an answer is its JSON, and a body that is not JSON is an empty answer', async () => {
  assert.deepEqual(await answerOf(new Response('{"d":[]}')), { d: [] });
  assert.deepEqual(await answerOf(new Response('<html>')), {});
});

test('a key source that is neither file nor secret is a usage error, and main never runs', async () => {
  const { lines, error } = recorder();
  let ran = false;
  const main = async () => {
    ran = true;
  };

  for (const argv of [
    ['node', 'x', '--key-source', 'bogus'],
    ['node', 'x', '--key-source'],
  ]) {
    assert.equal(await auditExitCode({ label: 'audit:example', main, argv, error }), 2);
  }
  assert.equal(ran, false);
  assert.deepEqual(lines, [
    'audit:example: --key-source must be file or secret',
    'audit:example: --key-source must be file or secret',
  ]);
});

test('main runs with the key source it was given, and a run that finishes exits 0 and says nothing', async () => {
  const { lines, error } = recorder();
  const seen = [];
  const main = async (source) => seen.push(source);

  assert.equal(await auditExitCode({ label: 'audit:example', main, argv: ['node', 'x'], error }), 0);
  assert.equal(
    await auditExitCode({ label: 'audit:example', main, argv: ['node', 'x', '--key-source', 'secret'], error }),
    0
  );
  assert.deepEqual(seen, ['file', 'secret']);
  assert.deepEqual(lines, []);
});

test('a credential error exits 3 and any other error exits 1, each reported under the label', async () => {
  const { lines, error } = recorder();
  const failing = (thrown) => async () => {
    throw thrown;
  };
  const argv = ['node', 'x'];

  assert.equal(
    await auditExitCode({ label: 'audit:example', main: failing(credentialError('the key is gone')), argv, error }),
    CREDENTIAL_EXIT_CODE
  );
  assert.equal(await auditExitCode({ label: 'audit:example', main: failing(new Error('HTTP 503')), argv, error }), 1);
  assert.deepEqual(lines, ['audit:example: the key is gone', 'audit:example: HTTP 503']);
});
