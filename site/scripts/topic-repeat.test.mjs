import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LAPSED_AT, NOW, claimed, published } from './fixtures/topic-inputs.mjs';
import { FUNCTION_WORDS } from './search-demand-rows.mjs';
import {
  REPEAT_THRESHOLD,
  containment,
  existingArticles,
  repeatRefusal,
  stemsOf,
  subjectStems,
} from './topic-repeat.mjs';

const sorted = (stems) => [...stems].sort();
const stemOf = (word) => sorted(stemsOf(word)).join(' ');
const setOf = (...stems) => new Set(stems);
const topicOf = (title, query = title) => ({ title, query });
const existingOf = (title, query = null, against = `/blog/${title.toLowerCase().replaceAll(' ', '-')}`) => ({
  against,
  title,
  query,
});

test('the threshold is half of the smaller subject', () => {
  assert.equal(REPEAT_THRESHOLD, 0.5);
});

test('a text becomes the set of its stems: lower case, no accents, cut at anything that is not a letter or a digit', () => {
  assert.deepEqual(sorted(stemsOf('Évals, AGÉNTIC: 50-AI!')), ['50', 'agentic', 'ai', 'eval']);
  assert.deepEqual(sorted(stemsOf('')), []);
  assert.deepEqual(sorted(stemsOf('?!-')), []);
});

test('every function word of the demand matcher, and your, you and into, leave no stem', () => {
  for (const word of [...FUNCTION_WORDS, 'your', 'you', 'into']) assert.equal(stemsOf(word).size, 0, word);
  assert.deepEqual(sorted(stemsOf('How do you put the evals into your pipeline')), ['eval', 'pipelin', 'put']);
});

test('a lone letter left by an apostrophe is no stem, so a possessive reads as its noun', () => {
  assert.deepEqual(sorted(stemsOf("the vendor's risks")), ['risk', 'vendor']);
  assert.deepEqual(sorted(stemsOf('what’s shadow AI')), ['ai', 'shadow']);
});

const FORMS_OF_ONE_WORD = [
  ['agent', 'agents'],
  ['policy', 'policies'],
  ['company', 'companies'],
  ['study', 'studies', 'studied', 'studying'],
  ['process', 'processes', 'processing', 'processed'],
  ['access', 'accesses', 'accessed', 'accessing'],
  ['business', 'businesses'],
  ['focus', 'focuses'],
  ['box', 'boxes'],
  ['reach', 'reaches', 'reached', 'reaching'],
  ['change', 'changes', 'changed', 'changing'],
  ['template', 'templates'],
  ['service', 'services'],
  ['role', 'roles'],
  ['rule', 'rules'],
  ['size', 'sizes', 'sized', 'sizing'],
  ['measure', 'measures', 'measured', 'measuring'],
  ['approve', 'approves', 'approved', 'approving'],
  ['architecture', 'architectures'],
  ['pipeline', 'pipelines'],
  ['hand', 'hands', 'handed', 'handing'],
  ['monitor', 'monitors', 'monitored', 'monitoring'],
  ['model', 'models', 'modeling'],
];

for (const forms of FORMS_OF_ONE_WORD) {
  test(`${forms.join(', ')} are one stem`, () => {
    assert.equal(new Set(forms.map(stemOf)).size, 1, forms.map(stemOf).join(' | '));
  });
}

test('a word of four letters or fewer is never cut, and a cut never leaves fewer than three letters', () => {
  for (const word of ['uses', 'bias', 'ring', 'sets', 'using', 'being', 'doing']) assert.equal(stemOf(word), word);
  assert.equal(stemOf('fixed'), 'fix');
});

test('a plural that ends in ss or us keeps its ending, because the singular ends the same way', () => {
  for (const word of ['readiness', 'status', 'process']) assert.equal(stemOf(word), word);
});

test('words that only look alike stay apart', () => {
  assert.notEqual(stemOf('agent'), stemOf('agentic'));
  assert.notEqual(stemOf('assess'), stemOf('assessment'));
  assert.notEqual(stemOf('register'), stemOf('registry'));
});

test('containment divides by the smaller set, so a short query inside a long title is a full match', () => {
  assert.equal(containment(setOf('a1', 'b2'), setOf('a1', 'b2', 'c3', 'd4')), 1);
  assert.equal(containment(setOf('a1', 'b2', 'c3', 'd4'), setOf('a1', 'b2')), 1);
  assert.equal(containment(setOf('a1', 'b2', 'c3'), setOf('a1', 'x9', 'y8', 'z7')), 1 / 3);
  assert.equal(containment(setOf('a1'), setOf('b2')), 0);
});

test('an empty set overlaps nothing, whatever it is set against', () => {
  assert.equal(containment(setOf(), setOf('a1')), 0);
  assert.equal(containment(setOf('a1'), setOf()), 0);
  assert.equal(containment(setOf(), setOf()), 0);
});

test('the subject of an entry is the stems of its title joined with the stems of its query', () => {
  assert.deepEqual(sorted(subjectStems({ title: 'Alpha bravo', query: 'delta' })), ['alpha', 'bravo', 'delta']);
  assert.deepEqual(sorted(subjectStems({ title: 'Alpha bravo', query: null })), ['alpha', 'bravo']);
  assert.deepEqual(sorted(subjectStems({ title: 'Alpha bravo' })), ['alpha', 'bravo']);
});

test('a topic that shares half of the smaller subject is the same subject, and a third of it is not', () => {
  const sharedHalf = [existingOf('Alpha charlie')];
  assert.equal(repeatRefusal({ topic: topicOf('Alpha bravo'), existing: sharedHalf }).reason, 'same-subject');
  const sharedThird = [existingOf('Alpha charlie echo')];
  assert.equal(repeatRefusal({ topic: topicOf('Alpha bravo delta'), existing: sharedThird }), null);
});

test('a refusal names the article it repeats and says which stems and what ratio decided it', () => {
  const existing = [existingOf('Alpha charlie', null, '/blog/alpha-charlie')];
  const found = repeatRefusal({ topic: topicOf('Alpha bravo'), existing });
  assert.deepEqual(Object.keys(found).sort(), ['against', 'detail', 'reason']);
  assert.equal(found.reason, 'same-subject');
  assert.equal(found.against, '/blog/alpha-charlie');
  assert.equal(
    found.detail,
    'the topic "Alpha bravo" repeats /blog/alpha-charlie ("Alpha charlie"): its subject shares alpha, 1 of the 2 stems of the smaller one, a containment of 0.50 against the threshold of 0.5'
  );
});

test('the strongest overlap is named, and a tie goes to the article listed first', () => {
  const weak = existingOf('Alpha charlie', null, '/blog/weak');
  const strong = existingOf('Alpha bravo', null, '/blog/strong');
  const same = existingOf('Bravo alpha', null, '/blog/same');
  assert.equal(repeatRefusal({ topic: topicOf('Alpha bravo'), existing: [weak, strong] }).against, '/blog/strong');
  assert.equal(repeatRefusal({ topic: topicOf('Alpha bravo'), existing: [strong, same] }).against, '/blog/strong');
  assert.equal(repeatRefusal({ topic: topicOf('Alpha bravo'), existing: [same, strong] }).against, '/blog/same');
});

test('the target query of an article counts beside its title', () => {
  const topic = topicOf('Bravo delta');
  assert.equal(repeatRefusal({ topic, existing: [existingOf('Alpha one', null)] }), null);
  assert.equal(repeatRefusal({ topic, existing: [existingOf('Alpha one', 'bravo delta')] }).reason, 'same-subject');
});

test('the query of the topic counts beside its title, so a longer query can be the match', () => {
  const existing = [existingOf('Bravo delta')];
  assert.equal(repeatRefusal({ topic: { title: 'Alpha one', query: 'bravo delta' }, existing }).reason, 'same-subject');
});

test('nothing to compare with, or nothing in the subject, is never a repeat', () => {
  assert.equal(repeatRefusal({ topic: topicOf('Alpha bravo'), existing: [] }), null);
  assert.equal(repeatRefusal({ topic: topicOf('How to'), existing: [existingOf('How to')] }), null);
  assert.equal(repeatRefusal({ topic: topicOf('Alpha bravo'), existing: [existingOf('The of')] }), null);
});

test("the guard's honest limit: a paraphrase that shares no topical stem passes, so the register and the model are the other layers", () => {
  const existing = [
    existingOf(
      'Why your AI pilot never reached production',
      'ai pilot never reached production',
      '/blog/why-your-ai-pilot-never-reached-production'
    ),
  ];
  const paraphrase = topicOf('What stops a machine learning proof of concept from shipping to customers?');
  assert.equal(containment(subjectStems(paraphrase), subjectStems(existing[0])), 0);
  assert.equal(repeatRefusal({ topic: paraphrase, existing }), null);
});

test('the articles that exist are the published posts by route, then the holding article claims by claim file', () => {
  const posts = [
    published('first-post', 'First post', { query: 'first query' }),
    published('second-post', 'Second post'),
  ];
  const open = claimed('open-claim', 'Open claim', { query: 'open query' });
  const written = claimed('written-claim', 'Written claim', { status: 'written', expiresAt: LAPSED_AT });
  const lapsed = claimed('lapsed-claim', 'Lapsed claim', { expiresAt: LAPSED_AT });
  const glossary = claimed('a-term', 'What is a term?', { format: 'term' });
  assert.deepEqual(existingArticles({ posts, claims: [open, written, lapsed, glossary], now: NOW }), [
    { against: '/blog/first-post', title: 'First post', query: 'first query' },
    { against: '/blog/second-post', title: 'Second post', query: null },
    { against: open.path, title: 'Open claim', query: 'open query' },
    { against: written.path, title: 'Written claim', query: 'q' },
  ]);
});

test('no post and no claim leave no article to repeat', () => {
  assert.deepEqual(existingArticles({ posts: [], claims: [], now: NOW }), []);
});
