import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateClaim } from './autowriter-claims.mjs';
import { validateLedger } from './autowriter-ledger.mjs';
import { inputsFor, prompt, provenPrompt, query, reportOf } from './fixtures/topic-inputs.mjs';
import { buildRun } from './topic-entries.mjs';
import { selectTopic } from './topic-selection.mjs';

const PILOTS = prompt(9, 'why do AI pilots fail to reach production');
const EU_PROMPT = provenPrompt(8, 'EU AI Act obligations for deployers small business');
const SHADOW = query('what is shadow ai', 12, 44, ['/glossary']);
const LOG = query('what is a prompt log', 5, 60, ['/glossary']);
const OWNED = query('what is an ai register', 9, 50, ['/glossary/ai-register'], [6]);

const withPost = (queries, extra = {}, prompts = [PILOTS]) => selectTopic(inputsFor(reportOf(prompts, queries), extra));
const slugs = ({ entries }) => entries.map(({ topic }) => topic.slug);

test('a definitional query the glossary lacks is written beside the post, with its casing restored', () => {
  const decision = withPost([SHADOW]);
  assert.equal(decision.decision, 'write');
  assert.deepEqual(
    decision.entries.map(({ format }) => format),
    ['article', 'term']
  );
  assert.deepEqual(decision.entries[1], {
    format: 'term',
    topic: { format: 'term', subject: 'shadow AI', title: 'What is shadow AI?', slug: 'shadow-ai', query: 'shadow ai' },
    prompt: { number: 9, text: 'why do AI pilots fail to reach production' },
    demand: { impressions: 12, position: 44 },
    table: 'Queries',
    row: SHADOW.cells,
    choice: 'Choice: signal 3, "what is shadow ai", 12 impressions at position 44.0, measured 2026-11-01',
  });
  assert.equal(decision.choice, decision.entries[0].choice);
  assert.deepEqual(decision.concepts, { named: [] });
});

test('a term takes the first prompt of its query row, in the words of the report', () => {
  const carried = query('what is shadow ai', 12, 44, ['/glossary'], [8, 9]);
  const decision = withPost([carried], {}, [PILOTS, EU_PROMPT]);
  assert.deepEqual(decision.entries[1].prompt, {
    number: 8,
    text: 'EU AI Act obligations for deployers small business',
  });
});

test('a term whose row names no prompt, or one the report does not hold, serves the prompt of the post', () => {
  const unknown = query('what is shadow ai', 12, 44, ['/glossary'], [99]);
  assert.deepEqual(withPost([unknown]).entries[1].prompt, {
    number: 9,
    text: 'why do AI pilots fail to reach production',
  });
  assert.deepEqual(withPost([SHADOW]).entries[1].prompt, {
    number: 9,
    text: 'why do AI pilots fail to reach production',
  });
});

test('the cap cuts the concepts with the fewest impressions into the named list', () => {
  const decision = withPost([LOG, SHADOW]);
  assert.deepEqual(slugs(decision), ['why-do-ai-pilots-fail-to-reach-production', 'shadow-ai']);
  assert.deepEqual(decision.concepts.named, [
    {
      query: 'what is a prompt log',
      title: 'What is a prompt log?',
      slug: 'prompt-log',
      impressions: 5,
      position: 60,
      why: 'cap',
    },
  ]);
});

test('a cap that covers every missing concept writes them all, most impressions first, and names none', () => {
  const decision = withPost([LOG, SHADOW], { settings: { termArm: true, termCap: 2 } });
  assert.deepEqual(slugs(decision), ['why-do-ai-pilots-fail-to-reach-production', 'shadow-ai', 'prompt-log']);
  assert.deepEqual(decision.concepts, { named: [] });
});

test('with the term arm off the post is written alone and every missing concept is named for the digest', () => {
  const decision = withPost([LOG, SHADOW], { settings: { termArm: false, termCap: 3 } });
  assert.equal(decision.decision, 'write');
  assert.deepEqual(slugs(decision), ['why-do-ai-pilots-fail-to-reach-production']);
  assert.deepEqual(
    decision.concepts.named.map(({ slug, why }) => [slug, why]),
    [
      ['shadow-ai', 'term-arm-off'],
      ['prompt-log', 'term-arm-off'],
    ]
  );
});

test('a query whose concept owns a register row is an advisory and a refusal, and no term is written', () => {
  const decision = withPost([OWNED, SHADOW], { settings: { termArm: true, termCap: 5 } });
  assert.deepEqual(slugs(decision), ['why-do-ai-pilots-fail-to-reach-production', 'shadow-ai']);
  assert.deepEqual(
    decision.advisories.map(({ source, route, number, query: text }) => [source, route, number, text]),
    [['register-owner', '/glossary/ai-register', 6, 'what is an ai register']]
  );
  assert.deepEqual(
    decision.refusals.map(({ title, reason }) => [title, reason]),
    [['What is an AI register?', 'register-owner']]
  );
  assert.deepEqual(decision.concepts, { named: [] });
});

test('what is guardrails and what are guardrails are one concept, so one term is written and none is named', () => {
  const queries = [query('what are guardrails', 2, 30), query('what is guardrails', 6, 50)];
  const decision = withPost(queries, { concepts: [], generated: [], settings: { termArm: true, termCap: 5 } });
  assert.deepEqual(slugs(decision), ['why-do-ai-pilots-fail-to-reach-production', 'guardrails']);
  assert.equal(decision.entries[1].topic.title, 'What are guardrails?');
  assert.equal(decision.entries[1].choice.startsWith('Choice: signal 3, "what is guardrails", 6 impressions'), true);
  assert.deepEqual(decision.concepts, { named: [] });
  assert.deepEqual(
    decision.trail.filter(({ arm }) => arm === 'term').map(({ outcome }) => outcome),
    ['chosen', 'same-concept']
  );
});

test('a term that collides with the post is the same concept and is skipped', () => {
  const post = prompt(9, 'shadow AI');
  const decision = withPost([SHADOW], {}, [post]);
  assert.deepEqual(slugs(decision), ['shadow-ai']);
  assert.equal(decision.entries[0].format, 'article');
  assert.deepEqual(
    decision.trail.filter(({ arm }) => arm === 'term').map(({ outcome }) => outcome),
    ['same-concept']
  );
});

test('the post comes first and the terms follow in the order of their measured impressions', () => {
  const queries = [LOG, SHADOW, query('what is a red team', 8, 70, ['/glossary'])];
  const decision = withPost(queries, { settings: { termArm: true, termCap: 3 } });
  assert.deepEqual(slugs(decision), [
    'why-do-ai-pilots-fail-to-reach-production',
    'shadow-ai',
    'red-team',
    'prompt-log',
  ]);
  assert.deepEqual(
    decision.entries.map(({ table }) => table),
    ['Buyer prompts', 'Queries', 'Queries', 'Queries']
  );
});

test('a write decision with terms builds a run whose claims and ledger the schemas accept', () => {
  const decision = withPost([SHADOW, OWNED]);
  const run = buildRun({
    decision,
    report: reportOf([PILOTS]),
    runId: '2026-11-02-1',
    now: new Date('2026-11-02T07:00:00.000Z'),
    reportPath: 'audits/search-demand.md',
  });
  assert.deepEqual(
    run.claims.map(({ claim }) => [claim.format, claim.slug]),
    [
      ['article', 'why-do-ai-pilots-fail-to-reach-production'],
      ['term', 'shadow-ai'],
    ]
  );
  for (const { claim } of run.claims) assert.deepEqual(validateClaim(claim), []);
  assert.deepEqual(validateLedger(run.ledger), []);
  assert.deepEqual(
    run.ledger.refusals.map(({ reason }) => reason),
    ['register-owner']
  );
});
