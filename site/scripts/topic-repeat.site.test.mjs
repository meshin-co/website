import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { CATEGORIES } from './entry-limits.mjs';
import { NOW } from './fixtures/topic-inputs.mjs';
import { readPublishedPosts } from './topic-categories.mjs';
import { topicFrom } from './topic-format.mjs';
import { REPEAT_THRESHOLD, containment, existingArticles, repeatRefusal, subjectStems } from './topic-repeat.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');

const CALIBRATED_ON = [
  'adoption-telemetry-measuring-if-ai-is-actually-used',
  'ai-acceptable-use-policy-for-a-50-person-company',
  'ai-readiness-assessment-template-for-smb',
  'evals-in-ci-for-llm-agents',
  'handing-over-ai-leadership-to-an-internal-owner',
  'how-to-build-an-ai-system-register-in-a-week',
  'how-to-choose-an-ai-operating-model-for-a-mid-size-company',
  'multi-agent-reference-architecture-in-production',
  'named-person-responsible-for-ai-risk-in-vendor-procurement',
  'why-your-ai-pilot-never-reached-production',
];

const PILOT = 'why-your-ai-pilot-never-reached-production';
const ADOPTION = 'adoption-telemetry-measuring-if-ai-is-actually-used';
const ACCEPTABLE_USE = 'ai-acceptable-use-policy-for-a-50-person-company';
const READINESS = 'ai-readiness-assessment-template-for-smb';
const EVALS = 'evals-in-ci-for-llm-agents';
const HANDOVER = 'handing-over-ai-leadership-to-an-internal-owner';
const REGISTER = 'how-to-build-an-ai-system-register-in-a-week';
const OPERATING_MODEL = 'how-to-choose-an-ai-operating-model-for-a-mid-size-company';
const MULTI_AGENT = 'multi-agent-reference-architecture-in-production';
const VENDOR_RISK = 'named-person-responsible-for-ai-risk-in-vendor-procurement';

const REWORDINGS = [
  [PILOT, 'Why do AI pilots fail to reach production?', '0.80'],
  [PILOT, 'AI pilots that never make it to production', '0.80'],
  [ADOPTION, 'How to measure adoption of AI tools with telemetry', '0.80'],
  [ACCEPTABLE_USE, 'What belongs in an acceptable use policy for AI?', '1.00'],
  [ACCEPTABLE_USE, 'AI acceptable use policy: what to include', '0.80'],
  [ACCEPTABLE_USE, 'An acceptable use policy for AI in a 50-person company', '0.67'],
  [READINESS, 'An AI readiness scorecard template for small businesses', '0.60'],
  [EVALS, 'How to run LLM agent evals in your CI pipeline', '0.67'],
  [EVALS, 'Scoring an LLM agent in CI without golden answers', '0.86'],
  [HANDOVER, 'Transferring AI leadership to an in-house owner', '0.60'],
  [HANDOVER, 'How do you hand over AI leadership to an internal owner?', '1.00'],
  [REGISTER, 'A one-week plan for an AI systems register', '0.80'],
  [REGISTER, 'Building an AI system register within a week', '1.00'],
  [OPERATING_MODEL, 'Choosing an AI operating model for a mid-sized business', '0.86'],
  [MULTI_AGENT, 'Reference architecture for production multi-agent systems', '1.00'],
  [VENDOR_RISK, 'Who is responsible for AI risk when buying from vendors?', '0.80'],
  [VENDOR_RISK, 'Naming an owner for AI risk in vendor procurement', '0.83'],
];

const FRESH_TOPICS = [
  ['How to run a tabletop exercise for an AI incident', '0.20'],
  ['What should an AI steering committee decide each quarter?', '0.20'],
  ['How to write a data retention rule for AI chat logs', '0.20'],
  ['Handling prompt injection in a customer support agent', '0.20'],
  ['Training managers to review AI-assisted work', '0.20'],
  ['How to brief a board on AI risk in ten minutes', '0.33'],
  ['Measuring the cost per task of an LLM agent', '0.33'],
  ['How to set a token budget for an agent in production', '0.40'],
  ['How to choose between buying and building an AI assistant', '0.40'],
  ['How to retire an AI system that nobody owns', '0.40'],
];

const OVER_REFUSED = [
  ['How to price an AI agent pilot for a mid-size company', OPERATING_MODEL, '0.57'],
  ['AI vendor due diligence questionnaire for procurement', VENDOR_RISK, '0.50'],
];

const published = readPublishedPosts(ROOT);
const calibration = published.filter(({ slug }) => CALIBRATED_ON.includes(slug));
const existing = existingArticles({ posts: calibration, claims: [], now: NOW });
const postOf = (slug) => calibration.find((post) => post.slug === slug);
const ratioOf = (text, post) => containment(subjectStems(topicFrom(text)), subjectStems(post));
const refusalOf = (text) => repeatRefusal({ topic: topicFrom(text), existing });

const pairs = calibration.flatMap((first, at) =>
  calibration.slice(at + 1).map((second) => ({
    first,
    second,
    ratio: containment(subjectStems(first), subjectStems(second)),
  }))
);
const strongest = Math.max(...pairs.map(({ ratio }) => ratio));

test('the ten articles the guard was calibrated on are all still published, each with a title and a category', () => {
  assert.deepEqual(
    CALIBRATED_ON.filter((slug) => postOf(slug) === undefined),
    []
  );
  assert.equal(calibration.length, 10);
  for (const { title, category } of calibration) {
    assert.ok(title.length > 0);
    assert.ok(CATEGORIES.includes(category), category);
  }
});

test(`two of the ten calibration articles overlap by at most 0.20, a margin of 0.30 under the threshold of ${REPEAT_THRESHOLD}`, () => {
  assert.equal(pairs.length, 45);
  assert.equal(strongest.toFixed(2), '0.20');
  assert.ok(REPEAT_THRESHOLD - strongest >= 0.25);
});

test('no calibration article is refused as a repeat of the nine others', () => {
  for (const post of calibration) {
    const others = existing.filter(({ against }) => against !== post.route);
    assert.equal(repeatRefusal({ topic: post, existing: others }), null, post.slug);
  }
});

test('every category of the site has at least one reworded article in the table below, and the table has 17 rows', () => {
  const categories = new Set(REWORDINGS.map(([slug]) => postOf(slug).category));
  assert.deepEqual([...categories].sort(), [...CATEGORIES].sort());
  assert.equal(REWORDINGS.length, 17);
});

test('every wording in the tables is a topic the picker could meet: an article title that fits a page title', () => {
  const wordings = [
    ...REWORDINGS.map(([, wording]) => wording),
    ...FRESH_TOPICS.map(([wording]) => wording),
    ...OVER_REFUSED.map(([wording]) => wording),
  ];
  for (const wording of wordings) assert.equal(topicFrom(wording).format, 'article', wording);
});

for (const [slug, wording, expected] of REWORDINGS) {
  test(`the rewording "${wording}" of the ${postOf(slug)?.category} article ${slug} reaches ${expected} and is refused`, () => {
    const ratio = ratioOf(wording, postOf(slug));
    assert.equal(ratio.toFixed(2), expected);
    assert.ok(ratio >= REPEAT_THRESHOLD);
    const found = refusalOf(wording);
    assert.equal(found.reason, 'same-subject');
    assert.equal(found.against, postOf(slug).route);
    assert.ok(found.detail.includes(`a containment of ${expected} against the threshold of ${REPEAT_THRESHOLD}`));
  });
}

test(`the weakest rewording reaches 0.60, so the table sits ${(0.6 - REPEAT_THRESHOLD).toFixed(2)} above the threshold of ${REPEAT_THRESHOLD}`, () => {
  const weakest = Math.min(...REWORDINGS.map(([slug, wording]) => ratioOf(wording, postOf(slug))));
  assert.equal(weakest.toFixed(2), '0.60');
});

for (const [wording, expected] of FRESH_TOPICS) {
  test(`the new topic "${wording}" reaches at most ${expected} of any calibration article and passes`, () => {
    const strongestOverlap = Math.max(...calibration.map((post) => ratioOf(wording, post)));
    assert.equal(strongestOverlap.toFixed(2), expected);
    assert.equal(refusalOf(wording), null);
  });
}

for (const [wording, slug, expected] of OVER_REFUSED) {
  test(`the guard's other limit: the new topic "${wording}" shares generic words with ${slug}, reaches ${expected} and is refused`, () => {
    assert.equal(ratioOf(wording, postOf(slug)).toFixed(2), expected);
    assert.equal(refusalOf(wording).against, postOf(slug).route);
  });
}

test("the guard's honest limit: a paraphrase that shares no topical stem with the pilot article reaches 0.00 and passes", () => {
  const paraphrase = 'Why do ML proofs of concept stall before launch?';
  assert.equal(ratioOf(paraphrase, postOf(PILOT)).toFixed(2), '0.00');
  assert.equal(refusalOf(paraphrase), null);
});

test("the guard's honest limit: a paraphrase in other vocabulary reaches only 0.33 of the adoption article and passes", () => {
  const paraphrase = 'How can we tell if staff really use our AI tools?';
  assert.equal(ratioOf(paraphrase, postOf(ADOPTION)).toFixed(2), '0.33');
  assert.equal(refusalOf(paraphrase), null);
});

test('the reader gives each of the ten calibration articles a calendar day, and the evals article the target query of the content facts', () => {
  for (const { slug, publishDate } of calibration) assert.match(publishDate, /^\d{4}-\d{2}-\d{2}$/, slug);
  assert.equal(postOf(EVALS).query, 'evals in ci without a golden answer');
  assert.ok(published.length >= 10);
});
