import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EARLIER_RUN_AT, GENERATED, LAPSED_AT, claimed, inputsFor, query, reportOf } from './fixtures/topic-inputs.mjs';
import { recordPath } from './record-layout.mjs';
import { walkTerms } from './topic-walk.mjs';

const SHADOW = query('what is shadow ai', 12, 44, ['/glossary']);

const walk = (queries, extra = {}, post = null) => walkTerms(inputsFor(reportOf([], queries), extra), post);
const outcomes = ({ trail }) => trail.map(({ query: text, outcome }) => [text, outcome]);

test('a definitional query survives with its casing restored, and the step names the title it would take', () => {
  const measured = query('what is the eu ai act', 48, 76.2, ['/glossary/eu-ai-act'], [8]);
  const result = walk([measured], { concepts: [], generated: [] });
  assert.equal(result.survivors.length, 1);
  assert.equal(result.survivors[0].candidate.query, 'what is the eu ai act');
  assert.equal(result.survivors[0].candidate.text, 'what is the EU AI act');
  assert.deepEqual(result.survivors[0].topic, {
    format: 'term',
    subject: 'EU AI act',
    title: 'What is the EU AI act?',
    slug: 'eu-ai-act',
    query: 'eu ai act',
  });
  assert.deepEqual(result.trail, [
    { arm: 'term', query: 'what is the eu ai act', outcome: 'chosen', detail: 'What is the EU AI act?' },
  ]);
  assert.deepEqual(result.refusals, []);
  assert.deepEqual(result.advisories, []);
});

test('every candidate is examined, most impressions first, and a survivor does not stop the walk', () => {
  const queries = [
    query('what is beta', 3, 60),
    query('what is alpha', 9, 70),
    query('what is gamma', 3, 20),
    query('how to delta', 50, 10),
  ];
  const result = walk(queries);
  assert.deepEqual(outcomes(result), [
    ['what is alpha', 'chosen'],
    ['what is gamma', 'chosen'],
    ['what is beta', 'chosen'],
  ]);
  assert.deepEqual(
    result.survivors.map(({ topic }) => topic.slug),
    ['alpha', 'gamma', 'beta']
  );
});

test('a query that is no definition, or whose subject the rules refuse, is not a candidate and leaves no step', () => {
  const queries = [
    query('how to write an ai policy', 9, 40),
    query('ai governance', 8, 30),
    query('what is the difference between a model card and a datasheet', 7, 25),
  ];
  assert.deepEqual(walk(queries), { survivors: [], trail: [], refusals: [], advisories: [] });
});

test('a query whose concept the register owns is recorded, offered as an advisory and not written', () => {
  const measured = query('what is an ai register', 9, 50, ['/glossary/ai-register'], [6]);
  const result = walk([measured, SHADOW]);
  assert.deepEqual(outcomes(result), [
    ['what is shadow ai', 'chosen'],
    ['what is an ai register', 'register-owner'],
  ]);
  assert.deepEqual(
    result.survivors.map(({ topic }) => topic.slug),
    ['shadow-ai']
  );
  assert.deepEqual(result.refusals, [
    {
      title: 'What is an AI register?',
      reason: 'register-owner',
      against: '/glossary/ai-register',
      detail:
        'the query "ai register" names the concept "AI register", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/ai-register',
    },
  ]);
  assert.deepEqual(result.advisories, [
    {
      source: 'register-owner',
      route: '/glossary/ai-register',
      query: 'what is an ai register',
      number: 6,
      impressions: 9,
      position: 50,
      reason:
        'the query "ai register" names the concept "AI register", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/ai-register; ' +
        'the query "what is an ai register" has 9 impressions at position 50.0 over 2026-08-01 to 2026-10-30: strengthen that route and add no page',
      choice:
        'Choice: signal 3, "what is an ai register", 9 impressions at position 50.0, measured 2026-11-01; strengthens /glossary/ai-register',
    },
  ]);
});

test('a glossary route that already exists under the slug is recorded and offered as an advisory', () => {
  const generated = [
    ...GENERATED,
    { family: 'term', route: '/glossary/llm-gateway', title: 'What is a gateway for LLMs? — meshin.co' },
  ];
  const result = walk([query('what is an llm gateway', 5, 40)], { generated });
  assert.deepEqual(outcomes(result), [['what is an llm gateway', 'route-exists']]);
  assert.equal(result.refusals[0].reason, 'route-exists');
  assert.equal(result.refusals[0].title, 'What is an LLM gateway?');
  assert.deepEqual(
    result.advisories.map(({ source, route, number, impressions, position }) => [
      source,
      route,
      number,
      impressions,
      position,
    ]),
    [['route-exists', '/glossary/llm-gateway', null, 5, 40]]
  );
  assert.deepEqual(result.survivors, []);
});

test('a title the generated layer carries under another route is recorded and offers no advisory', () => {
  const generated = [{ family: 'article', route: '/blog/what-is-shadow-ai', title: 'WHAT IS SHADOW AI — meshin.co' }];
  const result = walk([SHADOW], { generated });
  assert.deepEqual(outcomes(result), [['what is shadow ai', 'title-collision']]);
  assert.equal(result.refusals[0].reason, 'title-collision');
  assert.deepEqual(result.advisories, []);
  assert.deepEqual(result.survivors, []);
});

test('a title an unexpired claim holds is recorded, and a lapsed claim holds nothing', () => {
  const held = claimed('older-slug', 'What is shadow AI?', { format: 'term' });
  assert.deepEqual(outcomes(walk([SHADOW], { claims: [held] })), [['what is shadow ai', 'title-collision']]);
  const lapsed = claimed('older-slug', 'What is shadow AI?', { format: 'term', expiresAt: LAPSED_AT });
  assert.deepEqual(outcomes(walk([SHADOW], { claims: [lapsed] })), [['what is shadow ai', 'chosen']]);
});

test('a slug a claim holds, and a slug that already has a ledger, are recorded as held', () => {
  const holder = claimed('shadow-ai', 'Another title entirely', { format: 'term' });
  const byClaim = walk([SHADOW], { claims: [holder] });
  assert.deepEqual(outcomes(byClaim), [['what is shadow ai', 'slug-held']]);
  assert.equal(byClaim.refusals[0].against, recordPath('claim', 'shadow-ai', holder.claim.claimedAt));
  const ledgerPath = recordPath('ledger', 'shadow-ai', EARLIER_RUN_AT);
  const byLedger = walk([SHADOW], { ledgerPaths: [ledgerPath] });
  assert.deepEqual(outcomes(byLedger), [['what is shadow ai', 'slug-held']]);
  assert.equal(byLedger.refusals[0].against, ledgerPath);
});

test('what is guardrails and what are guardrails name one concept, so the second is the same concept', () => {
  const queries = [query('what are guardrails', 2, 30), query('what is guardrails', 6, 50)];
  const result = walk(queries, { concepts: [], generated: [] });
  assert.deepEqual(outcomes(result), [
    ['what is guardrails', 'chosen'],
    ['what are guardrails', 'same-concept'],
  ]);
  assert.equal(result.survivors.length, 1);
  assert.equal(result.survivors[0].topic.title, 'What are guardrails?');
  assert.deepEqual(result.refusals, []);
  assert.deepEqual(result.advisories, []);
  assert.match(result.trail[1].detail, /guardrails/);
});

test('a term whose slug or title the post already took is the same concept as the post', () => {
  const bySlug = walk([SHADOW], {}, { topic: { slug: 'shadow-ai', title: 'Shadow AI in a small company' } });
  assert.deepEqual(outcomes(bySlug), [['what is shadow ai', 'same-concept']]);
  const byTitle = walk([SHADOW], {}, { topic: { slug: 'other-slug', title: 'WHAT IS SHADOW AI' } });
  assert.deepEqual(outcomes(byTitle), [['what is shadow ai', 'same-concept']]);
  assert.deepEqual(bySlug.survivors, []);
});

test('a title longer than the room is refused and so is a subject that has no slug, with no refusal recorded', () => {
  const queries = [query('what is ' + 'a'.repeat(60), 9, 20), query('what is 日本語', 4, 20)];
  const result = walk(queries);
  assert.deepEqual(
    result.trail.map(({ outcome }) => outcome),
    ['title-too-long', 'no-slug']
  );
  assert.deepEqual(result.refusals, []);
  assert.deepEqual(result.advisories, []);
});
