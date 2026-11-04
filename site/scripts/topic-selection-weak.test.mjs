import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from './entry-limits.mjs';
import {
  LAPSED_AT,
  categoryClaimed,
  claimed,
  inputsFor,
  prompt,
  provenPrompt,
  published,
  query,
  reportOf,
  sourcesOf,
} from './fixtures/topic-inputs.mjs';
import { MIN_IMPRESSIONS, STRENGTHEN_BAND } from './topic-demand.mjs';
import { selectTopic } from './topic-selection.mjs';

const [GOVERNANCE, AGENTIC] = CATEGORIES;

const WEAK = query('how to write an ai policy', 3, 40, ['/']);
const PROVEN = provenPrompt(9, 'why do AI pilots fail to reach production');
const PILOTS = prompt(9, 'why do AI pilots fail to reach production');
const EVALS = prompt(11, 'how to put evals for AI agents into CI');
const MODEL_CARD = prompt(3, 'what is a model card');
const TOO_LONG = prompt(1, 'who is a fractional chief AI officer for a 100-person SaaS company');
const RETIRED = prompt(4, 'fractional AI officer Israel');
const IN_BAND = query('ai governance', 6, 21.5, ['/glossary/ai-governance']);

const select = (prompts, queries = [], extra = {}) => selectTopic(inputsFor(reportOf(prompts, queries), extra));
const steps = ({ trail }) => trail.map(({ arm, number, query: text, outcome }) => [arm, number ?? text, outcome]);

const WEAK_TOPIC = {
  format: 'article',
  subject: null,
  title: 'How to write an AI policy',
  slug: 'how-to-write-an-ai-policy',
  query: 'how to write an ai policy',
};

test('a slot with no fresh topic, every prompt proven, takes the weaker candidate: a weak-demand entry with its weakness', () => {
  const decision = select([PROVEN], [WEAK]);
  const choice =
    'Choice: signal 3, "how to write an ai policy", 3 impressions at position 40.0, measured 2026-11-01; ' +
    'weak demand: no buyer prompt names it, position worse than 30';
  assert.equal(decision.decision, 'write');
  assert.equal(decision.choice, choice);
  assert.equal(decision.reason, null);
  assert.equal(decision.strengthen, null);
  assert.deepEqual(decision.entries, [
    {
      format: 'article',
      topic: WEAK_TOPIC,
      demand: { impressions: 3, position: 40 },
      table: 'Queries',
      row: WEAK.cells,
      choice,
      origin: 'weak-demand',
      weakness: ['no-buyer-prompt', 'position-beyond-strengthen-band'],
    },
  ]);
  assert.deepEqual(steps(decision), [['weak', 'how to write an ai policy', 'chosen']]);
  assert.equal(decision.fallback, null);
});

test('when every prompt is refused the weak candidate is taken, and the post arm stays in the trail and the ledger', () => {
  const promptSources = sourcesOf({ 4: { retired: true } });
  const decision = select([TOO_LONG, MODEL_CARD, RETIRED, EVALS], [WEAK], { promptSources });
  assert.equal(decision.decision, 'write');
  assert.equal(decision.entries[0].origin, 'weak-demand');
  assert.deepEqual(steps(decision), [
    ['post', 1, 'title-too-long'],
    ['post', 3, 'definition'],
    ['post', 4, 'retired'],
    ['post', 11, 'register-owner'],
    ['weak', 'how to write an ai policy', 'chosen'],
  ]);
  assert.deepEqual(
    decision.refusals.map(({ reason, against }) => [reason, against]),
    [['register-owner', '/glossary/evals']]
  );
  assert.deepEqual(
    decision.advisories.map(({ source, number }) => [source, number]),
    [['register-owner', 11]]
  );
});

test('a prompt that survives beats the weak candidate, which is not even walked, and its entry is marked demand', () => {
  const decision = select([PILOTS], [WEAK]);
  assert.equal(decision.decision, 'write');
  assert.equal(decision.entries[0].origin, 'demand');
  assert.equal(decision.entries[0].prompt.number, 9);
  assert.equal(Object.hasOwn(decision.entries[0], 'weakness'), false);
  assert.deepEqual(steps(decision), [['post', 9, 'chosen']]);
  assert.equal(decision.fallback, null);
});

test('the picker never invents a prompt for a weak candidate, whatever prompts the report holds', () => {
  for (const prompts of [[], [PROVEN], [EVALS, MODEL_CARD]]) {
    const [entry] = select(prompts, [WEAK]).entries;
    assert.equal(entry.origin, 'weak-demand');
    assert.equal(Object.hasOwn(entry, 'prompt'), false);
    assert.equal(entry.prompt, undefined);
    assert.doesNotMatch(entry.choice, /prompt \d/);
  }
});

test('a weak candidate at the floor says so, and a candidate inside the band is weak for the missing prompt alone', () => {
  const atFloor = query('how to price an ai pilot', MIN_IMPRESSIONS, STRENGTHEN_BAND.max + 5, ['/']);
  const [floorEntry] = select([PROVEN], [atFloor]).entries;
  assert.deepEqual(floorEntry.weakness, ['no-buyer-prompt', 'impressions-at-floor', 'position-beyond-strengthen-band']);
  assert.ok(
    floorEntry.choice.endsWith(
      `impressions at the floor of ${MIN_IMPRESSIONS}, position worse than ${STRENGTHEN_BAND.max}`
    )
  );
  const inside = query('how to price an ai pilot', MIN_IMPRESSIONS + 1, STRENGTHEN_BAND.min, ['/']);
  assert.deepEqual(select([PROVEN], [inside]).entries[0].weakness, ['no-buyer-prompt']);
});

test('the most demanded weak candidate is taken, and every one is still listed as a proposal for the owner', () => {
  const second = query('how do i hand over ai leadership to my team', 2, 45, ['/']);
  const decision = select([PROVEN], [second, WEAK]);
  assert.equal(decision.entries[0].topic.slug, 'how-to-write-an-ai-policy');
  assert.deepEqual(
    decision.proposals.map(({ query: text }) => text),
    ['how to write an ai policy', 'how do i hand over ai leadership to my team']
  );
});

test('a weak candidate whose slug is held is passed over for the next, and the refusal is recorded', () => {
  const second = query('how do i hand over ai leadership to my team', 2, 45, ['/']);
  const holder = claimed('how-to-write-an-ai-policy', 'Another title entirely');
  const decision = select([PROVEN], [WEAK, second], { claims: [holder] });
  assert.equal(decision.decision, 'write');
  assert.equal(decision.entries[0].topic.slug, 'how-do-i-hand-over-ai-leadership-to-my-team');
  assert.deepEqual(
    decision.refusals.map(({ reason }) => reason),
    ['slug-held']
  );
  assert.deepEqual(steps(decision), [
    ['weak', 'how to write an ai policy', 'slug-held'],
    ['weak', 'how do i hand over ai leadership to my team', 'chosen'],
  ]);
});

test('a weak candidate is written before a strengthen report, which stays among the advisories', () => {
  const decision = select([PROVEN], [IN_BAND, WEAK]);
  assert.equal(decision.decision, 'write');
  assert.equal(decision.entries[0].origin, 'weak-demand');
  assert.deepEqual(
    decision.advisories.map(({ source, query: text }) => [source, text]),
    [['measured', 'ai governance']]
  );
});

test('an empty report is none with its old reason, and the fallback holds no category when the rotation is empty', () => {
  const decision = select([]);
  assert.equal(decision.decision, 'none');
  assert.equal(decision.reason, 'The report holds no query and no buyer prompt, so there is nothing to choose from.');
  assert.deepEqual(decision.entries, []);
  assert.deepEqual(decision.trail, []);
  assert.deepEqual(decision.fallback, { categories: [] });
});

test('an empty report is none with the rotation order as fallback when a rotation is configured', () => {
  const posts = [published('g1', 'A governance post', { category: GOVERNANCE })];
  const decision = select([], [], { rotation: [GOVERNANCE, AGENTIC], posts });
  assert.equal(decision.decision, 'none');
  assert.equal(decision.reason, 'The report holds no query and no buyer prompt, so there is nothing to choose from.');
  assert.deepEqual(decision.fallback, { categories: [AGENTIC, GOVERNANCE] });
});

test('a report with only a strengthen advisory is strengthen as before, with the rotation order as fallback', () => {
  const decision = select([EVALS], [], { rotation: [...CATEGORIES] });
  assert.equal(decision.decision, 'strengthen');
  assert.equal(decision.strengthen.number, 11);
  assert.deepEqual(decision.fallback, { categories: [...CATEGORIES] });
  assert.equal(select([EVALS]).decision, 'strengthen');
  assert.deepEqual(select([EVALS]).fallback, { categories: [] });
});

test('the fallback order counts the claims in flight, so a run that already took a category sends the next one elsewhere', () => {
  const inFlight = categoryClaimed('first-run', 'First run', GOVERNANCE);
  const decision = select([], [], { rotation: [GOVERNANCE, AGENTIC], claims: [inFlight] });
  assert.deepEqual(decision.fallback, { categories: [AGENTIC, GOVERNANCE] });
});

test('every weak candidate already claimed or already written ends as no candidate, with the fallback and every refusal', () => {
  const second = query('how do i hand over ai leadership to my team', 2, 45, ['/']);
  const open = claimed('how-to-write-an-ai-policy', 'Another title entirely');
  const written = claimed('how-do-i-hand-over-ai-leadership-to-my-team', 'Handing over', {
    status: 'written',
    expiresAt: LAPSED_AT,
  });
  const decision = select([PROVEN], [WEAK, second], { claims: [open, written], rotation: [GOVERNANCE] });
  assert.equal(decision.decision, 'none');
  assert.deepEqual(decision.entries, []);
  assert.deepEqual(steps(decision), [
    ['weak', 'how to write an ai policy', 'slug-held'],
    ['weak', 'how do i hand over ai leadership to my team', 'slug-held'],
  ]);
  assert.equal(decision.refusals.length, 2);
  assert.deepEqual(decision.fallback, { categories: [GOVERNANCE] });
  assert.equal(decision.proposals.length, 2);
});

test('a weak candidate that repeats a published article is refused as the same subject and ends the same way', () => {
  const posts = [
    published('ai-policy-template', 'AI policy template for a small company', { query: 'ai policy template' }),
  ];
  const decision = select([PROVEN], [WEAK], { posts, rotation: [AGENTIC] });
  assert.equal(decision.decision, 'none');
  assert.deepEqual(
    decision.refusals.map(({ reason, against }) => [reason, against]),
    [['same-subject', '/blog/ai-policy-template']]
  );
  assert.deepEqual(decision.fallback, { categories: [AGENTIC] });
});

const OWN = query('what is shadow ai', 12, 44, ['/glossary'], [8]);
const OTHER_OWN = query('what is a red team', 8, 70, ['/glossary'], [8]);
const PROMPTLESS = query('what is a prompt log', 20, 60, ['/glossary']);
const EU = provenPrompt(8, 'EU AI Act obligations for deployers small business');
const withTerms = (queries, settings) =>
  select([EU], [WEAK, ...queries], { settings: { termArm: true, termCap: 5, ...settings } });

test('beside a weak post a term is written only with a prompt of its own, taken from the report', () => {
  const decision = withTerms([OWN]);
  assert.deepEqual(
    decision.entries.map(({ format, origin }) => [format, origin]),
    [
      ['article', 'weak-demand'],
      ['term', 'demand'],
    ]
  );
  assert.deepEqual(decision.entries[1], {
    format: 'term',
    topic: { format: 'term', subject: 'shadow AI', title: 'What is shadow AI?', slug: 'shadow-ai', query: 'shadow ai' },
    prompt: { number: 8, text: 'EU AI Act obligations for deployers small business' },
    demand: { impressions: 12, position: 44 },
    table: 'Queries',
    row: OWN.cells,
    choice: 'Choice: signal 3, "what is shadow ai", 12 impressions at position 44.0, measured 2026-11-01',
    origin: 'demand',
  });
  assert.deepEqual(decision.concepts, { named: [] });
});

test('beside a weak post a term with no prompt of its own is named, never written, and takes no place under the cap', () => {
  const decision = withTerms([PROMPTLESS, OWN, OTHER_OWN], { termCap: 1 });
  assert.deepEqual(
    decision.entries.map(({ topic }) => topic.slug),
    ['how-to-write-an-ai-policy', 'shadow-ai']
  );
  assert.deepEqual(
    decision.concepts.named.map(({ slug, why }) => [slug, why]),
    [
      ['prompt-log', 'no-prompt'],
      ['red-team', 'cap'],
    ]
  );
  assert.deepEqual(decision.concepts.named[0], {
    query: 'what is a prompt log',
    title: 'What is a prompt log?',
    slug: 'prompt-log',
    impressions: 20,
    position: 60,
    why: 'no-prompt',
  });
});

test('with the term arm off every missing concept is named for the arm, whether or not it has a prompt', () => {
  const decision = withTerms([PROMPTLESS, OWN], { termArm: false });
  assert.equal(decision.entries.length, 1);
  assert.deepEqual(
    decision.concepts.named.map(({ slug, why }) => [slug, why]),
    [
      ['prompt-log', 'term-arm-off'],
      ['shadow-ai', 'term-arm-off'],
    ]
  );
});

test('beside a post that has a prompt a term without its own prompt still serves that prompt', () => {
  const decision = select([PILOTS], [PROMPTLESS], { settings: { termArm: true, termCap: 1 } });
  assert.equal(decision.entries[1].prompt.number, 9);
  assert.deepEqual(decision.concepts, { named: [] });
});

test('a decision of every kind carries the same keys, and the fallback is there only when no entry was found', () => {
  const kinds = [select([PILOTS]), select([PROVEN], [WEAK]), select([EVALS]), select([TOO_LONG])];
  assert.deepEqual(
    kinds.map(({ decision }) => decision),
    ['write', 'write', 'strengthen', 'none']
  );
  const keys = Object.keys(kinds[0]).sort();
  assert.ok(keys.includes('fallback'));
  for (const decision of kinds) assert.deepEqual(Object.keys(decision).sort(), keys);
  assert.deepEqual(
    kinds.map(({ fallback }) => fallback),
    [null, null, { categories: [] }, { categories: [] }]
  );
});

test('the picker refuses inputs that lack the published posts or the rotation, so a missing wire is loud on every pick', () => {
  for (const missing of ['posts', 'rotation']) {
    const inputs = inputsFor(reportOf([PILOTS]));
    delete inputs[missing];
    assert.throws(
      () => selectTopic(inputs),
      (error) => error instanceof TypeError && error.message.includes(`inputs.${missing}`)
    );
  }
});

test('selecting twice from the same inputs gives the same decision and leaves the inputs as they were', () => {
  const inputs = inputsFor(reportOf([PROVEN, EVALS], [WEAK, IN_BAND]), { rotation: [GOVERNANCE, AGENTIC] });
  const before = structuredClone(inputs);
  const first = selectTopic(inputs);
  assert.deepEqual(selectTopic(inputs), first);
  assert.deepEqual(inputs, before);
});
