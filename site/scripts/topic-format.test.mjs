import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertTopicInvariants } from './fixtures/topic-invariants.mjs';
import { cueOf, topicFrom } from './topic-format.mjs';

const TERMS = [
  ['what is an AI register', 'AI register', 'What is an AI register?', 'ai-register', 'ai register'],
  ['what are guardrails', 'guardrails', 'What are guardrails?', 'guardrails', 'guardrails'],
  ["what's shadow AI", 'shadow AI', 'What is shadow AI?', 'shadow-ai', 'shadow ai'],
  [
    'what does human-in-the-loop mean',
    'human-in-the-loop',
    'What is human-in-the-loop?',
    'human-in-the-loop',
    'human-in-the-loop',
  ],
  ['what does a guardrail mean', 'guardrail', 'What is a guardrail?', 'guardrail', 'guardrail'],
  ['What’s the EU AI Act?', 'EU AI Act', 'What is the EU AI Act?', 'eu-ai-act', 'eu ai act'],
  ['  What   is   an   AI   register.  ', 'AI register', 'What is an AI register?', 'ai-register', 'ai register'],
  ['WHAT IS AN AI REGISTER', 'AI REGISTER', 'What is an AI REGISTER?', 'ai-register', 'ai register'],
  ['what is THE AI Act', 'AI Act', 'What is the AI Act?', 'ai-act', 'ai act'],
  ['what is ISO 42001', 'ISO 42001', 'What is ISO 42001?', 'iso-42001', 'iso 42001'],
  [
    'what is a Zürich Café ledger',
    'Zürich Café ledger',
    'What is a Zürich Café ledger?',
    'zurich-cafe-ledger',
    'zürich café ledger',
  ],
  [
    'what is alpha beta gamma delta epsilon zeta',
    'alpha beta gamma delta epsilon zeta',
    'What is alpha beta gamma delta epsilon zeta?',
    'alpha-beta-gamma-delta-epsilon-zeta',
    'alpha beta gamma delta epsilon zeta',
  ],
  ['what is "shadow AI"', 'shadow AI', 'What is shadow AI?', 'shadow-ai', 'shadow ai'],
];

for (const [text, subject, title, slug, query] of TERMS) {
  test('term: ' + text, () => {
    assert.equal(cueOf(text), 'definition');
    const topic = topicFrom(text);
    assert.deepEqual(topic, { format: 'term', subject, title, slug, query });
    assertTopicInvariants(topic);
  });
}

test('the verb follows the subject: a subject that ends in a single s takes are, unless the article is a or an', () => {
  const titles = [
    ['what is guardrails', 'What are guardrails?'],
    ['what are the guardrails', 'What are the guardrails?'],
    ["what's LLMs", 'What are LLMs?'],
    ['what does evals mean', 'What are evals?'],
    ['what is the AI Act', 'What is the AI Act?'],
    ['what are AI', 'What is AI?'],
    ['what is a process', 'What is a process?'],
    ['what is a bias', 'What is a bias?'],
    ['what is an alias', 'What is an alias?'],
    ['what is access', 'What is access?'],
    ['what are AI compliance process', 'What is AI compliance process?'],
    ['what is business processes', 'What are business processes?'],
  ];
  for (const [text, title] of titles) assert.equal(topicFrom(text).title, title, text);
});

test('what is guardrails and what are guardrails name one concept: the same title, slug and query', () => {
  assert.deepEqual(topicFrom('what is guardrails'), topicFrom('what are guardrails'));
});

const NOT_DEFINITIONS = [
  ['what is the purpose of a risk register', 'What is the purpose of a risk register?'],
  ['what is a data protection impact assessment for AI', 'What is a data protection impact assessment for AI?'],
  ['what are the best AI tools', 'What are the best AI tools?'],
  ['what is pricing', 'What is pricing?'],
  ['what are steps', 'What are steps?'],
  ['what is a thing and another thing', 'What is a thing and another thing?'],
  ['what is alpha beta gamma delta epsilon zeta eta', 'What is alpha beta gamma delta epsilon zeta eta?'],
  ['what does the difference mean', 'What does the difference mean?'],
  ['what does an AI register in a company mean', 'What does an AI register in a company mean?'],
  ['what is the', 'What is the?'],
  ['what is', 'What is?'],
];

for (const [text, title] of NOT_DEFINITIONS) {
  test('a subject the rules refuse is no definition and falls to a question article: ' + text, () => {
    assert.equal(cueOf(text), 'question');
    const topic = topicFrom(text);
    assert.equal(topic.format, 'article');
    assert.equal(topic.subject, null);
    assert.equal(topic.title, title);
  });
}

test('a long question that was refused as a subject is still refused as a title', () => {
  const text = 'what is the difference between a model card and a datasheet';
  assert.equal(cueOf(text), 'question');
  assert.deepEqual(topicFrom(text), { format: null, reason: 'title-too-long' });
});

test('every stop token and blocked first word refuses a definition', () => {
  const stops = 'of between vs versus for in to with on at from by per and or'.split(' ');
  for (const stop of stops) assert.equal(cueOf('what is alpha ' + stop + ' beta'), 'question', stop);
  const heads = (
    'difference differences best worst cheapest cost price pricing reason purpose point role impact ' +
    'benefit benefits example examples step steps rule rules requirement requirements obligation obligations ' +
    'deadline deadlines'
  ).split(' ');
  for (const head of heads) assert.equal(cueOf('what are ' + head + ' alpha'), 'question', head);
});

test('a hyphenated word is one token even when it holds a stop token', () => {
  assert.equal(topicFrom('what is human-in-the-loop').subject, 'human-in-the-loop');
  assert.equal(topicFrom('what is end-to-end').format, 'term');
});

test('cueOf names a definition, a procedure, a question or nothing', () => {
  const cases = [
    ['what is an AI register', 'definition'],
    ["what's shadow AI", 'definition'],
    ['what does a guardrail mean', 'definition'],
    ['how to put evals into CI', 'procedure'],
    ['how to', 'procedure'],
    ['steps to roll out an AI policy', 'procedure'],
    ['step by step AI policy rollout', 'procedure'],
    ['ways to cut LLM cost', 'procedure'],
    ['how to hand over AI leadership?', 'procedure'],
    ['how do we hand over AI leadership', 'question'],
    ['why do AI pilots fail', 'question'],
    ['AI register required?', 'question'],
    ['fractional CAIO pricing', null],
    ['', null],
    ['   ', null],
    ['...', null],
    ['?', null],
  ];
  for (const [text, cue] of cases) assert.equal(cueOf(text), cue, JSON.stringify(text));
});

test('every interrogative first word is a question cue', () => {
  const words = (
    'who whom whose why when where which what how do does did is are was were can could should ' +
    'would will shall may might'
  ).split(' ');
  for (const word of words) assert.equal(cueOf(word + ' alpha beta'), 'question', word);
});

test('a cue that is only the start of a longer word is no cue', () => {
  const texts = [
    'issue tracker for AI',
    'whoever owns AI',
    'dominant model',
    'cancel policy',
    'willing vendors',
    'steps toward an AI policy',
    'ways tomorrow',
  ];
  for (const text of texts) assert.equal(cueOf(text), null, text);
  assert.equal(cueOf('how tomorrow works'), 'question');
});
