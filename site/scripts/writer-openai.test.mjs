import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DRAFT,
  MODEL,
  REQUEST,
  ROUTES,
  adapterOn,
  errorBody,
  failureOf,
  messageItem,
  modelList,
  outputText,
  refusalPart,
  reply,
  response,
  usageOf,
} from './fixtures/writer-vendors.mjs';
import { isUnknownModel, listModels, readMessage } from './writer-openai.mjs';

const posts = (calls) => calls.filter(({ method }) => method === 'POST');
const answering = (body) => ({ [ROUTES.responses]: () => reply(body) });

test('the response request carries the bearer key and content type in headers and the contract fields in the body', async () => {
  const { adapter, calls, apiKey } = adapterOn();

  await adapter.complete(REQUEST);

  const [call] = posts(calls);
  assert.equal(call.url, 'https://api.openai.com/v1/responses');
  assert.ok(call.headers.authorization === `Bearer ${apiKey}`, 'the authorization header does not carry the key');
  assert.equal(call.headers['content-type'], 'application/json');
  assert.deepEqual(call.json, {
    model: MODEL,
    instructions: REQUEST.system,
    input: REQUEST.messages,
    text: { format: { type: 'json_schema', name: REQUEST.schemaName, schema: REQUEST.schema, strict: true } },
    max_output_tokens: REQUEST.maxOutputTokens,
    store: false,
    prompt_cache_options: { mode: 'explicit' },
  });
});

test('no request carries temperature or top_p, and the key is only ever in a header', async () => {
  const { adapter, calls, apiKey } = adapterOn();

  await adapter.complete(REQUEST);

  assert.equal(calls.length, 2);
  for (const { url, body, headers } of calls) {
    assert.ok(headers.authorization === `Bearer ${apiKey}`, 'the authorization header does not carry the key');
    assert.ok(!url.includes(apiKey) && !(body ?? '').includes(apiKey), 'the key travels outside a header');
    assert.doesNotMatch(body ?? '', /temperature|top_p/);
  }
});

test('the model list is one request with the bearer key in a header and no body', async () => {
  const { adapter, calls, apiKey } = adapterOn();

  await adapter.verifyModel();

  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.method, 'GET');
  assert.equal(call.url, 'https://api.openai.com/v1/models');
  assert.ok(call.headers.authorization === `Bearer ${apiKey}`, 'the authorization header does not carry the key');
  assert.equal(call.body, undefined);
});

test('listModels reads the one list through the given sender and normalises it', async () => {
  const sent = [];
  const send = async (request) => {
    sent.push(request);
    return modelList({ ids: ['a', 'b'], shutdownDates: { b: '2027-01-15' } });
  };

  const models = await listModels(send);

  assert.deepEqual(sent, [{ method: 'GET', url: 'https://api.openai.com/v1/models' }]);
  assert.deepEqual(models, [
    { id: 'a', shutdownDate: null },
    { id: 'b', shutdownDate: '2027-01-15' },
  ]);
});

test('the output_text parts of every message item are joined in order and reasoning items are left out', async () => {
  const output = [
    { id: 'rs_1', type: 'reasoning', summary: [] },
    messageItem(outputText('{"title":"A",'), outputText('"body":"B"')),
    messageItem(outputText('}')),
  ];
  const { adapter } = adapterOn({ routes: answering(response({ output })) });

  const result = await adapter.complete(REQUEST);

  assert.equal(result.text, '{"title":"A","body":"B"}');
  assert.deepEqual(result.json, { title: 'A', body: 'B' });
});

test('a fixture answer costs exactly its input and output tokens, reasoning tokens being inside the output count', async () => {
  const { adapter } = adapterOn();

  const result = await adapter.complete(REQUEST);

  assert.deepEqual(result.usage, { input: 1200, output: 800 });
  assert.equal(result.costUsd, 0.0052);
  assert.equal(result.stopReason, 'completed');
  assert.deepEqual(result.json, DRAFT);
});

test('cached input tokens are part of input_tokens, so they are counted and never discounted', async () => {
  const usage = usageOf(10000, 800, { cached_tokens: 4000 });
  const { adapter } = adapterOn({ routes: answering(response({ usage })) });

  const result = await adapter.complete(REQUEST);

  assert.deepEqual(result.usage, { input: 10000, output: 800 });
  assert.equal(result.costUsd, 0.014);
});

for (const [name, details] of [
  ['a zero cache_write_tokens', { cache_write_tokens: 0 }],
  ['no cache_write_tokens', { cache_write_tokens: undefined }],
  ['no input_tokens_details at all', null],
]) {
  test(`${name} needs no guard and the call succeeds`, async () => {
    const usage = { ...usageOf(1200, 800), input_tokens_details: details === null ? undefined : { ...details } };
    const { adapter } = adapterOn({ routes: answering(response({ usage })) });

    const result = await adapter.complete(REQUEST);

    assert.equal(result.costUsd, 0.0052);
  });
}

test('a billed cache write is a price failure that carries the billed call, even when the output is valid', async () => {
  const usage = usageOf(12000, 800, { cached_tokens: 4000, cache_write_tokens: 7000 });
  const { adapter } = adapterOn({ routes: answering(response({ id: 'resp_written', usage })) });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'price');
  assert.equal(error.message, 'openai billed a cache write, which the configured rates do not cover');
  assert.equal(error.call.responseId, 'resp_written');
  assert.deepEqual(error.call.usage, { input: 12000, output: 800 });
  assert.equal(error.call.costUsd, 0.016);
  assert.equal(error.call.text, JSON.stringify(DRAFT));
});

test('a billed cache write outranks a refusal, because the recorded cost is then wrong', async () => {
  const usage = usageOf(12000, 800, { cache_write_tokens: 7000 });
  const output = [messageItem(refusalPart())];
  const { adapter } = adapterOn({ routes: answering(response({ output, usage })) });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'price');
});

const INCOMPLETE = [
  ['an incomplete answer cut at max_output_tokens', { status: 'incomplete', incompleteReason: 'max_output_tokens' }],
  ['an incomplete answer stopped by the content filter', { status: 'incomplete', incompleteReason: 'content_filter' }],
  ['an incomplete answer with no stated reason', { status: 'incomplete' }],
  ['a failed response', { status: 'failed' }],
  ['a cancelled response', { status: 'cancelled' }],
  ['a response still in progress', { status: 'in_progress' }],
];

for (const [name, change] of INCOMPLETE) {
  test(`${name} is an output failure that still carries the billed call`, async () => {
    const { adapter } = adapterOn({ routes: answering(response(change)) });

    const error = await failureOf(adapter.complete(REQUEST));

    assert.equal(error.kind, 'output');
    assert.equal(error.call.stopReason, change.incompleteReason ?? change.status);
    assert.equal(error.call.costUsd, 0.0052);
  });
}

test('an answer cut at max_output_tokens says so and names the shared reasoning budget', async () => {
  const body = response({ status: 'incomplete', incompleteReason: 'max_output_tokens' });
  const { adapter } = adapterOn({ routes: answering(body) });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.match(error.message, /max_output_tokens/);
  assert.match(error.message, /reasoning/);
});

test('a response with no status is an output failure whose recorded reason is unknown', async () => {
  const body = response();
  delete body.status;
  const { adapter } = adapterOn({ routes: answering(body) });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'output');
  assert.equal(error.call.stopReason, 'unknown');
});

test('a refusal item is an output failure even when the status is completed', async () => {
  const output = [messageItem(refusalPart())];
  const { adapter } = adapterOn({ routes: answering(response({ output })) });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'output');
  assert.equal(error.message, 'openai refused to answer');
  assert.equal(error.call.stopReason, 'refusal');
  assert.equal(error.call.text, '');
});

test('a refusal next to valid text still fails, because the output cannot be trusted', async () => {
  const output = [messageItem(outputText('{"title":"A","body":"B"}'), refusalPart())];
  const { adapter } = adapterOn({ routes: answering(response({ output })) });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'output');
  assert.equal(error.call.stopReason, 'refusal');
});

test('a refusal given as an output item of its own is an output failure too', async () => {
  const output = [refusalPart()];
  const { adapter } = adapterOn({ routes: answering(response({ output })) });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'output');
  assert.equal(error.call.stopReason, 'refusal');
});

test('readMessage returns exactly the fields the adapter reads', () => {
  const read = readMessage(response());

  assert.deepEqual(Object.keys(read), ['responseId', 'resolvedModel', 'text', 'usage', 'stopReason', 'failure']);
  assert.deepEqual(read.usage, { input: 1200, output: 800 });
  assert.equal(read.failure, null);
});

test('only the model_not_found code says the model is unknown', () => {
  assert.equal(isUnknownModel(errorBody({ code: 'model_not_found' })), true);
  assert.equal(isUnknownModel(errorBody({ code: 'invalid_api_key' })), false);
  assert.equal(isUnknownModel(errorBody({})), false);
  assert.equal(isUnknownModel(undefined), false);
  assert.equal(isUnknownModel(null), false);
  assert.equal(isUnknownModel('<html>'), false);
});
