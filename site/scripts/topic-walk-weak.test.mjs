import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EARLIER_RUN_AT,
  GENERATED,
  LAPSED_AT,
  SUFFIX,
  claimed,
  inputsFor,
  published,
  query,
  reportOf,
} from './fixtures/topic-inputs.mjs';
import { recordPath } from './record-layout.mjs';
import { walkWeak } from './topic-walk.mjs';

const POLICY = query('how to write an ai policy', 3, 40, ['/']);
const HANDOVER = query('how do i hand over ai leadership to my team', 2, 45, ['/']);

const walk = (queries, extra = {}) => walkWeak(inputsFor(reportOf([], queries), extra));
const outcomes = ({ trail }) => trail.map(({ query: text, outcome }) => [text, outcome]);

test('the first weak candidate that passes every check is chosen, and the step names the title it would take', () => {
  const result = walk([POLICY]);
  assert.equal(result.chosen.candidate.query, 'how to write an ai policy');
  assert.deepEqual(result.chosen.candidate.weakness, ['no-buyer-prompt', 'position-beyond-strengthen-band']);
  assert.deepEqual(result.chosen.topic, {
    format: 'article',
    subject: null,
    title: 'How to write an AI policy',
    slug: 'how-to-write-an-ai-policy',
    query: 'how to write an ai policy',
  });
  assert.deepEqual(result.trail, [
    { arm: 'weak', query: 'how to write an ai policy', outcome: 'chosen', detail: 'How to write an AI policy' },
  ]);
  assert.deepEqual(result.refusals, []);
});

test('candidates are walked most impressions first and the walk stops at the first survivor', () => {
  const result = walk([HANDOVER, POLICY]);
  assert.equal(result.chosen.candidate.query, 'how to write an ai policy');
  assert.deepEqual(outcomes(result), [['how to write an ai policy', 'chosen']]);
});

test('a report with no weak candidate chooses nothing and leaves no step', () => {
  assert.deepEqual(walk([]), { chosen: null, trail: [], refusals: [] });
  assert.deepEqual(walk([query('what is shadow ai', 12, 44, ['/'])]), { chosen: null, trail: [], refusals: [] });
});

test('a candidate that names a register concept is refused for the ledger and the walk goes on', () => {
  const owned = query('how to put evals into ci', 9, 50, ['/']);
  const result = walk([owned, POLICY]);
  assert.deepEqual(outcomes(result), [
    ['how to put evals into ci', 'register-owner'],
    ['how to write an ai policy', 'chosen'],
  ]);
  assert.equal(result.chosen.topic.slug, 'how-to-write-an-ai-policy');
  assert.deepEqual(result.refusals, [
    {
      title: 'How to put evals into ci',
      reason: 'register-owner',
      against: '/glossary/evals',
      detail:
        'the query "how to put evals into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals',
    },
  ]);
  assert.equal(result.trail[0].arm, 'weak');
  assert.equal(result.trail[0].detail, result.refusals[0].detail);
});

test('a route the generated layer already lists, and a title it already holds, are refused', () => {
  const route = { family: 'article', route: '/blog/how-to-write-an-ai-policy', title: `Other${SUFFIX}` };
  assert.deepEqual(outcomes(walk([POLICY], { generated: [...GENERATED, route] })), [
    ['how to write an ai policy', 'route-exists'],
  ]);
  const title = { family: 'article', route: '/blog/older-url', title: `HOW TO WRITE AN AI POLICY${SUFFIX}` };
  assert.deepEqual(outcomes(walk([POLICY], { generated: [...GENERATED, title] })), [
    ['how to write an ai policy', 'title-collision'],
  ]);
});

test('a title an unexpired claim holds and a slug a claim or a ledger holds are refused; a lapsed claim holds nothing', () => {
  const byTitle = walk([POLICY], { claims: [claimed('older', 'How to WRITE an AI policy!')] });
  assert.deepEqual(outcomes(byTitle), [['how to write an ai policy', 'title-collision']]);
  const bySlug = walk([POLICY], { claims: [claimed('how-to-write-an-ai-policy', 'Another title entirely')] });
  assert.deepEqual(outcomes(bySlug), [['how to write an ai policy', 'slug-held']]);
  const ledgerPath = recordPath('ledger', 'how-to-write-an-ai-policy', EARLIER_RUN_AT);
  const byLedger = walk([POLICY], { ledgerPaths: [ledgerPath] });
  assert.deepEqual(outcomes(byLedger), [['how to write an ai policy', 'slug-held']]);
  assert.equal(byLedger.refusals[0].against, ledgerPath);
  const lapsed = claimed('older', 'How to write an AI policy', { expiresAt: LAPSED_AT });
  assert.deepEqual(outcomes(walk([POLICY], { claims: [lapsed] })), [['how to write an ai policy', 'chosen']]);
});

test('an article already published on the same subject is refused as the same subject, naming its route', () => {
  const posts = [published('ai-policy-template', 'AI policy template for a small company')];
  const result = walk([POLICY, HANDOVER], { posts });
  assert.deepEqual(outcomes(result), [
    ['how to write an ai policy', 'same-subject'],
    ['how do i hand over ai leadership to my team', 'chosen'],
  ]);
  assert.equal(result.refusals.length, 1);
  assert.equal(result.refusals[0].title, 'How to write an AI policy');
  assert.equal(result.refusals[0].reason, 'same-subject');
  assert.equal(result.refusals[0].against, '/blog/ai-policy-template');
  assert.match(
    result.refusals[0].detail,
    /repeats \/blog\/ai-policy-template \("AI policy template for a small company"\)/
  );
});

test('an article claim in flight on the same subject is refused naming the claim file, and a lapsed one is not', () => {
  const open = claimed('policy-claim', 'An AI policy for a small company', { query: 'ai policy small company' });
  const refused = walk([POLICY], { claims: [open] });
  assert.deepEqual(outcomes(refused), [['how to write an ai policy', 'same-subject']]);
  assert.equal(refused.refusals[0].against, open.path);
  const lapsed = claimed('policy-claim', 'An AI policy for a small company', {
    query: 'ai policy small company',
    expiresAt: LAPSED_AT,
  });
  assert.deepEqual(outcomes(walk([POLICY], { claims: [lapsed] })), [['how to write an ai policy', 'chosen']]);
});

test('a term claim is no article, so it never makes a weak query a repeat', () => {
  const term = claimed('ai-policy', 'What is an AI policy?', { format: 'term', query: 'ai policy' });
  assert.deepEqual(outcomes(walk([POLICY], { claims: [term] })), [['how to write an ai policy', 'chosen']]);
});

test('a title longer than the room and a query that makes no slug leave a step with the outcome and no ledger refusal', () => {
  const long = query(`how to ${'a'.repeat(120)}`, 9, 20, ['/']);
  const blank = query('日本語は何ですか?', 8, 20, ['/']);
  const result = walk([long, blank]);
  assert.deepEqual(
    result.trail.map(({ arm, outcome }) => [arm, outcome]),
    [
      ['weak', 'title-too-long'],
      ['weak', 'no-slug'],
    ]
  );
  assert.ok(result.trail.every(({ detail }) => typeof detail === 'string' && detail.length > 0));
  assert.deepEqual(result.refusals, []);
  assert.equal(result.chosen, null);
});

test('when every candidate is refused nothing is chosen, every candidate has a step and every refusal is recorded', () => {
  const posts = [published('ai-policy-template', 'AI policy template for a small company')];
  const claims = [claimed('older-handover', 'Handing over AI leadership', { query: 'hand over ai leadership' })];
  const handover = query('how to hand over ai leadership', 2, 45, ['/']);
  const result = walk([POLICY, handover], { posts, claims });
  assert.equal(result.chosen, null);
  assert.deepEqual(
    result.trail.map(({ outcome }) => outcome),
    ['same-subject', 'same-subject']
  );
  assert.deepEqual(
    result.refusals.map(({ reason }) => reason),
    ['same-subject', 'same-subject']
  );
});

test('walking twice from the same inputs gives the same result and leaves the inputs as they were', () => {
  const inputs = inputsFor(reportOf([], [HANDOVER, POLICY]), { posts: [published('p', 'A policy post')] });
  const before = structuredClone(inputs);
  const first = walkWeak(inputs);
  assert.deepEqual(walkWeak(inputs), first);
  assert.deepEqual(inputs, before);
});
