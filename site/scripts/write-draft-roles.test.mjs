import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REPAIR_ROLES } from './generation-record.mjs';
import { draftEntry } from './write-draft.mjs';

const PRICE = { inputPerMillion: 4, outputPerMillion: 20 };
const REQUEST = {
  system: 'rules',
  user: 'repair it',
  schema: { type: 'object' },
  schemaName: 'entry',
  maxOutputTokens: 100,
};

const answer = (n) => ({
  json: { n },
  text: JSON.stringify({ n }),
  responseId: `resp_${n}`,
  resolvedModel: 'gpt-6.1-terra',
  usage: { input: 1000 * n, output: 100 * n },
  stopReason: 'completed',
  costUsd: 0.006 * n,
  price: PRICE,
  requestDigest: `digest${n}`,
});

const adapterAnswering = () => {
  let given = 0;
  return {
    id: 'openai',
    modelVariable: 'OPENAI_WRITING_MODEL',
    model: 'gpt-6.1-terra',
    complete: async () => answer((given += 1)),
  };
};

const refusingOnce = ({ n }) =>
  n === 1 ? { draft: null, problems: [{ rule: 'x', detail: 'y' }] } : { draft: { n }, problems: [] };
const correct = () => 'fix it';
const rolesOf = (calls) => calls.map(({ role }) => role);

test('the repair roles are repair then repair-correction', () => {
  assert.deepEqual(REPAIR_ROLES, ['repair', 'repair-correction']);
});

test('with the repair roles a first answer that passes is one call named repair', async () => {
  const calls = [];
  await draftEntry({
    adapter: adapterAnswering(),
    request: REQUEST,
    check: (json) => ({ draft: json, problems: [] }),
    correct,
    calls,
    roles: REPAIR_ROLES,
  });
  assert.deepEqual(rolesOf(calls), ['repair']);
});

test('with the repair roles the correction round is named repair-correction', async () => {
  const calls = [];
  const outcome = await draftEntry({
    adapter: adapterAnswering(),
    request: REQUEST,
    check: refusingOnce,
    correct,
    calls,
    roles: REPAIR_ROLES,
  });
  assert.deepEqual(outcome.draft, { n: 2 });
  assert.deepEqual(rolesOf(calls), ['repair', 'repair-correction']);
});

test('without roles the writer still names its calls draft and correction', async () => {
  const calls = [];
  await draftEntry({ adapter: adapterAnswering(), request: REQUEST, check: refusingOnce, correct, calls });
  assert.deepEqual(rolesOf(calls), ['draft', 'correction']);
});
