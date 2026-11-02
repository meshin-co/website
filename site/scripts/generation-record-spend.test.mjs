import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { newLedger, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { callOf, recordInput, termInput } from './fixtures/generation-input.mjs';
import { buildRecord, callRecord, callTotals, entryCost, ledgerWithGeneration } from './generation-record.mjs';

const HASH = 'a'.repeat(40);
const T0 = '2026-11-02T07:00:00.000Z';

const attempt = (number, tokens, costUsd) => ({
  number,
  judgedCommit: HASH,
  recordedAt: T0,
  failingRule: 'banned-phrase',
  failingPath: 'site/src/data/post/x.md',
  tokens,
  costUsd,
});

const articleCalls = [callOf('draft', {}, 'a1'), callOf('correction', { input: 13000, output: 2000 }, 'a2')];
const termCalls = [callOf('draft', { input: 6000, output: 1200 }, 't1')];
const failedTermCalls = [callOf('draft', { input: 5000, output: 32000 }, 't2')];

test('callTotals adds the tokens and the cost of every call', () => {
  assert.deepEqual(callTotals([...articleCalls, ...termCalls]), {
    tokens: { input: 31000, output: 6200 },
    costUsd: 0.062,
  });
});

test('callTotals rounds the cost to six decimals so a sum of floats reads as the number it means', () => {
  const part = (costUsd) => ({ tokens: { input: 1, output: 1 }, costUsd });
  assert.equal(callTotals([part(0.1), part(0.2)]).costUsd, 0.3);
  assert.equal(callTotals([part(0.0000004), part(0.0000004)]).costUsd, 0.000001);
  assert.equal(callTotals([part(0.0000004)]).costUsd, 0);
  assert.equal(callTotals(Array.from({ length: 10 }, () => part(0.1))).costUsd, 1);
});

test('callTotals of no calls is nothing spent', () => {
  assert.deepEqual(callTotals([]), { tokens: { input: 0, output: 0 }, costUsd: 0 });
});

test('entryCost is what one record spent, summed from its calls and not read from a totals field that may be stale', () => {
  const article = buildRecord(recordInput());
  const term = buildRecord(termInput());
  assert.deepEqual(entryCost(article), { tokens: { input: 25000, output: 5000 }, costUsd: 0.05 });
  assert.deepEqual(entryCost(term), { tokens: { input: 6000, output: 1200 }, costUsd: 0.012 });
  const stale = { ...article, totals: { tokens: { input: 1, output: 1 }, costUsd: 99 } };
  assert.deepEqual(entryCost(stale), entryCost(article));
  assert.notEqual(entryCost(article), article.totals);
});

const adapter = {
  id: 'openai',
  keyName: 'AUTOWRITER_OPENAI_API_KEY',
  modelVariable: 'OPENAI_WRITING_MODEL',
  model: 'gpt-6.1-terra',
  rates: {
    inputVariable: 'OPENAI_WRITING_INPUT_USD_PER_MILLION',
    outputVariable: 'OPENAI_WRITING_OUTPUT_USD_PER_MILLION',
  },
  verifyModel: () => undefined,
  complete: () => undefined,
};

const billed = {
  responseId: 'resp_123',
  resolvedModel: 'gpt-6.1-terra-2026-10-01',
  usage: { input: 4100, output: 280, reasoning: 90 },
  stopReason: 'completed',
  costUsd: 0.0055,
  price: { inputPerMillion: 1, outputPerMillion: 5, currency: 'USD' },
  requestDigest: 'f'.repeat(64),
};

const expectedCall = (role) => ({
  role,
  vendor: 'openai',
  modelVariable: 'OPENAI_WRITING_MODEL',
  configuredModel: 'gpt-6.1-terra',
  resolvedModel: 'gpt-6.1-terra-2026-10-01',
  responseId: 'resp_123',
  requestDigest: 'f'.repeat(64),
  tokens: { input: 4100, output: 280 },
  costUsd: 0.0055,
  price: { inputPerMillion: 1, outputPerMillion: 5 },
  stopReason: 'completed',
});

test('callRecord turns an adapter and a result into the call object of the record, and only that', () => {
  const result = { ...billed, json: { done: true }, text: '{"done":true}' };
  const call = callRecord({ role: 'correction', adapter, result });
  assert.deepEqual(call, expectedCall('correction'));
  assert.notEqual(call.tokens, result.usage);
  assert.notEqual(call.price, result.price);
});

test('a billed call that failed has the same shape as one that answered', () => {
  const failed = { ...billed, text: 'cut off' };
  assert.deepEqual(callRecord({ role: 'draft', adapter, result: failed }), expectedCall('draft'));
});

const openLedger = () => ({
  ...newLedger({ slug: 'how-to-build-an-ai-bill-of-materials', runId: '1234', pullRequest: 42 }),
  attempts: [attempt(1, { input: 1000, output: 500 }, 0.0125), attempt(2, { input: 2000, output: 700 }, 0.0305)],
  spend: { tokens: { input: 3000, output: 1200 }, costUsd: 0.043 },
});

test('ledgerWithGeneration records the generation and sets spend to the generation plus the attempts', () => {
  const totals = { tokens: { input: 31600, output: 6080 }, costUsd: 0.2264 };
  const result = ledgerWithGeneration(openLedger(), totals);
  assert.deepEqual(result.generation, totals);
  assert.deepEqual(result.spend, { tokens: { input: 34600, output: 7280 }, costUsd: 0.2694 });
});

test('the generation of a run is the sum over both entries and over the calls of an entry that failed', () => {
  const article = buildRecord(recordInput());
  const term = buildRecord(termInput());
  const generation = callTotals([...article.calls, ...term.calls, ...failedTermCalls]);
  assert.deepEqual(generation, { tokens: { input: 36000, output: 38200 }, costUsd: 0.227 });
  const result = ledgerWithGeneration(openLedger(), generation);
  assert.deepEqual(result.generation, generation);
  assert.deepEqual(result.spend, { tokens: { input: 39000, output: 39400 }, costUsd: 0.27 });
  assert.deepEqual(validateLedger(result).map(describeProblem), []);
});

test('ledgerWithGeneration keeps every other field of the ledger and leaves the ledger it was given alone', () => {
  const ledger = openLedger();
  const before = structuredClone(ledger);
  const totals = callTotals(termCalls);
  const result = ledgerWithGeneration(ledger, totals);
  assert.deepEqual(ledger, before);
  for (const key of ['schema', 'slug', 'runId', 'pullRequest', 'attempts', 'verdict', 'escalations']) {
    assert.deepEqual(result[key], ledger[key], key);
  }
  assert.notEqual(result.generation, totals);
  assert.notEqual(result.generation.tokens, totals.tokens);
});

test('a ledger with no attempts spends exactly the generation', () => {
  const ledger = newLedger({ slug: 'how-to-build-an-ai-bill-of-materials', runId: '1234', pullRequest: 42 });
  const totals = { tokens: { input: 5, output: 7 }, costUsd: 0.000123 };
  const result = ledgerWithGeneration(ledger, totals);
  assert.deepEqual(result.spend, totals);
  assert.deepEqual(result.generation, totals);
});

test('a second generation replaces the first instead of adding to it', () => {
  const once = ledgerWithGeneration(openLedger(), { tokens: { input: 100, output: 50 }, costUsd: 1.5 });
  const twice = ledgerWithGeneration(once, { tokens: { input: 31600, output: 6080 }, costUsd: 0.2264 });
  assert.deepEqual(twice.generation, { tokens: { input: 31600, output: 6080 }, costUsd: 0.2264 });
  assert.deepEqual(twice.spend, { tokens: { input: 34600, output: 7280 }, costUsd: 0.2694 });
  assert.deepEqual(ledgerWithGeneration(twice, twice.generation), twice);
});

test('the spend cost is rounded to six decimals like every other cost', () => {
  const ledger = { ...openLedger(), attempts: [attempt(1, { input: 1, output: 1 }, 0.1)] };
  assert.equal(ledgerWithGeneration(ledger, { tokens: { input: 1, output: 1 }, costUsd: 0.2 }).spend.costUsd, 0.3);
});

test('the ledger validator accepts the ledger it is given back and refuses one whose spend forgot the generation', () => {
  const result = ledgerWithGeneration(openLedger(), { tokens: { input: 31600, output: 6080 }, costUsd: 0.2264 });
  assert.deepEqual(validateLedger(result).map(describeProblem), []);
  const forgotten = { ...result, spend: openLedger().spend };
  assert.ok(validateLedger(forgotten).length > 0, 'the validator no longer sums the generation into the spend');
});
