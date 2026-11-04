import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from './entry-limits.mjs';
import { LAPSED_AT, NOW, categoryClaimed, claimed, published } from './fixtures/topic-inputs.mjs';
import { categoryStandings, rotationOrder } from './topic-categories.mjs';

const [GOVERNANCE, AGENTIC, OPERATING, EXECUTIVE] = CATEGORIES;

const post = (slug, category, publishDate = '2026-10-01') =>
  published(slug, `Title of ${slug}`, { category, publishDate });
const order = (extra) => rotationOrder({ rotation: CATEGORIES, posts: [], claims: [], now: NOW, ...extra });

test('with no rotation there is no order, whatever the corpus holds', () => {
  assert.deepEqual(order({ rotation: [], posts: [post('a', GOVERNANCE)] }), []);
});

test('a rotation of one category is that category, whatever it holds', () => {
  assert.deepEqual(order({ rotation: [EXECUTIVE] }), [EXECUTIVE]);
  assert.deepEqual(order({ rotation: [EXECUTIVE], posts: [post('a', EXECUTIVE), post('b', EXECUTIVE)] }), [EXECUTIVE]);
});

test('with nothing written the order is the configured order', () => {
  assert.deepEqual(order(), [GOVERNANCE, AGENTIC, OPERATING, EXECUTIVE]);
  assert.deepEqual(order({ rotation: [EXECUTIVE, OPERATING] }), [EXECUTIVE, OPERATING]);
});

test('the category with the fewest articles comes first, and a category with no entry comes before every other', () => {
  const posts = [
    post('g1', GOVERNANCE),
    post('g2', GOVERNANCE),
    post('a1', AGENTIC),
    post('a2', AGENTIC),
    post('a3', AGENTIC),
    post('e1', EXECUTIVE),
  ];
  assert.deepEqual(order({ posts }), [OPERATING, EXECUTIVE, GOVERNANCE, AGENTIC]);
});

test('two categories with as many articles go by the oldest newest article, and a category with no date is the oldest', () => {
  const posts = [
    post('g1', GOVERNANCE, '2026-10-20'),
    post('a1', AGENTIC, '2026-09-01'),
    post('o1', OPERATING, '2026-10-05'),
    post('e1', EXECUTIVE, null),
  ];
  assert.deepEqual(order({ posts }), [EXECUTIVE, AGENTIC, OPERATING, GOVERNANCE]);
});

test('the newest article of a category is its newest day, not its first', () => {
  const posts = [
    post('g1', GOVERNANCE, '2026-09-01'),
    post('g2', GOVERNANCE, '2026-10-30'),
    post('a1', AGENTIC, '2026-10-01'),
    post('a2', AGENTIC, '2026-10-02'),
  ];
  assert.deepEqual(order({ rotation: [GOVERNANCE, AGENTIC], posts }), [AGENTIC, GOVERNANCE]);
  assert.deepEqual(order({ rotation: [AGENTIC, GOVERNANCE], posts }), [AGENTIC, GOVERNANCE]);
});

test('categories with as many articles and the same newest day keep the configured order, whichever it is', () => {
  const posts = CATEGORIES.map((category) => post(`p-${category}`, category, '2026-10-01'));
  assert.deepEqual(order({ posts }), [...CATEGORIES]);
  assert.deepEqual(order({ posts, rotation: [...CATEGORIES].reverse() }), [...CATEGORIES].reverse());
});

test('deleting an article changes the order by itself, and so does adding one', () => {
  const posts = [post('g1', GOVERNANCE), post('g2', GOVERNANCE), post('a1', AGENTIC), post('o1', OPERATING)];
  const rotation = [GOVERNANCE, AGENTIC, OPERATING];
  assert.deepEqual(order({ rotation, posts }), [AGENTIC, OPERATING, GOVERNANCE]);
  assert.deepEqual(order({ rotation, posts: posts.filter(({ slug }) => slug !== 'g1') }), [
    GOVERNANCE,
    AGENTIC,
    OPERATING,
  ]);
  assert.deepEqual(order({ rotation, posts: [...posts, post('a2', AGENTIC)] }), [OPERATING, GOVERNANCE, AGENTIC]);
});

test('a claim in flight moves its category down, so two runs close together do not pick the same category', () => {
  const rotation = [GOVERNANCE, AGENTIC];
  assert.deepEqual(order({ rotation }), [GOVERNANCE, AGENTIC]);
  const inFlight = categoryClaimed('first-run', 'First run', GOVERNANCE);
  assert.deepEqual(order({ rotation, claims: [inFlight] }), [AGENTIC, GOVERNANCE]);
});

test('a claim that has lapsed counts for nothing, and a written claim counts even after it would have lapsed', () => {
  const rotation = [GOVERNANCE, AGENTIC];
  const lapsed = categoryClaimed('lapsed', 'Lapsed', GOVERNANCE, { expiresAt: LAPSED_AT });
  assert.deepEqual(order({ rotation, claims: [lapsed] }), [GOVERNANCE, AGENTIC]);
  const written = categoryClaimed('written', 'Written', GOVERNANCE, { status: 'written', expiresAt: LAPSED_AT });
  assert.deepEqual(order({ rotation, claims: [written] }), [AGENTIC, GOVERNANCE]);
});

test('a claim that is not from a category counts for nothing, because it has no category to count for', () => {
  const rotation = [GOVERNANCE, AGENTIC];
  const demand = claimed('from-prompt', 'From prompt', { category: GOVERNANCE });
  const explicit = claimed('from-prompt-2', 'From prompt two', { origin: 'demand', category: GOVERNANCE });
  const weak = claimed('from-weak', 'From weak', { origin: 'weak-demand' });
  assert.deepEqual(order({ rotation, claims: [demand, explicit, weak] }), [GOVERNANCE, AGENTIC]);
});

test('the day of a claim is the day it was made, so an older article in another category goes first on a tie', () => {
  const rotation = [GOVERNANCE, AGENTIC];
  const posts = [post('a1', AGENTIC, '2026-10-01')];
  const claims = [categoryClaimed('g1', 'G one', GOVERNANCE)];
  assert.deepEqual(categoryStandings({ rotation, posts, claims, now: NOW }), [
    { category: GOVERNANCE, articles: 1, newest: '2026-11-01' },
    { category: AGENTIC, articles: 1, newest: '2026-10-01' },
  ]);
  assert.deepEqual(order({ rotation, posts, claims }), [AGENTIC, GOVERNANCE]);
});

test('an article that is a post and a claim at once counts once, with the category and the day of the post', () => {
  const standings = categoryStandings({
    rotation: [GOVERNANCE, AGENTIC],
    posts: [post('same', AGENTIC, '2026-10-01')],
    claims: [categoryClaimed('same', 'Same', GOVERNANCE, { status: 'written' })],
    now: NOW,
  });
  assert.deepEqual(standings, [
    { category: GOVERNANCE, articles: 0, newest: null },
    { category: AGENTIC, articles: 1, newest: '2026-10-01' },
  ]);
});

test('categories outside the rotation are not counted and do not appear in the order', () => {
  const posts = [post('e1', EXECUTIVE), post('e2', EXECUTIVE), post('x1', null)];
  const claims = [categoryClaimed('e3', 'E three', EXECUTIVE)];
  assert.deepEqual(order({ rotation: [GOVERNANCE, AGENTIC], posts, claims }), [GOVERNANCE, AGENTIC]);
});

test('the standings list every configured category in the configured order, with its count and its newest day', () => {
  const posts = [
    post('g1', GOVERNANCE, '2026-09-01'),
    post('g2', GOVERNANCE, '2026-10-30'),
    post('o1', OPERATING, '2026-10-01'),
  ];
  const rotation = [OPERATING, GOVERNANCE, EXECUTIVE];
  assert.deepEqual(categoryStandings({ rotation, posts, claims: [], now: NOW }), [
    { category: OPERATING, articles: 1, newest: '2026-10-01' },
    { category: GOVERNANCE, articles: 2, newest: '2026-10-30' },
    { category: EXECUTIVE, articles: 0, newest: null },
  ]);
});

test('ordering twice gives the same order and leaves the inputs as they were', () => {
  const inputs = {
    rotation: [...CATEGORIES],
    posts: [post('g1', GOVERNANCE), post('a1', AGENTIC, '2026-09-01')],
    claims: [categoryClaimed('o1', 'O one', OPERATING)],
    now: NOW,
  };
  const before = structuredClone(inputs);
  const first = rotationOrder(inputs);
  assert.deepEqual(rotationOrder(inputs), first);
  assert.deepEqual(inputs, before);
});
