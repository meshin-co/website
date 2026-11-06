import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CORRECTION_ROUNDS, countedCorrections, draftEntry, meter } from './write-draft.mjs';
import { WriterError } from './writer-error.mjs';

const PRICE = { inputPerMillion: 4, outputPerMillion: 20 };
const REQUEST = {
  system: 'rules',
  user: 'write it',
  schema: { type: 'object' },
  schemaName: 'entry',
  maxOutputTokens: 100,
};

const answer = (n, json = { n }) => ({
  json,
  text: JSON.stringify(json),
  responseId: `resp_${n}`,
  resolvedModel: 'gpt-6.1-terra',
  usage: { input: 1000 * n, output: 100 * n },
  stopReason: 'completed',
  costUsd: 0.004 * n + 0.002 * n,
  price: PRICE,
  requestDigest: `digest${n}`,
});

function scriptedAdapter(steps) {
  const seen = [];
  return {
    seen,
    id: 'openai',
    modelVariable: 'OPENAI_WRITING_MODEL',
    model: 'gpt-6.1-terra',
    async complete(request) {
      seen.push(structuredClone(request));
      const step = steps[seen.length - 1];
      if (step instanceof Error) throw step;
      return step;
    },
  };
}

const accepting = (json) => ({ draft: json, problems: [] });
const refusing = (json) => ({ draft: null, problems: [{ rule: 'words', detail: `n=${json.n}` }] });
const correct = (problems) => `fix: ${problems.map((problem) => problem.rule).join(',')}`;

test('a draft that passes its checks is one call, recorded with the adapter identity', async () => {
  const adapter = scriptedAdapter([answer(1)]);
  const calls = [];
  const outcome = await draftEntry({ adapter, request: REQUEST, check: accepting, correct, calls });
  assert.deepEqual(outcome.draft, { n: 1 });
  assert.equal(adapter.seen.length, 1);
  assert.deepEqual(calls, [
    {
      role: 'draft',
      vendor: 'openai',
      modelVariable: 'OPENAI_WRITING_MODEL',
      configuredModel: 'gpt-6.1-terra',
      resolvedModel: 'gpt-6.1-terra',
      responseId: 'resp_1',
      requestDigest: 'digest1',
      tokens: { input: 1000, output: 100 },
      costUsd: 0.006,
      price: PRICE,
      stopReason: 'completed',
    },
  ]);
  assert.equal(outcome.finalCall, calls[0]);
});

test('one correction round names the problems and carries the first answer back', async () => {
  const adapter = scriptedAdapter([answer(1), answer(2)]);
  const calls = [];
  const outcome = await draftEntry({
    adapter,
    request: REQUEST,
    check: (json) => (json.n === 1 ? refusing(json) : accepting(json)),
    correct,
    calls,
  });
  assert.deepEqual(outcome.draft, { n: 2 });
  assert.deepEqual(
    calls.map((call) => call.role),
    ['draft', 'correction']
  );
  assert.deepEqual(adapter.seen[1].messages, [
    { role: 'user', content: 'write it' },
    { role: 'assistant', content: '{"n":1}' },
    { role: 'user', content: 'fix: words' },
  ]);
  assert.equal(adapter.seen[1].system, 'rules');
  assert.equal(outcome.finalCall, calls[1]);
});

test('a budget of one stops after the first correction and makes no third call', async () => {
  const adapter = scriptedAdapter([answer(1), answer(2), answer(3)]);
  const calls = [];
  const outcome = await draftEntry({ adapter, request: REQUEST, check: refusing, correct, calls, rounds: 1 });
  assert.equal(outcome.draft, null);
  assert.deepEqual(outcome.problems, [{ rule: 'words', detail: 'n=2' }]);
  assert.equal(adapter.seen.length, 2);
  assert.equal(calls.length, 2);
});

test('a budget of two asks a second time, so a draft the first correction missed still lands', async () => {
  const check = (json) => (json.n === 3 ? { draft: json, problems: [] } : refusing(json));
  const adapter = scriptedAdapter([answer(1), answer(2), answer(3)]);
  const calls = [];
  const outcome = await draftEntry({ adapter, request: REQUEST, check, correct, calls, rounds: 2 });
  assert.deepEqual(outcome.draft, { n: 3 });
  assert.deepEqual(
    calls.map((call) => call.role),
    ['draft', 'correction', 'correction']
  );
  assert.deepEqual(adapter.seen[2].messages.at(-2), { role: 'assistant', content: '{"n":2}' });
});

test('a budget of two stops after the second correction, so the spend of one entry is bounded', async () => {
  const adapter = scriptedAdapter([answer(1), answer(2), answer(3), answer(4)]);
  const calls = [];
  const outcome = await draftEntry({ adapter, request: REQUEST, check: refusing, correct, calls, rounds: 2 });
  assert.equal(outcome.draft, null);
  assert.equal(adapter.seen.length, 3);
});

test('the budget the writer uses by default is the one engine.config.json names', async () => {
  const adapter = scriptedAdapter(Array.from({ length: CORRECTION_ROUNDS + 2 }, (unused, at) => answer(at + 1)));
  const calls = [];
  await draftEntry({ adapter, request: REQUEST, check: refusing, correct, calls });
  assert.equal(adapter.seen.length, CORRECTION_ROUNDS + 1);
});

test('the count the stop message carries reads as English for one correction and for more', () => {
  assert.equal(countedCorrections(1), '1 correction');
  assert.equal(countedCorrections(2), '2 corrections');
});

test('a billed response that could not be used still lands in the calls, then the error goes on', async () => {
  const truncated = new WriterError('output', 'the response was cut off', { call: answer(4) });
  const adapter = scriptedAdapter([truncated]);
  const calls = [];
  await assert.rejects(
    draftEntry({ adapter, request: REQUEST, check: accepting, correct, calls }),
    (error) => error === truncated
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].responseId, 'resp_4');
  assert.equal(calls[0].costUsd, 0.024);
});

test('a failure that cost nothing leaves the calls empty', async () => {
  const refused = new WriterError('vendor', 'openai answered HTTP 500', { status: 500 });
  const calls = [];
  await assert.rejects(
    draftEntry({ adapter: scriptedAdapter([refused]), request: REQUEST, check: accepting, correct, calls })
  );
  assert.deepEqual(calls, []);
});

test('an unparsable answer is an error of the vendor that gave it, and the call is kept', async () => {
  const calls = [];
  const check = () => {
    throw new WriterError('output', 'description is missing');
  };
  await assert.rejects(
    draftEntry({ adapter: scriptedAdapter([answer(1)]), request: REQUEST, check, correct, calls }),
    /description is missing/
  );
  assert.equal(calls.length, 1);
});

test('meter keeps the role it was asked for, returns the adapter result untouched and drops fields the record does not hold', async () => {
  const calls = [];
  const result = answer(5);
  const ask = meter(scriptedAdapter([result]), calls);
  assert.equal(await ask('draft', REQUEST), result);
  assert.equal(calls[0].role, 'draft');
  assert.equal(calls[0].responseId, 'resp_5');
});
