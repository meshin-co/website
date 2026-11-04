import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateClaim } from './autowriter-claims.mjs';
import { validateLedger } from './autowriter-ledger.mjs';
import { callOf } from './fixtures/generation-input.mjs';
import { callTotals } from './generation-record.mjs';
import { buildRun } from './topic-entries.mjs';

const NOW = new Date('2026-11-02T07:00:00.000Z');
const RUN_ID = '2026-11-02-1';
const REPORT_PATH = 'audits/search-demand.md';
const REPORT = {
  measured: '2026-11-01',
  windowStart: '2026-08-01',
  windowEnd: '2026-10-30',
  property: 'sc-domain:meshin.co',
  generatedFrom: 'b5d0639',
};

const QUERY_ROW = {
  Query: 'how to budget for an ai pilot',
  Impressions: '1',
  Clicks: '0',
  Position: '52.5',
  CTR: '0.0%',
  Page: '/blog',
  Prompts: '-',
};
const WEAKNESS = ['no-buyer-prompt', 'impressions-at-floor', 'position-beyond-strengthen-band'];
const PROPOSAL = {
  calls: [
    callOf('topic', { input: 1800, output: 60 }, 'first'),
    callOf('topic', { input: 1700, output: 40 }, 'second'),
  ],
};
const PROPOSAL_SPEND = { tokens: { input: 3500, output: 100 }, costUsd: 0.004 };
const REFUSED = {
  title: 'How to write an AI incident runbook',
  reason: 'same-subject',
  against: '/blog/incident-runbook',
  detail: 'the topic "How to write an AI incident runbook" repeats /blog/incident-runbook',
};

const topicOf = (title, slug, query) => ({ format: 'article', subject: null, title, slug, query });

const demand = {
  format: 'article',
  topic: topicOf('Fractional CAIO vs full-time CAIO cost', 'fractional-caio-vs-full-time-caio-cost', 'fractional caio'),
  prompt: { number: 2, text: 'fractional CAIO vs full-time CAIO cost' },
  demand: { impressions: 0, position: null },
  table: 'Buyer prompts',
  row: { '#': '2' },
  choice: 'Choice: signal 2, prompt 2',
  origin: 'demand',
};

const weak = {
  format: 'article',
  topic: topicOf('How to budget for an AI pilot', 'how-to-budget-for-an-ai-pilot', 'how to budget for an ai pilot'),
  demand: { impressions: 1, position: 52.5 },
  table: 'Queries',
  row: QUERY_ROW,
  choice: 'Choice: signal 3, "how to budget for an ai pilot", 1 impression at position 52.5',
  origin: 'weak-demand',
  weakness: WEAKNESS,
};

const category = {
  format: 'article',
  topic: topicOf(
    'How to write an AI incident runbook',
    'how-to-write-an-ai-incident-runbook',
    'how to write an ai incident runbook'
  ),
  demand: { impressions: 0, position: null },
  table: null,
  row: null,
  choice: 'Choice: category governance, no article yet',
  origin: 'category',
  category: 'governance',
  proposal: PROPOSAL,
};

const decisionOf = (entries, extra = {}) => ({
  decision: 'write',
  choice: entries[0].choice,
  reason: null,
  entries,
  strengthen: null,
  advisories: [],
  concepts: { named: [] },
  fallback: null,
  refusals: [],
  proposals: [],
  trail: [],
  ...extra,
});

const run = (decision) => buildRun({ decision, report: REPORT, runId: RUN_ID, now: NOW, reportPath: REPORT_PATH });
const claimOf = (entry) => run(decisionOf([entry])).claims[0].claim;

test('a weak-demand claim carries its origin and its weakness, and has no prompt key at all', () => {
  const claim = claimOf(weak);
  assert.equal(claim.origin, 'weak-demand');
  assert.deepEqual(claim.weakness, WEAKNESS);
  assert.deepEqual(claim.demand, { impressions: 1, position: 52.5 });
  assert.equal(Object.hasOwn(claim, 'prompt'), false);
  assert.equal(Object.hasOwn(claim, 'category'), false);
  assert.deepEqual(validateClaim(claim), []);
});

test('a category claim carries its origin and its category, with no prompt, no weakness and no demand', () => {
  const claim = claimOf(category);
  assert.equal(claim.origin, 'category');
  assert.equal(claim.category, 'governance');
  assert.deepEqual(claim.demand, { impressions: 0, position: null });
  for (const key of ['prompt', 'weakness']) assert.equal(Object.hasOwn(claim, key), false, key);
  assert.deepEqual(validateClaim(claim), []);
});

test('a demand claim keeps its prompt and names no category and no weakness', () => {
  const claim = claimOf(demand);
  assert.deepEqual(claim.prompt, { number: 2, text: 'fractional CAIO vs full-time CAIO cost' });
  for (const key of ['category', 'weakness']) assert.equal(Object.hasOwn(claim, key), false, key);
  assert.equal(claim.origin, 'demand');
  assert.deepEqual(validateClaim(claim), []);
});

test('no claim of any origin holds a null or an undefined field', () => {
  for (const entry of [demand, weak, category]) {
    const values = Object.values(claimOf(entry));
    assert.equal(values.includes(null), false, entry.origin);
    assert.equal(values.includes(undefined), false, entry.origin);
  }
});

test('a weak-demand entry of the decision file names the report row and the Queries table, and no proposal', () => {
  const [entry] = run(decisionOf([weak])).file.entries;
  assert.deepEqual(Object.keys(entry).sort(), ['choice', 'claim', 'claimPath', 'row', 'table']);
  assert.deepEqual([entry.row, entry.table], [QUERY_ROW, 'Queries']);
});

test('a category entry of the decision file has no row and no table, and holds every proposal call', () => {
  const [entry] = run(decisionOf([category])).file.entries;
  assert.deepEqual(Object.keys(entry).sort(), ['choice', 'claim', 'claimPath', 'proposal', 'row', 'table']);
  assert.deepEqual([entry.row, entry.table], [null, null]);
  assert.deepEqual(entry.proposal, PROPOSAL);
  assert.equal(entry.proposal.calls.length, 2);
});

test('the ledger of a category run holds the proposal spend as its generation, so the claim commit records it', () => {
  const { ledger } = run(decisionOf([category]));
  assert.deepEqual(callTotals(PROPOSAL.calls), PROPOSAL_SPEND);
  assert.deepEqual(ledger.generation, PROPOSAL_SPEND);
  assert.deepEqual(ledger.spend, PROPOSAL_SPEND);
  assert.deepEqual(ledger.attempts, []);
  assert.equal(ledger.verdict.state, 'open');
  assert.deepEqual(validateLedger(ledger), []);
});

test('the ledger of a demand run and of a weak-demand run holds no generation, because nothing was spent yet', () => {
  for (const entry of [demand, weak]) {
    const { ledger } = run(decisionOf([entry]));
    assert.equal(Object.hasOwn(ledger, 'generation'), false, entry.origin);
    assert.deepEqual(ledger.spend, { tokens: { input: 0, output: 0 }, costUsd: 0 }, entry.origin);
  }
});

test('the refusals of the proposals ride in the ledger of the category run, which still validates', () => {
  const { ledger, file } = run(decisionOf([category], { refusals: [REFUSED] }));
  assert.deepEqual(ledger.refusals, [REFUSED]);
  assert.deepEqual(file.refusals, [REFUSED]);
  assert.deepEqual(validateLedger(ledger), []);
});

test('the ledger and the claim of a category run are filed under the slug and the month of the article', () => {
  const { ledgerPath, claims, file } = run(decisionOf([category]));
  assert.equal(ledgerPath, 'audits/autowriter/2026/11/how-to-write-an-ai-incident-runbook.json');
  assert.equal(claims[0].claimPath, 'audits/autowriter/claims/2026/11/how-to-write-an-ai-incident-runbook.json');
  assert.equal(file.ledgerPath, ledgerPath);
  assert.equal(file.entries[0].claimPath, claims[0].claimPath);
});

test('the proposal in the decision file is a copy: changing it leaves the decision as it was', () => {
  const decision = decisionOf([category]);
  const before = structuredClone(decision);
  const { file } = run(decision);
  file.entries[0].proposal.calls[0].role = 'changed';
  file.entries[0].proposal.calls.pop();
  assert.deepEqual(decision, before);
});

test('a category run is plain JSON that survives being written and read back', () => {
  const { file, ledger } = run(decisionOf([category], { refusals: [REFUSED] }));
  assert.deepEqual(JSON.parse(JSON.stringify(file)), file);
  assert.deepEqual(JSON.parse(JSON.stringify(ledger)), ledger);
});

test('a weak-demand article leads a run that also claims a term that has its own prompt', () => {
  const term = {
    ...demand,
    format: 'term',
    topic: {
      format: 'term',
      subject: 'AI literacy',
      title: 'What is AI literacy?',
      slug: 'ai-literacy',
      query: 'ai literacy',
    },
    demand: { impressions: 5, position: 42.5 },
    table: 'Queries',
    row: { Query: 'what is ai literacy' },
  };
  const { claims, file } = run(decisionOf([weak, term]));
  assert.deepEqual(
    claims.map(({ claim }) => [claim.format, claim.origin, Object.hasOwn(claim, 'prompt')]),
    [
      ['article', 'weak-demand', false],
      ['term', 'demand', true],
    ]
  );
  assert.deepEqual(
    file.entries.map((entry) => Object.hasOwn(entry, 'proposal')),
    [false, false]
  );
});
