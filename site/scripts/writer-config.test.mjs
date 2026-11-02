import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { inspect } from 'node:util';

import { PROVIDER_VARIABLE, VENDORS, readWriterConfig } from './writer-config.mjs';
import { WriterError } from './writer-error.mjs';

const secret = () => randomBytes(24).toString('hex');

const full = (extra = {}) => ({
  WRITING_PROVIDER: 'openai',
  OPENAI_WRITING_MODEL: 'gpt-6.1-terra',
  OPENAI_WRITING_INPUT_USD_PER_MILLION: '1',
  OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '5',
  AUTOWRITER_OPENAI_API_KEY: secret(),
  ...extra,
});

const failure = (env) => {
  try {
    readWriterConfig(env);
  } catch (error) {
    return error;
  }
  return assert.fail('readWriterConfig did not throw');
};

test('WriterError carries kind, variables, status and call', () => {
  const plain = new WriterError('vendor', 'boom');
  assert.ok(plain instanceof Error);
  assert.equal(plain.name, 'WriterError');
  assert.equal(plain.kind, 'vendor');
  assert.equal(plain.message, 'boom');
  assert.deepEqual(plain.variables, []);
  assert.equal(plain.status, null);
  assert.equal(plain.call, null);
  const rich = new WriterError('claim', 'm', { variables: ['A'], status: 429, call: { costUsd: 1 } });
  assert.equal(rich.kind, 'claim');
  assert.deepEqual(rich.variables, ['A']);
  assert.equal(rich.status, 429);
  assert.deepEqual(rich.call, { costUsd: 1 });
});

test('the registry holds exactly openai and names its variables', () => {
  assert.equal(PROVIDER_VARIABLE, 'WRITING_PROVIDER');
  assert.deepEqual(VENDORS, {
    openai: {
      id: 'openai',
      keyName: 'AUTOWRITER_OPENAI_API_KEY',
      modelVariable: 'OPENAI_WRITING_MODEL',
      rateVariables: {
        input: 'OPENAI_WRITING_INPUT_USD_PER_MILLION',
        output: 'OPENAI_WRITING_OUTPUT_USD_PER_MILLION',
      },
    },
  });
});

test('a full environment returns the provider and the vendor with trimmed values', () => {
  const env = full({
    AUTOWRITER_OPENAI_API_KEY: '  abc  \n',
    OPENAI_WRITING_MODEL: ' gpt-6.1-terra ',
    OPENAI_WRITING_INPUT_USD_PER_MILLION: ' 1.25 ',
    OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '5e0',
  });
  const config = readWriterConfig(env);
  assert.deepEqual(Object.keys(config), ['provider', 'vendor']);
  assert.equal(config.provider, 'openai');
  assert.deepEqual(config.vendor, {
    id: 'openai',
    keyName: 'AUTOWRITER_OPENAI_API_KEY',
    modelVariable: 'OPENAI_WRITING_MODEL',
    model: 'gpt-6.1-terra',
    rates: {
      inputVariable: 'OPENAI_WRITING_INPUT_USD_PER_MILLION',
      outputVariable: 'OPENAI_WRITING_OUTPUT_USD_PER_MILLION',
      inputPerMillion: 1.25,
      outputPerMillion: 5,
    },
  });
  assert.equal(config.vendor.apiKey, 'abc');
});

test('every missing name is reported at once, credential kind when the secret is missing', () => {
  const error = failure({ WRITING_PROVIDER: 'openai' });
  assert.ok(error instanceof WriterError);
  assert.equal(error.kind, 'credential');
  assert.equal(
    error.message,
    [
      'OPENAI_WRITING_MODEL is not set',
      'OPENAI_WRITING_INPUT_USD_PER_MILLION is not set',
      'OPENAI_WRITING_OUTPUT_USD_PER_MILLION is not set',
      'AUTOWRITER_OPENAI_API_KEY is not set',
    ].join('; ')
  );
  assert.deepEqual(error.variables, [
    'OPENAI_WRITING_MODEL',
    'OPENAI_WRITING_INPUT_USD_PER_MILLION',
    'OPENAI_WRITING_OUTPUT_USD_PER_MILLION',
    'AUTOWRITER_OPENAI_API_KEY',
  ]);
});

test('a config problem alone is kind config', () => {
  const error = failure(full({ OPENAI_WRITING_MODEL: undefined }));
  assert.equal(error.kind, 'config');
  assert.equal(error.message, 'OPENAI_WRITING_MODEL is not set');
});

test('a blank key counts as missing', () => {
  const error = failure(full({ AUTOWRITER_OPENAI_API_KEY: ' \t\n' }));
  assert.equal(error.kind, 'credential');
  assert.equal(error.message, 'AUTOWRITER_OPENAI_API_KEY is not set');
});

test('a blank model and blank rates count as missing', () => {
  const error = failure(
    full({
      OPENAI_WRITING_MODEL: '  ',
      OPENAI_WRITING_INPUT_USD_PER_MILLION: ' ',
      OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '',
    })
  );
  assert.equal(
    error.message,
    'OPENAI_WRITING_MODEL is not set; OPENAI_WRITING_INPUT_USD_PER_MILLION is not set; OPENAI_WRITING_OUTPUT_USD_PER_MILLION is not set'
  );
});

test('an unset provider names the variable and the supported names', () => {
  const error = failure({});
  assert.equal(error.kind, 'config');
  assert.equal(error.message, 'WRITING_PROVIDER is not set (supported: openai)');
  assert.deepEqual(error.variables, ['WRITING_PROVIDER']);
});

test('an unknown provider names the variable, the value and the supported names', () => {
  const error = failure(full({ WRITING_PROVIDER: 'anthropic' }));
  assert.equal(error.kind, 'config');
  assert.equal(error.message, 'WRITING_PROVIDER is "anthropic" (supported: openai)');
  assert.deepEqual(error.variables, ['WRITING_PROVIDER']);
});

test('inherited object names are not providers', () => {
  for (const name of ['constructor', '__proto__', 'toString']) {
    assert.equal(
      failure(full({ WRITING_PROVIDER: name })).message,
      `WRITING_PROVIDER is "${name}" (supported: openai)`
    );
  }
});

test('a provider value that equals the key never prints the key', () => {
  const key = secret();
  const error = failure({ ...full({ AUTOWRITER_OPENAI_API_KEY: key }), WRITING_PROVIDER: key });
  assert.equal(error.message.includes(key), false);
});

for (const bad of ['abc', '0', '-1', '-0.5', 'Infinity', 'NaN', '1,5', '1 2']) {
  test(`a rate of ${JSON.stringify(bad)} names the variable and the value`, () => {
    const input = failure(full({ OPENAI_WRITING_INPUT_USD_PER_MILLION: bad }));
    assert.equal(input.kind, 'config');
    assert.equal(
      input.message,
      `OPENAI_WRITING_INPUT_USD_PER_MILLION is ${JSON.stringify(bad)} (expected a positive number)`
    );
    assert.deepEqual(input.variables, ['OPENAI_WRITING_INPUT_USD_PER_MILLION']);
    const output = failure(full({ OPENAI_WRITING_OUTPUT_USD_PER_MILLION: bad }));
    assert.equal(
      output.message,
      `OPENAI_WRITING_OUTPUT_USD_PER_MILLION is ${JSON.stringify(bad)} (expected a positive number)`
    );
  });
}

test('a rate that equals the key never prints the key', () => {
  const key = secret();
  const error = failure(full({ AUTOWRITER_OPENAI_API_KEY: key, OPENAI_WRITING_INPUT_USD_PER_MILLION: key }));
  assert.equal(error.message.includes(key), false);
  assert.ok(error.message.includes('OPENAI_WRITING_INPUT_USD_PER_MILLION'));
});

test('all problems are joined in one error', () => {
  const error = failure({
    WRITING_PROVIDER: 'openai',
    OPENAI_WRITING_INPUT_USD_PER_MILLION: 'abc',
    OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '0',
  });
  assert.equal(error.kind, 'credential');
  assert.equal(
    error.message,
    [
      'OPENAI_WRITING_MODEL is not set',
      'OPENAI_WRITING_INPUT_USD_PER_MILLION is "abc" (expected a positive number)',
      'OPENAI_WRITING_OUTPUT_USD_PER_MILLION is "0" (expected a positive number)',
      'AUTOWRITER_OPENAI_API_KEY is not set',
    ].join('; ')
  );
});

test('apiKey is invisible to JSON, keys, spread and inspect', () => {
  const env = full();
  const config = readWriterConfig(env);
  const key = config.vendor.apiKey;
  assert.equal(key, env.AUTOWRITER_OPENAI_API_KEY);
  assert.equal(Object.keys(config.vendor).includes('apiKey'), false);
  assert.equal('apiKey' in { ...config.vendor }, false);
  assert.equal(JSON.stringify(config).includes(key), false);
  assert.equal(inspect(config, { depth: 9 }).includes(key), false);
});

test('nothing is read from process.env', () => {
  const before = process.env.WRITING_PROVIDER;
  process.env.WRITING_PROVIDER = 'openai';
  try {
    assert.equal(failure({}).kind, 'config');
  } finally {
    if (before === undefined) delete process.env.WRITING_PROVIDER;
    else process.env.WRITING_PROVIDER = before;
  }
});
