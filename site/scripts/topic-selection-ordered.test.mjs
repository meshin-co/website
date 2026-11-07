import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from './entry-limits.mjs';
import {
  EARLIER_RUN_AT,
  claimed,
  inputsFor,
  prompt,
  provenPrompt,
  published,
  query,
  reportOf,
  sourcesOf,
} from './fixtures/topic-inputs.mjs';
import { recordPath } from './record-layout.mjs';
import { wantsProposal } from './topic-proposal.mjs';
import { selectTopic } from './topic-selection.mjs';

const [GOVERNANCE, AGENTIC] = CATEGORIES;

const PILOTS = prompt(9, 'why do AI pilots fail to reach production');
const EVALS = prompt(11, 'how to put evals for AI agents into CI');
const BOARD = prompt(30, 'board memo AI strategy one page');
const WEAK = query('how to write an ai policy', 3, 40, ['/']);
const IN_BAND = query('ai governance', 6, 21.5, ['/glossary/ai-governance']);
const DEFINITION = query('what is a model card', 5, 30, ['/']);
const LADDER = reportOf([PILOTS, EVALS, BOARD], [WEAK, IN_BAND, DEFINITION]);

const byPrompt = (number) => ({ kind: 'prompt', number });
const byTitle = (text) => ({ kind: 'title', text });
const select = (order, extra = {}) =>
  selectTopic(inputsFor(LADDER, { order, rotation: [GOVERNANCE, AGENTIC], ...extra }));

const BOARD_TOPIC = {
  format: 'article',
  subject: null,
  title: 'Board memo AI strategy one page',
  slug: 'board-memo-ai-strategy-one-page',
  query: 'board memo ai strategy one page',
};
const STEERING = {
  format: 'article',
  subject: null,
  title: 'Why AI steering committees stall?',
  slug: 'why-ai-steering-committees-stall',
  query: 'why ai steering committees stall',
};

test('with no order the ladder still chooses as before: the lowest unproven prompt that survives, and the term beside it', () => {
  const decision = select(null);
  assert.equal(decision.decision, 'write');
  assert.equal(decision.choice, 'Choice: signal 2, prompt 9, unproven, 0 impressions in the window to 2026-10-30');
  assert.deepEqual(
    decision.entries.map(({ format, origin }) => [format, origin]),
    [
      ['article', 'demand'],
      ['term', 'demand'],
    ]
  );
});

test('an order by prompt number writes that prompt alone, whatever the ladder would have chosen, and the entry says it was ordered', () => {
  const decision = select(byPrompt(30));
  const choice = 'Choice: ordered, prompt 30, requested by hand';
  assert.equal(decision.decision, 'write');
  assert.equal(decision.choice, choice);
  assert.equal(decision.reason, null);
  assert.deepEqual(decision.entries, [
    {
      format: 'article',
      topic: BOARD_TOPIC,
      prompt: { number: 30, text: BOARD.prompt },
      demand: { impressions: 0, position: null },
      table: 'Buyer prompts',
      row: BOARD.cells,
      choice,
      origin: 'ordered',
    },
  ]);
  assert.deepEqual(decision.trail, [
    { arm: 'ordered', number: 30, outcome: 'chosen', detail: 'Board memo AI strategy one page' },
  ]);
});

test('an order writes no term, reports no strengthen, names no concept and proposes nothing, because the owner asked for one topic', () => {
  for (const order of [byPrompt(30), byTitle('Why AI steering committees stall')]) {
    const decision = select(order);
    assert.equal(decision.entries.length, 1, order.kind);
    assert.equal(decision.strengthen, null, order.kind);
    assert.deepEqual(decision.advisories, [], order.kind);
    assert.deepEqual(decision.concepts, { named: [] }, order.kind);
    assert.deepEqual(decision.proposals, [], order.kind);
    assert.equal(decision.fallback, null, order.kind);
    assert.deepEqual(decision.refusals, [], order.kind);
    assert.equal(decision.trail.length, 1, order.kind);
  }
});

test('an order by title writes an article with no prompt, no report row and no demand, quoting the title it was given', () => {
  const decision = select(byTitle('Why AI steering committees stall'));
  const choice = 'Choice: ordered, "Why AI steering committees stall", requested by hand';
  assert.equal(decision.decision, 'write');
  assert.equal(decision.choice, choice);
  assert.deepEqual(decision.entries, [
    {
      format: 'article',
      topic: STEERING,
      demand: { impressions: 0, position: null },
      table: null,
      row: null,
      choice,
      origin: 'ordered',
    },
  ]);
  assert.equal(Object.hasOwn(decision.entries[0], 'prompt'), false);
});

test('an order by title needs nothing from the report, so an empty one still writes it', () => {
  const decision = selectTopic(inputsFor(reportOf([]), { order: byTitle('Why AI steering committees stall') }));
  assert.equal(decision.decision, 'write');
  assert.equal(decision.entries[0].topic.slug, 'why-ai-steering-committees-stall');
});

test('a prompt the report already measured can be ordered, and its entry keeps the measured numbers', () => {
  const proven = provenPrompt(5, 'how to budget for an AI pilot');
  const decision = selectTopic(inputsFor(reportOf([proven, PILOTS]), { order: byPrompt(5) }));
  assert.equal(decision.decision, 'write');
  assert.deepEqual(decision.entries[0].demand, { impressions: 3, position: 40 });
  assert.equal(decision.entries[0].row, proven.cells);
});

const OCCUPIED = [
  [
    'a route the generated layer lists',
    { generated: [{ family: 'article', route: '/blog/board-memo-ai-strategy-one-page', title: 'Other' }] },
  ],
  ['a slug an unexpired claim holds', { claims: [claimed(BOARD_TOPIC.slug, 'Another title entirely')] }],
  ['a title an unexpired claim holds', { claims: [claimed('older', 'Board memo: AI strategy, one page')] }],
  ['a slug a ledger holds', { ledgerPaths: [recordPath('ledger', BOARD_TOPIC.slug, EARLIER_RUN_AT)] }],
  ['a subject an article already covers', { posts: [published('board-memo', 'A one page AI strategy board memo')] }],
  ['a prompt the core retired', { promptSources: sourcesOf({ 30: { retired: true } }) }],
  [
    'a prompt whose core entry already lists an article',
    { promptSources: sourcesOf({ 30: { routes: ['/blog/other'] } }) },
  ],
];

for (const [label, extra] of OCCUPIED) {
  test(`an order for ${label} is refused and nothing else is chosen, though the ladder would write another topic`, () => {
    const control = select(null, extra);
    assert.equal(control.decision, 'write', 'the scene must offer a topic to fall back to');
    const fallback = control.entries[0].topic;
    assert.notEqual(fallback.slug, BOARD_TOPIC.slug);
    const refused = select(byPrompt(30), extra);
    assert.equal(refused.decision, 'none');
    assert.equal(refused.choice, null);
    assert.deepEqual(refused.entries, []);
    assert.equal(refused.strengthen, null);
    assert.deepEqual(refused.advisories, []);
    assert.deepEqual(refused.concepts, { named: [] });
    assert.deepEqual(refused.proposals, []);
    assert.equal(refused.fallback, null);
    assert.equal(wantsProposal(refused), false);
    assert.match(refused.reason, /^The order for prompt 30 was refused \(/);
    assert.equal(refused.trail.length, 1);
    assert.equal(refused.trail[0].arm, 'ordered');
    const everything = JSON.stringify(refused);
    for (const other of [fallback.slug, fallback.title, 'Why do AI pilots', 'ai policy', 'model card']) {
      assert.equal(everything.includes(other), false, other);
    }
  });
}

test('an order for a number the report does not hold ends in none, naming the number and how many prompts the report holds', () => {
  const refused = select(byPrompt(31));
  assert.equal(refused.decision, 'none');
  assert.equal(
    refused.reason,
    'The order for prompt 31 was refused (no-such-prompt), so nothing was written and no other topic was tried: ' +
      'the report holds no prompt numbered 31; it holds 3 prompts'
  );
});

test('an order for a prompt that names a register concept is refused with the concept and its route, and so is the same words as a title', () => {
  for (const order of [byPrompt(11), byTitle('how to put evals for AI agents into CI')]) {
    const refused = select(order);
    assert.equal(refused.decision, 'none', order.kind);
    assert.deepEqual(refused.entries, [], order.kind);
    assert.match(refused.reason, /was refused \(register-owner\)/, order.kind);
    assert.match(
      refused.reason,
      /names the concept "Evals", which the concept register of docs\/SEMANTIC-CORE\.md assigns to \/glossary\/evals$/
    );
  }
});

test('a refused order by title is refused for the same causes and never falls back', () => {
  const owned = select(byTitle('How to put evals into CI'));
  const definition = select(byTitle('what is a model card'));
  const long = select(byTitle(`how to ${'a'.repeat(120)}`));
  for (const [refused, outcome] of [
    [owned, 'register-owner'],
    [definition, 'format-mismatch'],
    [long, 'title-too-long'],
  ]) {
    assert.equal(refused.decision, 'none', outcome);
    assert.deepEqual(refused.entries, [], outcome);
    assert.equal(refused.fallback, null, outcome);
    assert.match(refused.reason, new RegExp(`^The order for "[^"]+" was refused \\(${outcome}\\)`));
  }
});

test('a refused order records its ledger refusal in the decision and nothing else', () => {
  const refused = select(byPrompt(11));
  assert.deepEqual(
    refused.refusals.map(({ reason, against }) => [reason, against]),
    [['register-owner', '/glossary/evals']]
  );
});

test('every decision an order can end in has the keys every other decision has', () => {
  const keys = Object.keys(select(null)).sort();
  for (const decision of [
    select(byPrompt(30)),
    select(byPrompt(31)),
    select(byTitle('Why AI steering committees stall')),
  ]) {
    assert.deepEqual(Object.keys(decision).sort(), keys);
  }
});

test('an order outranks every other signal, so a weak query, a measured query and a category rotation change nothing', () => {
  const quiet = select(byPrompt(30), { rotation: [] });
  const busy = select(byPrompt(30));
  assert.deepEqual(busy, quiet);
  const refusedQuiet = select(byPrompt(31), { rotation: [] });
  assert.deepEqual(select(byPrompt(31)), refusedQuiet);
});

test('the picker refuses inputs whose order is missing or is not an order, so a missing wire is loud on every pick', () => {
  const broken = [
    undefined,
    {},
    3,
    'prompt',
    { kind: 'prompt' },
    { kind: 'prompt', number: '3' },
    { kind: 'prompt', number: 0 },
    { kind: 'prompt', number: -4 },
    { kind: 'prompt', number: 2.5 },
    { kind: 'title' },
    { kind: 'title', text: '' },
    { kind: 'title', text: '   ' },
    { kind: 'title', text: 7 },
    { kind: 'sentence', text: 'x' },
  ];
  for (const order of broken) {
    const inputs = inputsFor(reportOf([PILOTS]));
    inputs.order = order;
    assert.throws(
      () => selectTopic(inputs),
      (error) => error instanceof TypeError && error.message.includes('inputs.order'),
      JSON.stringify(order)
    );
  }
  const unwired = inputsFor(reportOf([PILOTS]));
  delete unwired.order;
  assert.throws(() => selectTopic(unwired), /inputs\.order/);
});

test('selecting twice from the same inputs gives the same decision and leaves the inputs as they were', () => {
  for (const order of [byPrompt(30), byPrompt(31), byTitle('Why AI steering committees stall')]) {
    const inputs = inputsFor(LADDER, { order, rotation: [GOVERNANCE, AGENTIC] });
    const before = structuredClone(inputs);
    const first = selectTopic(inputs);
    assert.deepEqual(selectTopic(inputs), first);
    assert.deepEqual(inputs, before);
  }
});
