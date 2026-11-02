import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LAPSED_AT,
  claimed,
  inputsFor,
  prompt,
  provenPrompt,
  query,
  reportOf,
  sourcesOf,
} from './fixtures/topic-inputs.mjs';
import { selectTopic } from './topic-selection.mjs';

const PILOTS = prompt(9, 'why do AI pilots fail to reach production');
const HANDOVER = prompt(15, 'how to hand over AI leadership to internal team');
const EVALS = prompt(11, 'how to put evals for AI agents into CI');
const NOUN = prompt(7, 'AI acceptable use policy template');
const MODEL_CARD = prompt(3, 'what is a model card');
const TOO_LONG = prompt(1, 'who is a fractional chief AI officer for a 100-person SaaS company');
const GOVERNANCE = query('ai governance', 6, 21.5, ['/glossary/ai-governance']);

const ADVISORY_KEYS = ['source', 'route', 'query', 'number', 'impressions', 'position', 'reason'];
const DECISION_KEYS = [
  'advisories',
  'choice',
  'concepts',
  'decision',
  'entries',
  'proposals',
  'reason',
  'refusals',
  'strengthen',
  'trail',
];

const select = (prompts, queries = [], extra = {}) => selectTopic(inputsFor(reportOf(prompts, queries), extra));
const stepsOf = ({ trail }) => trail.map(({ arm, number, query: text, outcome }) => [arm, number ?? text, outcome]);

test('the first unproven prompt that passes every check is the post, and the entry says what justified it', () => {
  const decision = select([NOUN, PILOTS, HANDOVER]);
  const choice = 'Choice: signal 2, prompt 7, unproven, 0 impressions in the window to 2026-10-30';
  assert.equal(decision.decision, 'write');
  assert.equal(decision.choice, choice);
  assert.equal(decision.reason, null);
  assert.equal(decision.strengthen, null);
  assert.deepEqual(decision.entries, [
    {
      format: 'article',
      topic: {
        format: 'article',
        subject: null,
        title: 'AI acceptable use policy template',
        slug: 'ai-acceptable-use-policy-template',
        query: 'ai acceptable use policy template',
      },
      prompt: { number: 7, text: 'AI acceptable use policy template' },
      demand: { impressions: 0, position: null },
      table: 'Buyer prompts',
      row: NOUN.cells,
      choice,
    },
  ]);
  assert.deepEqual(decision.concepts, { named: [] });
  assert.deepEqual(stepsOf(decision), [['post', 7, 'chosen']]);
});

test('a decision of every kind carries the same keys', () => {
  const kinds = [select([PILOTS]), select([EVALS]), select([TOO_LONG])];
  assert.deepEqual(
    kinds.map(({ decision }) => decision),
    ['write', 'strengthen', 'none']
  );
  for (const decision of kinds) assert.deepEqual(Object.keys(decision).sort(), DECISION_KEYS);
});

test('the walk passes a retired prompt and says so in the trail', () => {
  const retired = prompt(4, 'fractional AI officer Israel');
  const decision = select([retired, PILOTS], [], { promptSources: sourcesOf({ 4: { retired: true } }) });
  assert.equal(decision.entries[0].prompt.number, 9);
  assert.deepEqual(stepsOf(decision), [
    ['post', 4, 'retired'],
    ['post', 9, 'chosen'],
  ]);
  assert.deepEqual(decision.refusals, []);
});

test('a definitional prompt is left to the term arm, whatever its title would have been', () => {
  const decision = select([MODEL_CARD, PILOTS]);
  assert.equal(decision.entries[0].prompt.number, 9);
  assert.deepEqual(stepsOf(decision)[0], ['post', 3, 'definition']);
  assert.deepEqual(decision.refusals, []);
});

test('a prompt that names a register concept is an advisory and a ledger refusal, and the walk goes on', () => {
  const decision = select([EVALS, HANDOVER]);
  assert.equal(decision.decision, 'write');
  assert.equal(decision.entries[0].prompt.number, 15);
  assert.deepEqual(
    decision.refusals.map(({ title, reason, against }) => [title, reason, against]),
    [['How to put evals for AI agents into CI', 'register-owner', '/glossary/evals']]
  );
  assert.equal(decision.advisories.length, 1);
  assert.deepEqual(Object.keys(decision.advisories[0]), ADVISORY_KEYS);
  assert.deepEqual(decision.advisories[0], {
    source: 'register-owner',
    route: '/glossary/evals',
    query: 'how to put evals for AI agents into CI',
    number: 11,
    impressions: 0,
    position: null,
    reason:
      'prompt 11 is unproven and the query "how to put evals for ai agents into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals',
  });
});

test('a prompt a route of its own format already answers is an advisory, and a prompt whose route exists is recorded', () => {
  const served = sourcesOf({ 9: { routes: ['/blog/why-your-ai-pilot-never-reached-production'] } });
  const byRoute = select([PILOTS, HANDOVER], [], { promptSources: served });
  assert.equal(byRoute.entries[0].prompt.number, 15);
  assert.deepEqual(
    byRoute.advisories.map(({ source, number }) => [source, number]),
    [['family-served', 9]]
  );
  const generated = [
    { family: 'article', route: '/blog/why-do-ai-pilots-fail-to-reach-production', title: 'Other — meshin.co' },
  ];
  const byGenerated = select([PILOTS, HANDOVER], [], { generated });
  assert.equal(byGenerated.entries[0].prompt.number, 15);
  assert.deepEqual(
    byGenerated.refusals.map(({ reason }) => reason),
    ['route-exists']
  );
  assert.deepEqual(byGenerated.advisories, []);
});

test('a title the generated layer holds, or an unexpired claim holds, takes the next candidate and is recorded', () => {
  const layer = [
    { family: 'article', route: '/blog/older-url', title: 'Why do AI pilots fail to reach production? — meshin.co' },
  ];
  const byLayer = select([PILOTS, HANDOVER], [], { generated: layer });
  assert.equal(byLayer.entries[0].prompt.number, 15);
  assert.deepEqual(
    byLayer.refusals.map(({ reason, against }) => [reason, against]),
    [['title-collision', 'Why do AI pilots fail to reach production? — meshin.co']]
  );
  const holder = claimed('older-slug', 'WHY DO AI PILOTS FAIL TO REACH PRODUCTION');
  const byClaim = select([PILOTS, HANDOVER], [], { claims: [holder] });
  assert.equal(byClaim.entries[0].prompt.number, 15);
  assert.equal(byClaim.refusals[0].reason, 'title-collision');
});

test('a claim that lapsed holds nothing, so the prompt it named is taken', () => {
  const lapsed = claimed('older-slug', 'Why do AI pilots fail to reach production?', { expiresAt: LAPSED_AT });
  const decision = select([PILOTS, HANDOVER], [], { claims: [lapsed] });
  assert.equal(decision.entries[0].prompt.number, 9);
  assert.deepEqual(decision.refusals, []);
});

test('a slug that already has a ledger is not claimed a second time', () => {
  const decision = select([PILOTS, HANDOVER], [], { ledgerSlugs: ['why-do-ai-pilots-fail-to-reach-production'] });
  assert.equal(decision.entries[0].prompt.number, 15);
  assert.equal(decision.refusals[0].reason, 'slug-held');
});

test('a title longer than the room is passed over without a refusal', () => {
  const decision = select([TOO_LONG, PILOTS]);
  assert.equal(decision.entries[0].prompt.number, 9);
  assert.deepEqual(stepsOf(decision)[0], ['post', 1, 'title-too-long']);
  assert.deepEqual(decision.refusals, []);
});

test('a proven prompt is never a post', () => {
  assert.equal(select([provenPrompt(9, PILOTS.prompt), HANDOVER]).entries[0].prompt.number, 15);
});

test('a measured query in the band is offered as advice beside the post, with the prompt it proves', () => {
  const proving = query('ai governance', 6, 21.5, ['/glossary/ai-governance'], [4]);
  const decision = select([PILOTS], [proving]);
  assert.equal(decision.decision, 'write');
  assert.deepEqual(decision.advisories, [
    {
      source: 'measured',
      route: '/glossary/ai-governance',
      query: 'ai governance',
      number: 4,
      impressions: 6,
      position: 21.5,
      reason:
        'query "ai governance" has 6 impressions at position 21.5 over 2026-08-01 to 2026-10-30, inside positions 8 to 30: strengthen the route that already ranks and add no page',
    },
  ]);
  assert.equal(select([PILOTS], [GOVERNANCE]).advisories[0].number, null);
});

test('advisories run from the measured rows to the refused prompts to the refused terms', () => {
  const owned = query('what is an ai register', 9, 50, ['/glossary/ai-register']);
  const decision = select([EVALS, HANDOVER], [owned, GOVERNANCE]);
  assert.equal(decision.decision, 'write');
  assert.deepEqual(
    decision.advisories.map(({ source, query: text }) => [source, text]),
    [
      ['measured', 'ai governance'],
      ['register-owner', 'how to put evals for AI agents into CI'],
      ['register-owner', 'what is an ai register'],
    ]
  );
});

test('the refusals come in walk order, the post arm first and the term arm after', () => {
  const owned = query('what is an ai register', 9, 50, ['/glossary/ai-register']);
  const decision = select([EVALS, HANDOVER], [owned]);
  assert.deepEqual(
    decision.refusals.map(({ title }) => title),
    ['How to put evals for AI agents into CI', 'What is an AI register?']
  );
});

test('a measured query nobody names, no page answers and that asks how is a proposal, never a post', () => {
  const unnamed = query('how to write an ai policy', 3, 40, ['/']);
  const decision = select([PILOTS], [unnamed]);
  assert.deepEqual(decision.proposals, [
    { query: 'how to write an ai policy', impressions: 3, position: 40, page: '/' },
  ]);
  assert.equal(decision.entries.length, 1);
  assert.equal(decision.entries[0].prompt.number, 9);
});

test('selecting twice from the same inputs gives the same decision and leaves the inputs as they were', () => {
  const inputs = inputsFor(reportOf([EVALS, HANDOVER], [GOVERNANCE]), { promptSources: sourcesOf({ 15: {} }) });
  const before = structuredClone(inputs);
  const first = selectTopic(inputs);
  assert.deepEqual(selectTopic(inputs), first);
  assert.deepEqual(inputs, before);
});
