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
  refusalPart,
  refused,
  reply,
  response,
  truncated,
} from './fixtures/writer-vendors.mjs';

const CANARY = 'BODY-CANARY-7f3a';
const CALL_FIELDS = ['text', 'responseId', 'resolvedModel', 'usage', 'stopReason', 'costUsd', 'price', 'requestDigest'];
const NOT_AN_OBJECT = 'openai answered with text that is not a JSON object';

const answering = (answer) => ({ [ROUTES.responses]: answer });

async function failureWith(answer) {
  const { adapter, calls, vendor } = adapterOn({ routes: answering(answer) });
  return { error: await failureOf(adapter.complete(REQUEST)), calls, vendor };
}

for (const status of [401, 403]) {
  test(`HTTP ${status} is a credential failure naming the key variable and the status`, async () => {
    const { error } = await failureWith(() => reply(errorBody({ message: CANARY }), status));

    assert.equal(error.kind, 'credential');
    assert.deepEqual(error.variables, ['AUTOWRITER_OPENAI_API_KEY']);
    assert.equal(error.status, status);
    assert.ok(error.message.includes('AUTOWRITER_OPENAI_API_KEY') && error.message.includes(String(status)));
    assert.ok(!error.message.includes(CANARY), 'the vendor error body was copied');
  });
}

test('a refused key on the model list is a credential failure before any response request', async () => {
  const routes = { [ROUTES.models]: () => reply(errorBody({ message: CANARY }), 401) };
  const { adapter, calls } = adapterOn({ routes });

  const error = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'credential');
  assert.deepEqual(error.variables, ['AUTOWRITER_OPENAI_API_KEY']);
  assert.equal(calls.length, 1);
});

for (const status of [400, 404]) {
  test(`HTTP ${status} saying the model is unknown is a model failure naming variable and value`, async () => {
    const { error, vendor } = await failureWith(() =>
      reply(errorBody({ code: 'model_not_found', message: CANARY }), status)
    );

    assert.equal(error.kind, 'model');
    assert.deepEqual(error.variables, ['OPENAI_WRITING_MODEL']);
    assert.equal(error.status, status);
    assert.ok(error.message.includes('OPENAI_WRITING_MODEL') && error.message.includes(vendor.model));
    assert.ok(!error.message.includes(CANARY), 'the vendor error body was copied');
  });
}

for (const status of [400, 404, 422, 429, 500, 503]) {
  test(`HTTP ${status} without an unknown-model body is a vendor failure naming vendor and status only`, async () => {
    const { error } = await failureWith(() => reply(errorBody({ message: CANARY }), status));

    assert.equal(error.kind, 'vendor');
    assert.equal(error.status, status);
    assert.equal(error.message, `openai answered HTTP ${status}`);
    assert.deepEqual(error.variables, []);
    assert.equal(error.call, null);
  });
}

test('an unknown-model body behind a status other than 400 or 404 is a vendor failure', async () => {
  const { error } = await failureWith(() => reply(errorBody({ code: 'model_not_found' }), 500));

  assert.equal(error.kind, 'vendor');
});

test('an unknown-model body on the model list is a vendor failure, because the list names no model', async () => {
  const routes = { [ROUTES.models]: () => reply(errorBody({ code: 'model_not_found' }), 404) };
  const { adapter } = adapterOn({ routes });

  const error = await failureOf(adapter.verifyModel());

  assert.equal(error.kind, 'vendor');
  assert.equal(error.message, 'openai answered HTTP 404');
});

test('an error page that is not JSON is a vendor failure and its text is not copied', async () => {
  const { error } = await failureWith(() => reply(`<html>${CANARY}</html>`, 502));

  assert.equal(error.kind, 'vendor');
  assert.equal(error.message, 'openai answered HTTP 502');
});

for (const body of [`<html>${CANARY}</html>`, '[1,2]', 'null', '"text"']) {
  test(`an HTTP 200 answer of ${body.slice(0, 12)} is a vendor failure and its text is not copied`, async () => {
    const { error } = await failureWith(() => reply(body));

    assert.equal(error.kind, 'vendor');
    assert.equal(error.message, 'openai answered HTTP 200 without a JSON object');
  });
}

test('a network failure is a vendor failure naming only the error type', async () => {
  const { error } = await failureWith(() => {
    throw new TypeError(`connect ECONNREFUSED ${CANARY}`);
  });

  assert.equal(error.kind, 'vendor');
  assert.equal(error.status, null);
  assert.equal(error.message, 'openai request failed: TypeError');
});

test('an error whose name is not a plain identifier is reported as Error', async () => {
  const { error } = await failureWith(() => {
    throw Object.assign(new Error('x'), { name: `${CANARY} with spaces` });
  });

  assert.equal(error.message, 'openai request failed: Error');
});

test('a truncated answer is an output failure that carries the billed call', async () => {
  const answer = truncated({ id: 'resp_cut', text: '{"title":"cut', input: 1000, output: 32000 });
  const { error } = await failureWith(() => reply(answer));

  assert.equal(error.kind, 'output');
  assert.deepEqual(Object.keys(error.call), CALL_FIELDS);
  assert.equal(error.call.responseId, 'resp_cut');
  assert.equal(error.call.text, '{"title":"cut');
  assert.equal(error.call.stopReason, 'max_output_tokens');
  assert.deepEqual(error.call.usage, { input: 1000, output: 32000 });
  assert.equal(error.call.costUsd, 0.161);
});

test('a refusal is an output failure that carries the billed call', async () => {
  const { error } = await failureWith(() => reply(refused({ input: 900, output: 40 })));

  assert.equal(error.kind, 'output');
  assert.equal(error.call.stopReason, 'refusal');
  assert.equal(error.call.costUsd, 0.0011);
});

for (const [name, text] of [
  ['text that is not JSON', 'Sure, here is the entry you asked for.'],
  ['an array', '[1, 2]'],
  ['a string', '"entry"'],
  ['null', 'null'],
  ['no text at all', ''],
]) {
  test(`${name} as the output is an output failure that carries the billed call`, async () => {
    const { error } = await failureWith(() => reply(completed({ text, input: 700, output: 30 })));

    assert.equal(error.kind, 'output');
    assert.equal(error.message, NOT_AN_OBJECT);
    assert.equal(error.call.text, text);
    assert.equal(error.call.costUsd, 0.00085);
  });
}

const BROKEN_USAGE = [
  ['no usage object', (body) => delete body.usage],
  ['a null usage object', (body) => (body.usage = null)],
  ['no input count', (body) => (body.usage = { output_tokens: 800 })],
  ['a string for the input count', (body) => (body.usage = { input_tokens: '1200', output_tokens: 800 })],
  ['a negative output count', (body) => (body.usage = { input_tokens: 1200, output_tokens: -1 })],
  ['a fractional output count', (body) => (body.usage = { input_tokens: 1200, output_tokens: 8.5 })],
];

for (const [name, corrupt] of BROKEN_USAGE) {
  test(`an answer with ${name} is a price failure with no call, because its spend cannot be counted`, async () => {
    const body = completed();
    corrupt(body);

    const { error } = await failureWith(() => reply(body));

    assert.equal(error.kind, 'price');
    assert.equal(error.call, null);
  });
}

for (const [name, change, message] of [
  ['a failed response', { status: 'failed' }, 'openai did not finish its answer'],
  ['an incomplete response', { status: 'incomplete' }, 'openai did not finish its answer'],
  ['a refusal', { output: [messageItem(refusalPart())] }, 'openai refused to answer'],
]) {
  test(`${name} that reports no usage is an output failure with no call, because nothing was counted`, async () => {
    const { error } = await failureWith(() => reply(response({ ...change, usage: null })));

    assert.equal(error.kind, 'output');
    assert.equal(error.message, message);
    assert.equal(error.call, null);
  });
}

for (const field of ['id', 'model']) {
  test(`an answer without ${field} is a vendor failure`, async () => {
    const body = completed();
    delete body[field];

    const { error } = await failureWith(() => reply(body));

    assert.equal(error.kind, 'vendor');
    assert.equal(error.call, null);
  });
}
