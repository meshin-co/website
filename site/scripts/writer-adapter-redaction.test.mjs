import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  REQUEST,
  ROUTES,
  adapterOn,
  completed,
  errorBody,
  failureOf,
  messageItem,
  modelList,
  outputText,
  randomSecret,
  refused,
  reply,
  response,
  truncated,
  usageOf,
} from './fixtures/writer-vendors.mjs';
import { findSecret, secretsOf } from './writer-redact.mjs';

const MARKER = '[redacted:AUTOWRITER_OPENAI_API_KEY]';

const settle = (promise) =>
  promise.then(
    (result) => ({ result }),
    (error) => ({ error })
  );

const exposed = ({ result, error }) =>
  result ?? {
    name: error.name,
    kind: error.kind,
    message: error.message,
    variables: error.variables,
    status: error.status,
    call: error.call,
    stack: error.stack,
  };

function assertClean(outcome, vendor) {
  const surface = exposed(outcome);
  assert.equal(findSecret(surface, secretsOf([vendor])), null);
  assert.ok(!JSON.stringify(surface).includes(vendor.apiKey), 'the serialised outcome carries the key');
}

const answering = (answer) => ({ [ROUTES.responses]: answer });
const rejecting = (status, options) =>
  answering((call) => reply(errorBody({ message: `rejected ${call.key}`, ...options }), status));
const idOf = (call) => `resp_${call.key}`;

const SCENARIOS = [
  {
    name: 'a completed call',
    kind: null,
    marker: true,
    routes: answering((call) =>
      reply(completed({ id: idOf(call), model: call.key, text: JSON.stringify({ title: call.key }) }))
    ),
  },
  {
    name: 'a truncated call',
    kind: 'output',
    marker: true,
    routes: answering((call) => reply(truncated({ id: idOf(call), text: `{"title":"${call.key}` }))),
  },
  {
    name: 'a refusal',
    kind: 'output',
    marker: true,
    routes: answering((call) => reply(refused({ id: idOf(call), text: `no ${call.key}` }))),
  },
  {
    name: 'text that is not JSON',
    kind: 'output',
    marker: true,
    routes: answering((call) => reply(completed({ id: idOf(call), text: `Sure: ${call.key}` }))),
  },
  {
    name: 'a billed cache write',
    kind: 'price',
    marker: true,
    routes: answering((call) =>
      reply(
        response({
          id: idOf(call),
          output: [messageItem(outputText(JSON.stringify({ title: call.key })))],
          usage: usageOf(12000, 800, { cache_write_tokens: 7000 }),
        })
      )
    ),
  },
  {
    name: 'an incomplete answer whose stop reason echoes the key',
    kind: 'output',
    marker: true,
    routes: answering((call) => reply(response({ status: 'incomplete', incompleteReason: call.key }))),
  },
  { name: 'HTTP 401', kind: 'credential', marker: false, routes: rejecting(401) },
  { name: 'HTTP 403', kind: 'credential', marker: false, routes: rejecting(403) },
  {
    name: 'an unknown model at call time',
    kind: 'model',
    marker: false,
    routes: rejecting(404, { code: 'model_not_found' }),
  },
  { name: 'HTTP 429', kind: 'vendor', marker: false, routes: rejecting(429) },
  { name: 'HTTP 500', kind: 'vendor', marker: false, routes: rejecting(500) },
  {
    name: 'an HTTP 500 page that is not JSON',
    kind: 'vendor',
    marker: false,
    routes: answering((call) => reply(`<html>${call.key}</html>`, 500)),
  },
  {
    name: 'a network failure',
    kind: 'vendor',
    marker: false,
    echoes: false,
    routes: answering((call) => {
      throw new TypeError(`refused ${call.key}`);
    }),
  },
  {
    name: 'a model list that does not hold the model',
    kind: 'model',
    marker: false,
    routes: { [ROUTES.models]: (call) => reply(modelList({ ids: [`other-${call.key}`] })) },
  },
];

for (const scenario of SCENARIOS) {
  test(`${scenario.name} never exposes the key`, async () => {
    const { adapter, calls, vendor } = adapterOn({ routes: scenario.routes });

    const outcome = await settle(adapter.complete(REQUEST));

    assert.equal(outcome.error?.kind ?? null, scenario.kind);
    if (scenario.echoes !== false) {
      assert.ok(
        calls.some(({ answer }) => answer?.includes(vendor.apiKey)),
        'the fake vendor never echoed the key'
      );
    }
    assertClean(outcome, vendor);
    if (scenario.marker) {
      assert.ok(JSON.stringify(exposed(outcome)).includes(MARKER), 'the echoed key was not redacted');
    }
  });
}

const escaped = (text) => [...text].map((char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');

test('a key echoed through JSON escapes is redacted from the parsed output as well', async () => {
  const echo = (call) => completed({ text: `{"title":"${escaped(call.key)}","body":"fine"}` });
  const { adapter, calls, vendor } = adapterOn({ routes: answering((call) => reply(echo(call))) });

  const outcome = await settle(adapter.complete(REQUEST));

  assert.ok(!calls.at(-1).answer.includes(vendor.apiKey), 'the escaped echo was written out in plain text');
  assert.deepEqual(outcome.result.json, { title: MARKER, body: 'fine' });
  assertClean(outcome, vendor);
});

test('a key echoed as a JSON property name is redacted from the parsed output as well', async () => {
  const echo = (call) => completed({ text: `{"${escaped(call.key)}":"fine"}` });
  const { adapter, vendor } = adapterOn({ routes: answering((call) => reply(echo(call))) });

  const outcome = await settle(adapter.complete(REQUEST));

  assert.deepEqual(outcome.result.json, { [MARKER]: 'fine' });
  assertClean(outcome, vendor);
});

test('a configured model value that embeds the key is redacted from the thrown message', async () => {
  const apiKey = randomSecret();
  const { adapter, vendor } = adapterOn({ apiKey, model: `model-${apiKey}` });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'model');
  assert.ok(error.message.includes(MARKER), 'the model value was not redacted');
  assertClean({ error }, vendor);
});

test('an unexpected exception whose message carries the key is reported by its type only', async () => {
  const { adapter, vendor, apiKey } = adapterOn();
  const request = {
    ...REQUEST,
    get system() {
      throw new RangeError(`broken ${apiKey}`);
    },
  };

  const outcome = await settle(adapter.complete(request));

  assert.equal(outcome.error.kind, 'vendor');
  assert.equal(outcome.error.message, 'openai call failed: RangeError');
  assertClean(outcome, vendor);
});
