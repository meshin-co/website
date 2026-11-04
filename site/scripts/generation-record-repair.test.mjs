import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ARTICLE_SLUG, callOf, categoryInput, modelCheck, recordInput } from './fixtures/generation-input.mjs';
import {
  ENTRY_COST_ROLES,
  REPAIR_ROLES,
  TOPIC_ROLES,
  WRITING_ROLES,
  buildRecord,
  callTotals,
  recordAfterRepair,
  validateRecord,
  writingTotals,
} from './generation-record.mjs';

const schema = JSON.parse(readFileSync(new URL('./generation-record.schema.json', import.meta.url), 'utf8'));
const written = () => buildRecord(recordInput());
const repairCalls = (tag = 'repair-1') => [
  callOf('repair', { input: 9000, output: 2500 }, tag),
  callOf('repair-correction', { input: 9500, output: 1800 }, `${tag}-correction`),
];
const refreshed = () => ({
  claimTable: [
    {
      sentence: 'An AI bill of materials names every component of an AI system.',
      marker: 'sourced',
      source: { id: 'S1', title: 'NIST AI RMF', url: 'https://www.nist.gov/itl/ai-risk-management-framework' },
      span: 'names every component',
    },
  ],
  measured: { ...recordInput().band.measured, sentences: 22, median: 15 },
  gates: [
    { name: 'gate:content', exit: 0 },
    { name: 'gate:human', exit: 0 },
    { name: 'gate:editorial', exit: 0 },
    { name: 'gate:registers', exit: 0 },
    { name: 'gate:machine', exit: 0 },
  ],
});
const repaired = (record = written(), calls = repairCalls()) =>
  recordAfterRepair({
    record,
    calls,
    modelChecks: [modelCheck({ note: 'second run' })],
    measuredOn: '2026-11-03',
    ...refreshed(),
  });

test('the roles a record may hold are the proposal role, the two writing roles and the two repair roles', () => {
  assert.deepEqual(TOPIC_ROLES, ['topic']);
  assert.deepEqual(WRITING_ROLES, ['draft', 'correction']);
  assert.deepEqual(REPAIR_ROLES, ['repair', 'repair-correction']);
  assert.deepEqual(ENTRY_COST_ROLES, ['topic', 'draft', 'correction']);
  assert.deepEqual(schema.$defs.call.properties.role.enum, [...TOPIC_ROLES, ...WRITING_ROLES, ...REPAIR_ROLES]);
});

test('the cost of an entry is its proposal, its draft and its correction, and a repair call is never part of it', () => {
  const proposal = callOf('topic', { input: 1000, output: 100 }, 'proposal');
  assert.deepEqual(writingTotals({ calls: [proposal] }), { tokens: { input: 1000, output: 100 }, costUsd: 0.0015 });
  const category = buildRecord(categoryInput());
  assert.deepEqual(writingTotals(category), category.totals);
  assert.deepEqual(writingTotals(repaired(category)), category.totals);
});

test('a repaired category record stays valid, with its proposal call, its claim and its demand as they were', () => {
  const before = buildRecord(categoryInput());
  const next = repaired(before);
  assert.deepEqual(validateRecord(next), []);
  assert.deepEqual(
    next.calls.map(({ role }) => role),
    ['topic', 'draft', 'correction', 'repair', 'repair-correction']
  );
  assert.deepEqual(next.published, { callIndex: 4 });
  assert.deepEqual(next.claim, before.claim);
  assert.deepEqual(next.demand, before.demand);
  assert.deepEqual(next.totals, callTotals(next.calls));
});

test('a repaired record is a valid record whose keys keep the schema order', () => {
  const next = repaired();
  assert.deepEqual(validateRecord(next), []);
  assert.deepEqual(Object.keys(next), Object.keys(schema.properties));
});

test('the repair calls follow the writing calls and the last one is the published text', () => {
  const before = written();
  const next = repaired(before);
  assert.deepEqual(
    next.calls.map(({ role }) => role),
    ['draft', 'correction', 'repair', 'repair-correction']
  );
  assert.deepEqual(next.published, { callIndex: 3 });
  assert.deepEqual(
    [next.provider, next.model, next.responseId],
    [before.provider, before.model, 'resp-repair-1-correction']
  );
});

test('the totals count every call, and the writing totals count only the first two kinds', () => {
  const before = written();
  const next = repaired(before);
  assert.deepEqual(next.totals, callTotals(next.calls));
  assert.ok(next.totals.costUsd > before.totals.costUsd);
  assert.deepEqual(writingTotals(next), before.totals);
  assert.deepEqual(writingTotals(before), before.totals);
});

test('the claim table, the measured band and the gates describe the text as repaired', () => {
  const next = repaired();
  assert.deepEqual(next.claimTable, refreshed().claimTable);
  assert.deepEqual(next.band.measured, refreshed().measured);
  assert.equal(next.band.measuredOn, '2026-11-03');
  assert.deepEqual(next.gates, refreshed().gates);
});

test('what the repair does not touch stays exactly as the writer recorded it', () => {
  const before = written();
  const next = repaired(before);
  for (const key of [
    'schema',
    'slug',
    'runId',
    'generatedAt',
    'claim',
    'demand',
    'entry',
    'ledger',
    'prompt',
    'tree',
    'files',
  ])
    assert.deepEqual(next[key], before[key], key);
  assert.deepEqual(next.band.limits, before.band.limits);
});

test('the model check of the repair run is added to the one the writer made', () => {
  assert.deepEqual(
    repaired().modelChecks.map(({ note }) => note),
    [null, 'second run']
  );
});

test('a second repair stacks on the first', () => {
  const twice = repaired(repaired(), repairCalls('repair-2'));
  assert.equal(twice.calls.length, 6);
  assert.deepEqual(twice.published, { callIndex: 5 });
  assert.equal(twice.responseId, 'resp-repair-2-correction');
  assert.deepEqual(validateRecord(twice), []);
  assert.deepEqual(writingTotals(twice), written().totals);
});

test('the record handed in is left as it was', () => {
  const before = written();
  const snapshot = structuredClone(before);
  repaired(before);
  assert.deepEqual(before, snapshot);
});

test('a repair with no calls is refused, because a rewrite always has a response behind it', () => {
  assert.throws(() => repaired(written(), []), /at least one call/);
});

test('a repair call with a writing role is refused, so the writing totals cannot be inflated', () => {
  assert.throws(() => repaired(written(), [callOf('draft')]), /repair roles/);
});

test('a record that was never repaired is valid and its writing totals are its totals', () => {
  const record = written();
  assert.deepEqual(validateRecord(record), []);
  assert.equal(record.slug, ARTICLE_SLUG);
  assert.deepEqual(writingTotals(record), record.totals);
});
