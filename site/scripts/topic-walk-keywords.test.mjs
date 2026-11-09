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
  keywordRow,
  keywordsOf,
  prompt,
  published,
  reportOf,
} from './fixtures/topic-inputs.mjs';
import { recordPath } from './record-layout.mjs';
import { walkKeywords, walkPosts } from './topic-walk.mjs';

const FRAMEWORK = keywordRow('ai governance framework', 803, 1051);
const EXAMPLES = keywordRow('prompt injection examples', 303);
const CHECKLIST = keywordRow('evals checklist', 120);
const POLICY = keywordRow('ai governance policy', 32);

const walk = (rows, extra = {}) => walkKeywords(inputsFor(reportOf([]), { keywords: keywordsOf(rows), ...extra }));
const steps = ({ trail }) => trail.map(({ query, outcome }) => [query, outcome]);

test('the first keyword candidate that passes every check is chosen, and the step names the title it would take', () => {
  const result = walk([FRAMEWORK]);
  assert.deepEqual(result.chosen.candidate, {
    arm: 'keyword',
    phrase: 'ai governance framework',
    exact: 803,
    broad: 1051,
    measured: '2026-11-09',
  });
  assert.deepEqual(result.chosen.topic, {
    format: 'article',
    subject: null,
    title: 'AI governance framework',
    slug: 'ai-governance-framework',
    query: 'ai governance framework',
  });
  assert.deepEqual(result.trail, [
    { arm: 'keyword', query: 'ai governance framework', outcome: 'chosen', detail: 'AI governance framework' },
  ]);
  assert.deepEqual(result.refusals, []);
  assert.deepEqual(result.advisories, []);
});

test('candidates are walked most exact impressions first and the walk stops at the first survivor', () => {
  const result = walk([EXAMPLES, FRAMEWORK]);
  assert.equal(result.chosen.candidate.phrase, 'ai governance framework');
  assert.deepEqual(steps(result), [['ai governance framework', 'chosen']]);
});

test('a report with no candidate chooses nothing and leaves no step', () => {
  assert.deepEqual(walk([]), { chosen: null, trail: [], refusals: [], advisories: [] });
});

test('a candidate that names a concept the register owns is no new page: it is recorded, offered as an advisory naming the owning route, and the walk goes on', () => {
  const result = walk([CHECKLIST, POLICY]);
  const detail =
    'the query "evals checklist" names the concept "Evals", which the concept register of docs/SEMANTIC-CORE.md assigns to /glossary/evals';
  assert.deepEqual(steps(result), [
    ['evals checklist', 'register-owner'],
    ['ai governance policy', 'chosen'],
  ]);
  assert.equal(result.chosen.candidate.phrase, 'ai governance policy');
  assert.deepEqual(result.refusals, [
    { title: 'Evals checklist', reason: 'register-owner', against: '/glossary/evals', detail },
  ]);
  assert.deepEqual(result.advisories, [
    {
      source: 'register-owner',
      route: '/glossary/evals',
      query: 'evals checklist',
      number: null,
      impressions: 120,
      position: null,
      reason: `${detail}; the phrase has 120 exact impressions on Bing, measured 2026-11-09: strengthen that route and add no page`,
      choice:
        'Choice: keyword, "evals checklist", 120 exact impressions on Bing, measured 2026-11-09; strengthens /glossary/evals',
    },
  ]);
  assert.equal(result.trail[0].arm, 'keyword');
  assert.equal(result.trail[0].detail, detail);
});

test('a keyword advisory has the keys of the advisory the posts arm offers for the same refusal, never a second shape', () => {
  const evals = prompt(11, 'how to put evals for AI agents into CI');
  const [fromPost] = walkPosts(inputsFor(reportOf([evals]))).advisories;
  const [fromKeyword] = walk([CHECKLIST]).advisories;
  assert.deepEqual(Object.keys(fromKeyword).sort(), Object.keys(fromPost).sort());
  assert.equal(fromKeyword.source, fromPost.source);
  assert.equal(fromKeyword.route, fromPost.route);
});

const HELD = {
  'route-exists': () => ({
    generated: [...GENERATED, { family: 'article', route: '/blog/ai-governance-framework', title: `Other${SUFFIX}` }],
  }),
  'title-collision': () => ({ claims: [claimed('older', 'AI GOVERNANCE framework!')] }),
  'slug-held': () => ({ claims: [claimed('ai-governance-framework', 'Another title entirely')] }),
  'same-subject': () => ({ posts: [published('framework-for-a-bank', 'AI governance framework for a small bank')] }),
};

for (const [reason, held] of Object.entries(HELD)) {
  test(`a candidate held by ${reason} is a step and a ledger refusal, never an advisory, and the walk goes on`, () => {
    const result = walk([FRAMEWORK, EXAMPLES], held());
    assert.deepEqual(steps(result), [
      ['ai governance framework', reason],
      ['prompt injection examples', 'chosen'],
    ]);
    assert.deepEqual(
      result.refusals.map((refusal) => refusal.reason),
      [reason]
    );
    assert.deepEqual(result.advisories, []);
    assert.equal(result.chosen.candidate.phrase, 'prompt injection examples');
  });
}

test('a slug a ledger already holds is refused, naming the ledger', () => {
  const ledgerPath = recordPath('ledger', 'ai-governance-framework', EARLIER_RUN_AT);
  const result = walk([FRAMEWORK], { ledgerPaths: [ledgerPath] });
  assert.deepEqual(steps(result), [['ai governance framework', 'slug-held']]);
  assert.equal(result.refusals[0].against, ledgerPath);
});

test('a claim that lapsed holds nothing', () => {
  const lapsed = claimed('ai-governance-framework', 'Another title entirely', { expiresAt: LAPSED_AT });
  assert.deepEqual(steps(walk([FRAMEWORK], { claims: [lapsed] })), [['ai governance framework', 'chosen']]);
});

test('a phrase that asks for a definition, one whose title would not fit and one that makes no slug leave a step and no ledger refusal', () => {
  const definition = keywordRow('what is a model card', 90);
  const long = keywordRow(`how to ${'a'.repeat(120)}`, 80);
  const blank = keywordRow('日本語は何ですか?', 70);
  const result = walk([definition, long, blank]);
  assert.deepEqual(
    result.trail.map(({ arm, outcome }) => [arm, outcome]),
    [
      ['keyword', 'format-mismatch'],
      ['keyword', 'title-too-long'],
      ['keyword', 'no-slug'],
    ]
  );
  assert.ok(result.trail.every(({ detail }) => typeof detail === 'string' && detail.length > 0));
  assert.deepEqual(result.refusals, []);
  assert.deepEqual(result.advisories, []);
  assert.equal(result.chosen, null);
});

test('when every candidate is refused nothing is chosen, each has a step, each ledger refusal is kept and each register-owned one is an advisory', () => {
  const posts = [published('framework-for-a-bank', 'AI governance framework for a small bank')];
  const result = walk([FRAMEWORK, CHECKLIST], { posts });
  assert.equal(result.chosen, null);
  assert.deepEqual(steps(result), [
    ['ai governance framework', 'same-subject'],
    ['evals checklist', 'register-owner'],
  ]);
  assert.deepEqual(
    result.refusals.map(({ reason }) => reason),
    ['same-subject', 'register-owner']
  );
  assert.deepEqual(
    result.advisories.map(({ query }) => query),
    ['evals checklist']
  );
});

test('walking twice from the same inputs gives the same result and leaves the inputs as they were', () => {
  const inputs = inputsFor(reportOf([]), { keywords: keywordsOf([CHECKLIST, FRAMEWORK, EXAMPLES]) });
  const before = structuredClone(inputs);
  const first = walkKeywords(inputs);
  assert.deepEqual(walkKeywords(inputs), first);
  assert.deepEqual(inputs, before);
});
