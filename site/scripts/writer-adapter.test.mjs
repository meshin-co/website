import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import {
  DRAFT,
  DRAFT_TEXT,
  MODEL,
  RATES,
  REQUEST,
  ROUTES,
  adapterOn,
  completed,
  failureOf,
  modelList,
  reply,
  vendorEntry,
} from './fixtures/writer-vendors.mjs';
import { IMPLEMENTATIONS, createAdapter } from './writer-adapter.mjs';
import { VENDORS } from './writer-config.mjs';

const posts = (calls) => calls.filter(({ method }) => method === 'POST');
const lists = (calls) => calls.filter(({ method }) => method === 'GET');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

test('the adapter registry holds exactly the providers the configuration registry lists', () => {
  assert.deepEqual(Object.keys(IMPLEMENTATIONS).sort(), Object.keys(VENDORS).sort());
});

test('every registered implementation provides the whole vendor interface', () => {
  for (const [id, implementation] of Object.entries(IMPLEMENTATIONS)) {
    for (const name of ['requestHeaders', 'listModels', 'messageRequest', 'readMessage', 'isUnknownModel']) {
      assert.equal(typeof implementation[name], 'function', `${id} lacks ${name}`);
    }
  }
});

test('the adapter names its vendor, variables, model and rates and carries no key', () => {
  const { adapter, vendor, apiKey } = adapterOn();

  assert.deepEqual(Object.keys(adapter).sort(), [
    'complete',
    'id',
    'keyName',
    'model',
    'modelVariable',
    'rates',
    'verifyModel',
  ]);
  assert.equal(adapter.id, 'openai');
  assert.equal(adapter.keyName, 'AUTOWRITER_OPENAI_API_KEY');
  assert.equal(adapter.modelVariable, 'OPENAI_WRITING_MODEL');
  assert.equal(adapter.model, MODEL);
  assert.deepEqual(adapter.rates, vendor.rates);
  assert.notEqual(adapter.rates, vendor.rates);
  assert.ok(!JSON.stringify(adapter).includes(apiKey), 'the adapter serialises with the key');
});

test('a provider the registry does not hold is refused naming it and the supported names', () => {
  const vendor = { ...vendorEntry(), id: 'mistral' };

  assert.throws(
    () => createAdapter({ vendor, fetch: () => {} }),
    (error) => error.kind === 'config' && error.message.includes('mistral') && error.message.includes('openai')
  );
});

test('a vendor entry without a key is refused naming the key variable, before any request', () => {
  const vendor = { ...vendorEntry() };

  assert.throws(
    () => createAdapter({ vendor, fetch: () => assert.fail('a request was made') }),
    (error) =>
      error.kind === 'credential' &&
      error.variables.join() === 'AUTOWRITER_OPENAI_API_KEY' &&
      error.message.includes('AUTOWRITER_OPENAI_API_KEY')
  );
});

test('verifyModel asks the vendor list once however often and however concurrently it is called', async () => {
  const { adapter, calls } = adapterOn();

  const [first, concurrent] = await Promise.all([adapter.verifyModel(), adapter.verifyModel()]);
  const later = await adapter.verifyModel();

  assert.deepEqual(first, { id: MODEL, shutdownDate: null, note: null });
  assert.deepEqual(concurrent, first);
  assert.deepEqual(later, first);
  assert.equal(lists(calls).length, 1);
});

test('complete verifies the model first, once, and then sends one response request per call', async () => {
  const { adapter, calls } = adapterOn();

  await adapter.complete(REQUEST);
  await adapter.complete(REQUEST);

  assert.deepEqual(
    calls.map(({ method }) => method),
    ['GET', 'POST', 'POST']
  );
});

test('a model missing from the list fails naming variable and value before any response request', async () => {
  const routes = { [ROUTES.models]: () => reply(modelList({ ids: ['some-other-model'] })) };
  const { adapter, calls } = adapterOn({ routes });

  const error = await failureOf(adapter.complete(REQUEST));
  const again = await failureOf(adapter.complete(REQUEST));

  assert.equal(error.kind, 'model');
  assert.deepEqual(error.variables, ['OPENAI_WRITING_MODEL']);
  assert.ok(error.message.includes('OPENAI_WRITING_MODEL') && error.message.includes(MODEL));
  assert.equal(again.kind, 'model');
  assert.equal(posts(calls).length, 0);
  assert.equal(lists(calls).length, 1);
});

test('a model with a shutdown date proceeds and the note names variable, model and date', async () => {
  const routes = { [ROUTES.models]: () => reply(modelList({ shutdownDates: { [MODEL]: '2026-12-01' } })) };
  const { adapter } = adapterOn({ routes });

  const verified = await adapter.verifyModel();
  const result = await adapter.complete(REQUEST);

  assert.equal(verified.id, MODEL);
  assert.equal(verified.shutdownDate, '2026-12-01');
  for (const part of ['OPENAI_WRITING_MODEL', MODEL, '2026-12-01']) {
    assert.ok(verified.note.includes(part), `the note leaves out ${part}`);
  }
  assert.deepEqual(result.json, DRAFT);
});

test('a completed call returns the parsed output, the ids, exact token counts and the cost at the configured rates', async () => {
  const answer = completed({ id: 'resp_alpha', model: `${MODEL}-snapshot`, input: 1200, output: 800 });
  const { adapter } = adapterOn({ routes: { [ROUTES.responses]: () => reply(answer) } });

  const result = await adapter.complete(REQUEST);

  assert.deepEqual(Object.keys(result), [
    'json',
    'text',
    'responseId',
    'resolvedModel',
    'usage',
    'stopReason',
    'costUsd',
    'price',
    'requestDigest',
  ]);
  assert.deepEqual(result.json, DRAFT);
  assert.equal(result.text, DRAFT_TEXT);
  assert.equal(result.responseId, 'resp_alpha');
  assert.equal(result.resolvedModel, `${MODEL}-snapshot`);
  assert.deepEqual(result.usage, { input: 1200, output: 800 });
  assert.equal(result.stopReason, 'completed');
  assert.equal(result.costUsd, 0.0052);
  assert.deepEqual(result.price, RATES);
});

test('the rates come from the vendor entry, never from a table in the code', async () => {
  const rates = { inputPerMillion: 3, outputPerMillion: 7 };
  const { adapter } = adapterOn({ rates });

  const result = await adapter.complete(REQUEST);

  assert.equal(result.costUsd, 0.0092);
  assert.deepEqual(result.price, rates);
});

test('the request digest is the sha256 of the body that was sent and follows the request', async () => {
  const { adapter, calls } = adapterOn();

  const first = await adapter.complete(REQUEST);
  const repeat = await adapter.complete(REQUEST);
  const changed = await adapter.complete({ ...REQUEST, system: 'A different system prompt.' });

  const [firstCall, , changedCall] = posts(calls);
  assert.equal(first.requestDigest, sha256(firstCall.body));
  assert.equal(repeat.requestDigest, first.requestDigest);
  assert.equal(changed.requestDigest, sha256(changedCall.body));
  assert.notEqual(changed.requestDigest, first.requestDigest);
});

test('every request refuses redirects so the key header cannot follow one to another host', async () => {
  const { adapter, calls } = adapterOn();

  await adapter.complete(REQUEST);

  assert.deepEqual(
    calls.map(({ redirect }) => redirect),
    ['error', 'error']
  );
});

test('a request whose text carries the key is refused before it is sent, naming the key variable only', async () => {
  const { adapter, calls, apiKey } = adapterOn();

  const error = await failureOf(adapter.complete({ ...REQUEST, system: `Use the key ${apiKey} to sign in.` }));

  assert.equal(error.kind, 'config');
  assert.ok(error.message.includes('AUTOWRITER_OPENAI_API_KEY'));
  assert.ok(!error.message.includes(apiKey));
  assert.equal(posts(calls).length, 0);
});

test('without an injected fetch the adapter uses globalThis.fetch and reports a network failure by type only', async () => {
  const adapter = createAdapter({ vendor: vendorEntry() });

  const error = await failureOf(adapter.verifyModel());

  assert.equal(error.kind, 'vendor');
  assert.equal(error.message, 'openai request failed: Error');
});
