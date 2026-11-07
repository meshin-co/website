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
  prompt,
  provenPrompt,
  published,
  reportOf,
  sourcesOf,
} from './fixtures/topic-inputs.mjs';
import { recordPath } from './record-layout.mjs';
import { walkOrdered } from './topic-walk.mjs';

const TEXT = 'why do AI pilots fail to reach production';
const TITLE = 'Why do AI pilots fail to reach production?';
const SLUG = 'why-do-ai-pilots-fail-to-reach-production';
const PILOTS = prompt(9, TEXT);
const EVALS = prompt(11, 'how to put evals for AI agents into CI');
const BOARD = prompt(30, 'board memo AI strategy one page');

const byPrompt = (number) => ({ kind: 'prompt', number });
const byTitle = (text) => ({ kind: 'title', text });
const walk = (order, prompts, extra = {}) => walkOrdered(inputsFor(reportOf(prompts), { order, ...extra }));
const outcomes = ({ trail }) => trail.map(({ outcome }) => outcome);

const TOPIC = {
  format: 'article',
  subject: null,
  title: TITLE,
  slug: SLUG,
  query: 'why do ai pilots fail to reach production',
};

test('an order by prompt number takes the row with that number and puts its text through the occupancy check', () => {
  const result = walk(byPrompt(9), [PILOTS]);
  assert.deepEqual(result.chosen, {
    candidate: {
      arm: 'ordered',
      order: byPrompt(9),
      number: 9,
      prompt: TEXT,
      impressions: 0,
      position: null,
      row: PILOTS.cells,
    },
    topic: TOPIC,
  });
  assert.deepEqual(result.trail, [{ arm: 'ordered', number: 9, outcome: 'chosen', detail: TITLE }]);
  assert.deepEqual(result.refusals, []);
});

test('the row is found by its number and not by its place, and no other row is examined', () => {
  const result = walk(byPrompt(9), [BOARD, EVALS, PILOTS]);
  assert.equal(result.chosen.candidate.number, 9);
  assert.equal(result.chosen.topic.slug, SLUG);
  assert.equal(result.trail.length, 1);
  assert.equal(walk(byPrompt(1), [prompt(10, 'a'), prompt(1, 'how to write a board memo')]).chosen.candidate.number, 1);
});

test('a prompt the report already measured can be ordered, and its candidate carries the measured numbers', () => {
  const proven = provenPrompt(5, 'how to budget for an AI pilot');
  const { candidate } = walk(byPrompt(5), [proven]).chosen;
  assert.deepEqual([candidate.impressions, candidate.position, candidate.row], [3, 40, proven.cells]);
});

test('an order for a number the report does not hold is refused naming the number and how many prompts it holds', () => {
  const result = walk(byPrompt(31), [PILOTS, BOARD]);
  assert.equal(result.chosen, null);
  assert.deepEqual(result.trail, [
    {
      arm: 'ordered',
      number: 31,
      outcome: 'no-such-prompt',
      detail: 'the report holds no prompt numbered 31; it holds 2 prompts',
    },
  ]);
  assert.deepEqual(result.refusals, []);
  assert.equal(walk(byPrompt(1), []).trail[0].detail, 'the report holds no prompt numbered 1; it holds 0 prompts');
});

test('an order for a retired prompt is refused before its text is examined, with no ledger refusal', () => {
  const result = walk(byPrompt(9), [PILOTS], { promptSources: sourcesOf({ 9: { retired: true } }) });
  assert.equal(result.chosen, null);
  assert.deepEqual(result.trail, [
    {
      arm: 'ordered',
      number: 9,
      outcome: 'retired',
      detail: 'prompt 9 is retired in docs/SEMANTIC-CORE.md, so no article is written for it',
    },
  ]);
  assert.deepEqual(result.refusals, []);
});

test('an order for a prompt whose core entry already lists an article route is refused as served, like the post arm', () => {
  const served = walk(byPrompt(9), [PILOTS], { promptSources: sourcesOf({ 9: { routes: ['/blog/some-article'] } }) });
  assert.deepEqual(outcomes(served), ['family-served']);
  assert.equal(served.refusals[0].against, '/blog/some-article');
  const elsewhere = walk(byPrompt(9), [PILOTS], {
    promptSources: sourcesOf({ 9: { routes: ['/services/retainer'] } }),
  });
  assert.deepEqual(outcomes(elsewhere), ['chosen']);
});

test('an order for a prompt that names a register concept is refused for the ledger, and so is the same words as a title', () => {
  for (const order of [byPrompt(11), byTitle('how to put evals for AI agents into CI')]) {
    const result = walk(order, [EVALS]);
    assert.equal(result.chosen, null);
    assert.deepEqual(outcomes(result), ['register-owner']);
    assert.deepEqual(result.refusals, [
      {
        title: 'How to put evals for AI agents into CI',
        reason: 'register-owner',
        against: '/glossary/evals',
        detail:
          'the query "how to put evals for ai agents into ci" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals',
      },
    ]);
    assert.equal(result.trail[0].detail, result.refusals[0].detail);
  }
});

const OCCUPIED = [
  [
    'a route the generated layer lists',
    { generated: [...GENERATED, { family: 'article', route: `/blog/${SLUG}`, title: `Other${SUFFIX}` }] },
    'route-exists',
  ],
  [
    'a title the generated layer holds',
    {
      generated: [
        ...GENERATED,
        { family: 'article', route: '/blog/older-url', title: `${TITLE.toUpperCase()}${SUFFIX}` },
      ],
    },
    'title-collision',
  ],
  [
    'a title an unexpired claim holds',
    { claims: [claimed('older', 'WHY do AI pilots fail to reach production!')] },
    'title-collision',
  ],
  ['a slug an unexpired claim holds', { claims: [claimed(SLUG, 'Another title entirely')] }, 'slug-held'],
  ['a slug a ledger holds', { ledgerPaths: [recordPath('ledger', SLUG, EARLIER_RUN_AT)] }, 'slug-held'],
  [
    'an article published on the same subject',
    { posts: [published('pilot-failure', 'Why AI pilots fail before production')] },
    'same-subject',
  ],
  [
    'an article claim in flight on the same subject',
    {
      claims: [claimed('pilot-claim', 'AI pilots that fail before production', { query: 'ai pilots fail production' })],
    },
    'same-subject',
  ],
];

for (const [label, extra, outcome] of OCCUPIED) {
  test(`an order is refused as ${outcome} for ${label}, by prompt number and by title alike`, () => {
    for (const order of [byPrompt(9), byTitle(TEXT)]) {
      const result = walk(order, [PILOTS], extra);
      assert.equal(result.chosen, null, order.kind);
      assert.deepEqual(outcomes(result), [outcome], order.kind);
      assert.equal(result.refusals.length, 1, order.kind);
      assert.equal(result.refusals[0].reason, outcome, order.kind);
      assert.equal(result.refusals[0].title, TITLE, order.kind);
    }
  });
}

test('a lapsed claim holds neither a slug nor a title, so the order it once blocked is chosen', () => {
  const lapsed = claimed(SLUG, TITLE, { expiresAt: LAPSED_AT });
  for (const order of [byPrompt(9), byTitle(TEXT)])
    assert.deepEqual(outcomes(walk(order, [PILOTS], { claims: [lapsed] })), ['chosen']);
});

test('an order by title is handed to the check as typed, with the casing and the question mark the picker gives every title', () => {
  const result = walk(byTitle('Why AI steering committees stall'), []);
  assert.deepEqual(result.chosen, {
    candidate: { arm: 'ordered', order: byTitle('Why AI steering committees stall') },
    topic: {
      format: 'article',
      subject: null,
      title: 'Why AI steering committees stall?',
      slug: 'why-ai-steering-committees-stall',
      query: 'why ai steering committees stall',
    },
  });
  assert.deepEqual(result.trail, [
    {
      arm: 'ordered',
      query: 'Why AI steering committees stall',
      outcome: 'chosen',
      detail: 'Why AI steering committees stall?',
    },
  ]);
  assert.equal(
    walk(byTitle('why ai steering committees stall'), []).chosen.topic.title,
    'Why AI steering committees stall?'
  );
});

test('an order by title needs no row in the report, and the report is never searched for it', () => {
  const result = walk(byTitle('Why AI steering committees stall'), [PILOTS, BOARD]);
  assert.equal(result.chosen.candidate.number, undefined);
  assert.equal(result.trail.length, 1);
});

test('a definition, a title with no room and a title with no slug are refused with their cause and no ledger refusal', () => {
  const orders = [
    [
      byTitle('what is a model card'),
      'format-mismatch',
      /asks for the definition of "model card", which is a glossary entry, not an article/,
    ],
    [
      byTitle(`how to ${'a'.repeat(120)}`),
      'title-too-long',
      /would make a title longer than a page title has room for/,
    ],
    [byTitle('日本語は何ですか?'), 'no-slug', /has no letter or digit a slug could be made from/],
  ];
  for (const [order, outcome, cause] of orders) {
    const result = walk(order, []);
    assert.equal(result.chosen, null, outcome);
    assert.deepEqual(outcomes(result), [outcome]);
    assert.match(result.trail[0].detail, cause);
    assert.deepEqual(result.refusals, [], outcome);
  }
  const prompted = walk(byPrompt(3), [prompt(3, 'what is a model card')]);
  assert.deepEqual(outcomes(prompted), ['format-mismatch']);
});

test('walking twice from the same inputs gives the same result and leaves the inputs as they were', () => {
  const inputs = inputsFor(reportOf([PILOTS, EVALS]), { order: byPrompt(9), posts: [published('p', 'A policy post')] });
  const before = structuredClone(inputs);
  const first = walkOrdered(inputs);
  assert.deepEqual(walkOrdered(inputs), first);
  assert.deepEqual(inputs, before);
});
