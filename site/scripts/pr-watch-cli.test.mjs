import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SECRET, parseArguments, runCli } from './pr-watch.mjs';
import { green, harness } from './fixtures/pr-watch-harness.mjs';

test('the arguments are a pull request number and an optional observation', () => {
  assert.deepEqual(parseArguments(['--pr', '72', '--observed', 'cancelled:abc:1:1']), {
    number: 72,
    observed: 'cancelled:abc:1:1',
  });
  assert.deepEqual(parseArguments(['--pr', '72']), { number: 72, observed: '' });
  assert.deepEqual(parseArguments(['--pr', '72', '--observed', '']), { number: 72, observed: '' });
});

test('a missing, zero, fractional or non-numeric pull request number is a usage error', () => {
  for (const argv of [[], ['--pr'], ['--pr', '0'], ['--pr', '1.5'], ['--pr', 'abc'], ['--pr', '72; rm -rf /']]) {
    assert.throws(() => parseArguments(argv), /usage/i, argv.join(' '));
  }
});

test('a pull request number too long to be exact is a usage error', () => {
  assert.throws(() => parseArguments(['--pr', '12345678901234567890']), /usage/i);
});

test('an observation with characters outside the token alphabet is a usage error', () => {
  assert.throws(() => parseArguments(['--pr', '72', '--observed', 'x y']), /usage/i);
  assert.throws(() => parseArguments(['--pr', '72', '--observed', '$(id)']), /usage/i);
});

test('an unknown flag is a usage error', () => {
  assert.throws(() => parseArguments(['--pr', '72', '--force']), /usage/i);
  assert.throws(() => parseArguments(['--pr', '72', '--force', 'yes']), /usage/i);
});

test('the command line exits 2 on a usage error and 1 on a failure, and says which secret is missing', async () => {
  const messages = [];
  const io = { stdout: (line) => messages.push(line), stderr: (line) => messages.push(line) };
  const { env } = await harness({ bundle: green() });
  delete env[SECRET];

  assert.equal(await runCli([], { ...io, env }), 2);
  assert.equal(await runCli(['--pr', '72'], { ...io, env }), 1);
  assert.ok(messages.some((line) => line.includes(SECRET)));
});
