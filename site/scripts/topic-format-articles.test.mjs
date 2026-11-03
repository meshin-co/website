import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TITLE_ROOM_CHARS } from '../src/utils/faq-meta.mjs';
import { assertTopicInvariants } from './fixtures/topic-invariants.mjs';
import { cueOf, topicFrom } from './topic-format.mjs';

const TOO_LONG = { format: null, reason: 'title-too-long' };

function assertArticle(text, { title, slug, query }) {
  const topic = topicFrom(text);
  if (title.length > TITLE_ROOM_CHARS) {
    assert.deepEqual(topic, TOO_LONG);
    return;
  }
  assert.deepEqual(topic, { format: 'article', subject: null, title, slug, query });
  assertTopicInvariants(topic);
}

const QUESTIONS = [
  [
    'why do AI pilots fail to reach production',
    'Why do AI pilots fail to reach production?',
    'why-do-ai-pilots-fail-to-reach-production',
    'why do ai pilots fail to reach production',
  ],
  [
    'what does a chief AI officer do in a 50 person company',
    'What does a chief AI officer do in a 50 person company?',
    'what-does-a-chief-ai-officer-do-in-a-50-person-company',
    'what does a chief ai officer do in a 50 person company',
  ],
  [
    'is an AI register required',
    'Is an AI register required?',
    'is-an-ai-register-required',
    'is an ai register required',
  ],
  [
    'Can we use customer data in prompts',
    'Can we use customer data in prompts?',
    'can-we-use-customer-data-in-prompts',
    'can we use customer data in prompts',
  ],
  ['AI register required?', 'AI register required?', 'ai-register-required', 'ai register required'],
  ['why do AI pilots fail??', 'Why do AI pilots fail?', 'why-do-ai-pilots-fail', 'why do ai pilots fail'],
  ['how do AI pilots fail', 'How do AI pilots fail?', 'how-do-ai-pilots-fail', 'how do ai pilots fail'],
  [
    'how do we hand over AI leadership',
    'How do we hand over AI leadership?',
    'how-do-we-hand-over-ai-leadership',
    'how do we hand over ai leadership',
  ],
  [
    'how can I score AI readiness',
    'How can I score AI readiness?',
    'how-can-i-score-ai-readiness',
    'how can i score ai readiness',
  ],
  [
    'how should you review AI vendors',
    'How should you review AI vendors?',
    'how-should-you-review-ai-vendors',
    'how should you review ai vendors',
  ],
  [
    'how would one audit an AI agent',
    'How would one audit an AI agent?',
    'how-would-one-audit-an-ai-agent',
    'how would one audit an ai agent',
  ],
  ['how could we test prompts', 'How could we test prompts?', 'how-could-we-test-prompts', 'how could we test prompts'],
  ['how much does a CAIO cost', 'How much does a CAIO cost?', 'how-much-does-a-caio-cost', 'how much does a caio cost'],
  [
    'Will the AI Act apply to us',
    'Will the AI Act apply to us?',
    'will-the-ai-act-apply-to-us',
    'will the ai act apply to us',
  ],
];

for (const [text, title, slug, query] of QUESTIONS) {
  test('question article, titled with a question mark: ' + text, () => {
    assert.equal(cueOf(text), 'question');
    assertArticle(text, { title, slug, query });
  });
}

const PROCEDURES = [
  [
    'how to put evals for AI agents into CI',
    'How to put evals for AI agents into CI',
    'how-to-put-evals-for-ai-agents-into-ci',
    'how to put evals for ai agents into ci',
  ],
  [
    'steps to roll out an AI policy',
    'Steps to roll out an AI policy',
    'steps-to-roll-out-an-ai-policy',
    'steps to roll out an ai policy',
  ],
  [
    'step by step AI policy rollout',
    'Step by step AI policy rollout',
    'step-by-step-ai-policy-rollout',
    'step by step ai policy rollout',
  ],
  ['ways to cut LLM cost', 'Ways to cut LLM cost', 'ways-to-cut-llm-cost', 'ways to cut llm cost'],
  [
    'how to hand over AI leadership?',
    'How to hand over AI leadership',
    'how-to-hand-over-ai-leadership',
    'how to hand over ai leadership',
  ],
];

for (const [text, title, slug, query] of PROCEDURES) {
  test('procedure article, titled without a question mark: ' + text, () => {
    assert.equal(cueOf(text), 'procedure');
    assertArticle(text, { title, slug, query });
  });
}

const NOUN_PHRASES = [
  [
    'AI acceptable use policy template',
    'AI acceptable use policy template',
    'ai-acceptable-use-policy-template',
    'ai acceptable use policy template',
  ],
  ['fractional CAIO pricing', 'Fractional CAIO pricing', 'fractional-caio-pricing', 'fractional caio pricing'],
  [
    'MCP security best practices',
    'MCP security best practices',
    'mcp-security-best-practices',
    'mcp security best practices',
  ],
  [
    'build vs buy AI 3-year TCO',
    'Build vs buy AI 3-year TCO',
    'build-vs-buy-ai-3-year-tco',
    'build vs buy ai 3-year tco',
  ],
  [
    'EU AI Act obligations for deployers small business',
    'EU AI Act obligations for deployers small business',
    'eu-ai-act-obligations-for-deployers-small-business',
    'eu ai act obligations for deployers small business',
  ],
  ['guardrails', 'Guardrails', 'guardrails', 'guardrails'],
];

for (const [text, title, slug, query] of NOUN_PHRASES) {
  test('a wording with no cue is still an article that keeps its words: ' + text, () => {
    assert.equal(cueOf(text), null);
    assertArticle(text, { title, slug, query });
  });
}

test('a title one character over the room is refused and at the room it is kept, for every shape of title', () => {
  const room = TITLE_ROOM_CHARS;
  const fits = [
    'why ' + 'a'.repeat(room - 5),
    'how to ' + 'a'.repeat(room - 7),
    'a'.repeat(room),
    'what is ' + 'a'.repeat(room - 9),
  ];
  for (const text of fits) {
    assert.equal(topicFrom(text).title.length, room, text);
    assert.deepEqual(topicFrom(text + 'a'), { format: null, reason: 'title-too-long' }, text);
  }
});

test('text with no latin letter or digit has no slug', () => {
  assert.deepEqual(topicFrom('日本語は何ですか?'), { format: null, reason: 'no-slug' });
  assert.deepEqual(topicFrom('what is 日本語'), { format: null, reason: 'no-slug' });
  for (const text of ['?', '', '   ', '...', '""']) {
    assert.deepEqual(topicFrom(text), { format: null, reason: 'no-slug' }, JSON.stringify(text));
  }
});

test('double quotes, straight or curly, are removed before anything else is read', () => {
  assert.deepEqual(topicFrom('"fractional chief ai officer" remote'), {
    format: 'article',
    subject: null,
    title: 'Fractional chief ai officer remote',
    slug: 'fractional-chief-ai-officer-remote',
    query: 'fractional chief ai officer remote',
  });
  assert.equal(cueOf('“what is a model card”'), 'definition');
  assert.equal(topicFrom('“what is a model card”').title, 'What is a model card?');
  assert.equal(topicFrom('why "do" AI pilots fail').title, 'Why do AI pilots fail?');
});

test('a curly apostrophe is straightened and a straight one is kept', () => {
  const topic = topicFrom('why isn’t our AI register used');
  assert.equal(topic.title, "Why isn't our AI register used?");
  assert.equal(topic.slug, 'why-isn-t-our-ai-register-used');
});

test('accents are folded and digits are kept in slugs', () => {
  const topic = topicFrom('why do Café Zürich pilots fail in 2026');
  assert.equal(topic.slug, 'why-do-cafe-zurich-pilots-fail-in-2026');
  assertTopicInvariants(topic);
});
