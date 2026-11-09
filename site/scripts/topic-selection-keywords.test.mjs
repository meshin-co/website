import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from './entry-limits.mjs';
import {
  claimed,
  inputsFor,
  keywordRow,
  keywordsOf,
  prompt,
  provenPrompt,
  query,
  reportOf,
} from './fixtures/topic-inputs.mjs';
import { wantsProposal } from './topic-proposal.mjs';
import { selectTopic } from './topic-selection.mjs';

const [GOVERNANCE, AGENTIC] = CATEGORIES;

const CHECKLIST = keywordRow('evals checklist', 1200);
const FRAMEWORK = keywordRow('ai governance framework', 803, 1051);
const TEMPLATE = keywordRow('ai register template', 500);
const POLICY = keywordRow('ai governance policy', 32);
const SHADOW_AI = keywordRow('shadow ai', 90);

const PILOTS = prompt(9, 'why do AI pilots fail to reach production');
const PROVEN = provenPrompt(9, 'why do AI pilots fail to reach production');
const EU = provenPrompt(8, 'EU AI Act obligations for deployers small business');
const WEAK = query('how to write an ai policy', 3, 40, ['/']);
const IN_BAND = query('ai governance', 6, 21.5, ['/glossary/ai-governance']);
const SHADOW = query('what is shadow ai', 12, 44, ['/glossary'], [8]);
const ORPHAN_TERM = query('what is shadow ai', 12, 44, ['/glossary']);

const KEYWORD_CHOICE = 'Choice: keyword, "ai governance framework", 803 exact impressions on Bing, measured 2026-11-09';
const KEYWORD_TOPIC = {
  format: 'article',
  subject: null,
  title: 'AI governance framework',
  slug: 'ai-governance-framework',
  query: 'ai governance framework',
};
const OWNED_DETAIL =
  'the query "evals checklist" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals';
const NOTHING_TO_CHOOSE = 'The report holds no query and no buyer prompt, so there is nothing to choose from.';

const select = (prompts, queries = [], extra = {}) =>
  selectTopic(
    inputsFor(reportOf(prompts, queries), {
      keywords: keywordsOf([FRAMEWORK, POLICY]),
      rotation: [GOVERNANCE, AGENTIC],
      ...extra,
    })
  );
const withKeywords = (rows, prompts = [], queries = [], extra = {}) =>
  select(prompts, queries, { keywords: keywordsOf(rows), ...extra });
const steps = ({ trail }) => trail.map(({ arm, number, query: text, outcome }) => [arm, number ?? text, outcome]);
const armsOf = (decision) => steps(decision).map(([arm]) => arm);

test('with no Search Console lead the keyword candidate with the most exact impressions is written ahead of the category rotation', () => {
  const decision = select([]);
  assert.equal(decision.decision, 'write');
  assert.equal(decision.choice, KEYWORD_CHOICE);
  assert.equal(decision.reason, null);
  assert.equal(decision.strengthen, null);
  assert.deepEqual(
    decision.entries.map(({ topic }) => topic.slug),
    ['ai-governance-framework']
  );
  assert.deepEqual(steps(decision), [['keyword', 'ai governance framework', 'chosen']]);
});

test('a keyword pick needs no model: the decision names no category to propose for, and the proposal step does not want it', () => {
  const decision = select([]);
  assert.equal(decision.fallback, null);
  assert.equal(wantsProposal(decision), false);
});

test('the keyword entry carries origin keyword, the phrase and the exact impressions with no position, and no prompt, category or weakness', () => {
  const [entry] = select([]).entries;
  assert.deepEqual(entry, {
    format: 'article',
    topic: KEYWORD_TOPIC,
    demand: { impressions: 803, position: null },
    table: null,
    row: null,
    choice: KEYWORD_CHOICE,
    origin: 'keyword',
    phrase: 'ai governance framework',
  });
});

test('a buyer prompt that survives still wins over a keyword candidate, which is not even walked', () => {
  const decision = select([PILOTS]);
  assert.equal(decision.entries[0].origin, 'demand');
  assert.equal(decision.entries[0].topic.slug, 'why-do-ai-pilots-fail-to-reach-production');
  assert.equal(armsOf(decision).includes('keyword'), false);
});

test('a weak Search Console query still wins over a keyword candidate, which is not even walked', () => {
  const decision = select([PROVEN], [WEAK]);
  assert.equal(decision.entries[0].origin, 'weak-demand');
  assert.equal(armsOf(decision).includes('keyword'), false);
});

test('a candidate that names a register concept is an advisory, and the next candidate takes the slot with that advisory kept', () => {
  const decision = withKeywords([CHECKLIST, FRAMEWORK]);
  assert.equal(decision.decision, 'write');
  assert.equal(decision.entries[0].topic.slug, 'ai-governance-framework');
  assert.equal(decision.strengthen, null);
  assert.deepEqual(decision.advisories, [
    {
      source: 'register-owner',
      route: '/glossary/evals',
      query: 'evals checklist',
      number: null,
      impressions: 1200,
      position: null,
      reason: `${OWNED_DETAIL}; the phrase has 1200 exact impressions on Bing, measured 2026-11-09: strengthen that route and add no page`,
    },
  ]);
  assert.deepEqual(steps(decision), [
    ['keyword', 'evals checklist', 'register-owner'],
    ['keyword', 'ai governance framework', 'chosen'],
  ]);
  assert.deepEqual(
    decision.refusals.map(({ reason, against }) => [reason, against]),
    [['register-owner', '/glossary/evals']]
  );
});

test('every candidate naming a register concept leaves no page, one advisory each, the first as the strengthen report, and the rotation as the fallback', () => {
  const decision = withKeywords([TEMPLATE, CHECKLIST]);
  assert.equal(decision.decision, 'strengthen');
  assert.deepEqual(decision.entries, []);
  assert.equal(
    decision.choice,
    'Choice: keyword, "evals checklist", 1200 exact impressions on Bing, measured 2026-11-09; strengthens /glossary/evals'
  );
  assert.deepEqual(
    [decision.strengthen, ...decision.advisories].map(({ route, query: text, impressions }) => [
      route,
      text,
      impressions,
    ]),
    [
      ['/glossary/evals', 'evals checklist', 1200],
      ['/glossary/ai-register', 'ai register template', 500],
    ]
  );
  assert.deepEqual(decision.fallback, withKeywords([]).fallback);
  assert.equal(wantsProposal(decision), true);
});

test('a candidate a claim holds is skipped, the next one is taken, and the refusal is recorded', () => {
  const holder = claimed('ai-governance-framework', 'Another title entirely');
  const decision = select([], [], { claims: [holder] });
  assert.equal(decision.decision, 'write');
  assert.equal(decision.entries[0].topic.slug, 'ai-governance-policy');
  assert.deepEqual(steps(decision), [
    ['keyword', 'ai governance framework', 'slug-held'],
    ['keyword', 'ai governance policy', 'chosen'],
  ]);
  assert.deepEqual(
    decision.refusals.map(({ reason }) => reason),
    ['slug-held']
  );
  assert.equal(decision.fallback, null);
});

test('when every candidate is occupied the decision falls to the category rotation, with every step and refusal kept and the rotation unchanged', () => {
  const claims = [
    claimed('ai-governance-framework', 'Another title entirely'),
    claimed('ai-governance-policy', 'Yet another title'),
  ];
  const decision = select([], [], { claims });
  assert.equal(decision.decision, 'none');
  assert.equal(decision.reason, NOTHING_TO_CHOOSE);
  assert.deepEqual(decision.entries, []);
  assert.deepEqual(steps(decision), [
    ['keyword', 'ai governance framework', 'slug-held'],
    ['keyword', 'ai governance policy', 'slug-held'],
  ]);
  assert.equal(decision.refusals.length, 2);
  assert.deepEqual(decision.advisories, []);
  assert.deepEqual(decision.fallback, select([], [], { claims, keywords: keywordsOf([]) }).fallback);
  assert.equal(wantsProposal(decision), true);
});

test('a report with no candidate is no candidates: the decision is the one the picker gave before the keyword rung existed', () => {
  const decision = withKeywords([]);
  assert.equal(decision.decision, 'none');
  assert.equal(decision.reason, NOTHING_TO_CHOOSE);
  assert.deepEqual(decision.trail, []);
  assert.deepEqual(decision.refusals, []);
  assert.deepEqual(decision.advisories, []);
  assert.deepEqual(decision.fallback, { categories: [GOVERNANCE, AGENTIC] });
});

test('a term that carries its own buyer prompt is written beside a keyword pick, as it is beside a weak query', () => {
  const decision = select([EU], [SHADOW], { settings: { termArm: true, termCap: 5 } });
  assert.equal(decision.decision, 'write');
  assert.deepEqual(
    decision.entries.map(({ format, origin }) => [format, origin]),
    [
      ['article', 'keyword'],
      ['term', 'demand'],
    ]
  );
  assert.equal(decision.entries[1].prompt.number, 8);
  assert.deepEqual(decision.concepts, { named: [] });
});

test('a term with no buyer prompt to carry it is named beside a keyword pick and not written', () => {
  const decision = select([], [ORPHAN_TERM]);
  assert.deepEqual(
    decision.entries.map(({ origin }) => origin),
    ['keyword']
  );
  assert.deepEqual(
    decision.concepts.named.map(({ query: text, why }) => [text, why]),
    [['what is shadow ai', 'no-prompt']]
  );
});

test('a term that names the subject of the keyword pick is the same concept and is not written twice', () => {
  const decision = select([EU], [SHADOW], { keywords: keywordsOf([SHADOW_AI]) });
  assert.deepEqual(
    decision.entries.map(({ origin }) => origin),
    ['keyword']
  );
  assert.ok(steps(decision).some((step) => step.join() === 'term,what is shadow ai,same-concept'));
});

test('a Search Console strengthen report stays ahead of a keyword advisory among the advisories when a keyword candidate is written', () => {
  const decision = withKeywords([CHECKLIST, FRAMEWORK], [PROVEN], [IN_BAND]);
  assert.equal(decision.decision, 'write');
  assert.deepEqual(
    decision.advisories.map(({ source, query: text }) => [source, text]),
    [
      ['measured', 'ai governance'],
      ['register-owner', 'evals checklist'],
    ]
  );
});

test('an order by hand never reaches the keyword rung', () => {
  const refused = select([PILOTS], [], { order: { kind: 'prompt', number: 31 } });
  assert.equal(refused.decision, 'none');
  assert.equal(refused.fallback, null);
  assert.deepEqual(armsOf(refused), ['ordered']);
  const taken = select([PILOTS], [], { order: { kind: 'title', text: 'Why AI steering committees stall' } });
  assert.deepEqual(
    taken.entries.map(({ origin }) => origin),
    ['ordered']
  );
  assert.equal(armsOf(taken).includes('keyword'), false);
});

test('a decision of every kind carries the same keys, a keyword pick included', () => {
  const kinds = [select([]), select([PILOTS]), withKeywords([CHECKLIST]), withKeywords([])];
  assert.deepEqual(
    kinds.map(({ decision }) => decision),
    ['write', 'write', 'strengthen', 'none']
  );
  const keys = Object.keys(kinds[0]).sort();
  for (const decision of kinds) assert.deepEqual(Object.keys(decision).sort(), keys);
  assert.deepEqual(
    kinds.map(({ fallback }) => fallback === null),
    [true, true, false, false]
  );
});

test('the picker refuses inputs that lack the keyword report, so a missing wire is loud on every pick', () => {
  for (const broken of [undefined, null, [], { candidates: 'none' }]) {
    const inputs = inputsFor(reportOf([PILOTS]));
    inputs.keywords = broken;
    assert.throws(
      () => selectTopic(inputs),
      (error) => error instanceof TypeError && error.message.includes('inputs.keywords'),
      JSON.stringify(broken)
    );
  }
});

test('selecting twice from the same inputs gives the same decision and leaves the inputs as they were', () => {
  const inputs = inputsFor(reportOf([PROVEN], [IN_BAND]), {
    keywords: keywordsOf([CHECKLIST, FRAMEWORK, POLICY]),
    rotation: [GOVERNANCE, AGENTIC],
  });
  const before = structuredClone(inputs);
  const first = selectTopic(inputs);
  assert.deepEqual(selectTopic(inputs), first);
  assert.deepEqual(inputs, before);
});
