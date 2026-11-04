import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from './entry-limits.mjs';
import {
  AGENTIC,
  GOVERNANCE,
  QUERY_ACCEPTED,
  QUERY_DEFINITION,
  QUERY_OTHER,
  QUERY_REGISTER,
  answerWith,
  modelRequests,
  proposalScene,
} from './fixtures/proposal-scene.mjs';
import { published, query, reportOf } from './fixtures/topic-inputs.mjs';
import { callTotals } from './generation-record.mjs';
import { proposeTopic } from './topic-proposal.mjs';

const run = ({ decision, inputs, adapter }) => proposeTopic({ decision, inputs, adapter });
const STRENGTHEN_REPORT = reportOf([], [query('fractional caio', 12, 14.5, ['/services/fractional-caio'])]);
const INCIDENT_POST = published('incident-runbook', 'An AI incident runbook for a small team', {
  query: 'ai incident runbook',
});
const REGISTER_REFUSAL = {
  title: 'How to put evals into ci',
  reason: 'register-owner',
  against: '/glossary/evals',
  detail:
    'the query "how to put evals into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals',
};
const categoriesOf = (steps) => steps.map(({ category, outcome }) => [category, outcome]);

test('the first category of the order is asked once, and the query it gives becomes the entry of a write decision', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)] });
  const { decision, calls } = await run(scene);
  assert.equal(modelRequests(scene.sent).length, 1);
  assert.equal(decision.decision, 'write');
  const [entry] = decision.entries;
  assert.equal(decision.entries.length, 1);
  assert.deepEqual([entry.format, entry.origin, entry.category], ['article', 'category', GOVERNANCE]);
  assert.equal(entry.topic.title, 'How to write an AI incident runbook');
  assert.equal(decision.choice, entry.choice);
  assert.deepEqual(entry.proposal, { calls });
  assert.deepEqual(
    calls.map(({ role }) => role),
    ['topic']
  );
});

test('the write decision has the key set of every decision, and its trail names the query that was taken', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)] });
  const { decision } = await run(scene);
  assert.deepEqual(Object.keys(decision).sort(), Object.keys(scene.decision).sort());
  assert.deepEqual([decision.reason, decision.strengthen, decision.fallback], [null, null, null]);
  assert.deepEqual(decision.concepts, scene.decision.concepts);
  assert.deepEqual(decision.proposals, scene.decision.proposals);
  assert.deepEqual(decision.refusals, []);
  assert.deepEqual(decision.trail, [
    {
      arm: 'category',
      category: GOVERNANCE,
      query: QUERY_ACCEPTED,
      outcome: 'chosen',
      detail: 'How to write an AI incident runbook',
    },
  ]);
});

test('a strengthen decision becomes a write decision that keeps its advisory, first', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)], report: STRENGTHEN_REPORT });
  assert.equal(scene.decision.decision, 'strengthen');
  const { decision } = await run(scene);
  assert.equal(decision.decision, 'write');
  assert.equal(decision.strengthen, null);
  assert.deepEqual(decision.advisories, [scene.decision.strengthen, ...scene.decision.advisories]);
  assert.equal(decision.advisories[0].route, '/services/fractional-caio');
});

test('a refused query is asked again in the same category, and the refusal rides on the decision', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_REGISTER), answerWith(QUERY_OTHER)] });
  const { decision, calls } = await run(scene);
  assert.equal(modelRequests(scene.sent).length, 2);
  assert.equal(decision.entries[0].category, GOVERNANCE);
  assert.equal(decision.entries[0].topic.title, 'How to staff an AI review board');
  assert.deepEqual(categoriesOf(decision.trail), [
    [GOVERNANCE, 'register-owner'],
    [GOVERNANCE, 'chosen'],
  ]);
  assert.deepEqual(decision.refusals, [REGISTER_REFUSAL]);
  assert.equal(decision.entries[0].proposal.calls.length, 2);
  assert.deepEqual(decision.entries[0].proposal, { calls });
});

test('after two refusals the next category of the order is tried', async () => {
  const answers = [answerWith(QUERY_REGISTER), answerWith(QUERY_REGISTER), answerWith(QUERY_OTHER)];
  const scene = proposalScene({ answers });
  const { decision } = await run(scene);
  assert.equal(modelRequests(scene.sent).length, 3);
  assert.equal(decision.entries[0].category, AGENTIC);
  assert.deepEqual(categoriesOf(decision.trail), [
    [GOVERNANCE, 'register-owner'],
    [GOVERNANCE, 'register-owner'],
    [AGENTIC, 'chosen'],
  ]);
  assert.equal(decision.entries[0].proposal.calls.length, 3);
});

test('the categories are tried in the order the decision gives, not the order the rotation was configured in', async () => {
  const posts = [published('older', 'An older governance article', { category: GOVERNANCE })];
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)], posts });
  assert.deepEqual(scene.decision.fallback.categories, [AGENTIC, GOVERNANCE]);
  const { decision } = await run(scene);
  assert.equal(decision.entries[0].category, AGENTIC);
});

test('every proposal refused gives a none decision that names the categories tried and what happened in each', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_REGISTER)] });
  const { decision, calls } = await run(scene);
  assert.equal(modelRequests(scene.sent).length, 4);
  assert.equal(calls.length, 4);
  assert.deepEqual(Object.keys(decision).sort(), Object.keys(scene.decision).sort());
  assert.deepEqual([decision.decision, decision.choice, decision.entries], ['none', null, []]);
  assert.deepEqual(decision.fallback, scene.decision.fallback);
  assert.ok(decision.reason.startsWith(scene.decision.reason), decision.reason);
  assert.ok(decision.reason.includes(`${GOVERNANCE} (register-owner, register-owner)`), decision.reason);
  assert.ok(decision.reason.includes(`${AGENTIC} (register-owner, register-owner)`), decision.reason);
  assert.deepEqual(decision.refusals, [REGISTER_REFUSAL, REGISTER_REFUSAL, REGISTER_REFUSAL, REGISTER_REFUSAL]);
  assert.deepEqual(
    decision.trail.map(({ category, query: asked, outcome, detail }) => [category, asked, outcome, detail]),
    [GOVERNANCE, GOVERNANCE, AGENTIC, AGENTIC].map((category) => [
      category,
      QUERY_REGISTER,
      'register-owner',
      REGISTER_REFUSAL.detail,
    ])
  );
});

test('a strengthen decision whose every proposal is refused keeps its choice and its advisory, and names the categories', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_REGISTER)], report: STRENGTHEN_REPORT });
  const { decision } = await run(scene);
  assert.equal(decision.decision, 'strengthen');
  assert.equal(decision.choice, scene.decision.choice);
  assert.deepEqual(decision.strengthen, scene.decision.strengthen);
  assert.deepEqual(decision.advisories, scene.decision.advisories);
  assert.ok(decision.reason.includes(GOVERNANCE) && decision.reason.includes(AGENTIC), decision.reason);
});

test('no category is asked more than twice, so the calls of a run are at most twice the categories', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_REGISTER)], rotation: [...CATEGORIES] });
  const { decision, calls } = await run(scene);
  assert.equal(decision.decision, 'none');
  assert.equal(modelRequests(scene.sent).length, 2 * CATEGORIES.length);
  assert.equal(calls.length, 2 * CATEGORIES.length);
});

test('a definition is refused as a format mismatch, with nothing for the ledger', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_DEFINITION), answerWith(QUERY_ACCEPTED)] });
  const { decision } = await run(scene);
  assert.equal(decision.decision, 'write');
  assert.deepEqual(decision.refusals, []);
  const [refused] = decision.trail;
  assert.deepEqual([refused.outcome, refused.query], ['format-mismatch', QUERY_DEFINITION]);
  assert.match(refused.detail, /asks for the definition of "model card"/);
});

test('a query that repeats a published article is refused as the same subject, naming its route', async () => {
  const scene = proposalScene({
    answers: [answerWith(QUERY_ACCEPTED), answerWith(QUERY_OTHER)],
    posts: [INCIDENT_POST],
  });
  const { decision } = await run(scene);
  assert.equal(decision.entries[0].topic.title, 'How to staff an AI review board');
  const [refusal] = decision.refusals;
  assert.deepEqual([refusal.reason, refusal.against], ['same-subject', '/blog/incident-runbook']);
  assert.equal(decision.trail[0].outcome, 'same-subject');
});

test('the proposal holds the call of every attempt, the refused ones too, and prices them together', async () => {
  const answers = [
    answerWith(QUERY_REGISTER, { input: 2000, output: 30 }),
    answerWith(QUERY_OTHER, { input: 1800, output: 40 }),
  ];
  const { decision, calls } = await run(proposalScene({ answers }));
  assert.equal(decision.entries[0].proposal.calls.length, 2);
  assert.deepEqual(decision.entries[0].proposal, { calls });
  assert.deepEqual(callTotals(calls), { tokens: { input: 3800, output: 70 }, costUsd: 0.00415 });
});

test('every call of a pick that found nothing is returned, so its cost can be printed', async () => {
  const answers = [answerWith(QUERY_REGISTER, { input: 2000, output: 30 })];
  const { calls } = await run(proposalScene({ answers }));
  assert.deepEqual(callTotals(calls), { tokens: { input: 8000, output: 120 }, costUsd: 0.0086 });
});

test('the decision and the inputs are left as they were', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_REGISTER), answerWith(QUERY_OTHER)] });
  const before = structuredClone({ decision: scene.decision, inputs: scene.inputs });
  await run(scene);
  assert.deepEqual({ decision: scene.decision, inputs: scene.inputs }, before);
});
