import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';
import { z } from 'astro/zod';

import { isNotBeforePublish } from './content-rules.mjs';
import { splitSentences } from '../../scripts/prose-rules.mjs';
import { clauseTrim, faqDescription, faqMetadata, firstSentence, pageTitle, teaser } from './faq-meta.mjs';

const wordCount = (sentence) => sentence.split(/\s+/).filter(Boolean).length;

const faqDir = join(import.meta.dirname, '..', 'data', 'faq');
const files = (await readdir(faqDir)).filter((name) => name.endsWith('.md')).sort();
const frontmatterOf = (raw) => yaml.load(raw.replace(/^---\n([\s\S]*?)\n---/, '$1'));
const entries = await Promise.all(
  files.map(async (name) => ({ name, data: frontmatterOf(await readFile(join(faqDir, name), 'utf8')) }))
);

test('the first sentence stops at the first terminator', () => {
  assert.equal(firstSentence('One. Two. Three.'), 'One.');
  assert.equal(firstSentence('Is it live? Yes.'), 'Is it live?');
  assert.equal(firstSentence('Ship it! Then rest.'), 'Ship it!');
  assert.equal(firstSentence('No terminator at all'), 'No terminator at all');
});

test('a short first sentence is the teaser, verbatim', () => {
  assert.equal(
    teaser('Three fixed structures, no hourly billing. The rest follows.'),
    'Three fixed structures, no hourly billing.'
  );
});

test('a first sentence of twelve or more words is cut below the duplicate-sentence floor', () => {
  const answer =
    'A memo your board can act on: a readiness score across strategy, data, delivery, people and governance, plus the five fixes. The rest follows.';
  const result = teaser(answer);

  assert.ok(result.length <= 140, `teaser is ${result.length} chars`);
  assert.ok(result.endsWith('.'));
  for (const sentence of splitSentences(result)) {
    assert.ok(wordCount(sentence) < 12, `"${sentence}" reaches the 12-word duplicate floor`);
  }
  assert.ok(answer.startsWith(result.slice(0, -1)), 'teaser stays a prefix of the answer');
});

test('a long first sentence is truncated at a word boundary within 140 characters', () => {
  const answer =
    'Companies of thirty to three hundred people, usually with at least one engineer, who have run AI pilots that quietly stalled somewhere between demo and production. The rest follows.';
  const result = teaser(answer);

  assert.ok(result.length <= 140, `teaser is ${result.length} chars`);
  assert.ok(result.endsWith('.'));
  assert.ok(answer.startsWith(result.slice(0, -1)), 'teaser stays a prefix of the answer');
});

test('every published answer yields a teaser that clears the duplicate-sentence floor', () => {
  assert.ok(entries.length >= 25, `expected at least 25 FAQ entries, found ${entries.length}`);
  for (const { name, data } of entries) {
    const result = teaser(data.answer);
    assert.ok(result.length > 0, `${name}: teaser is empty`);
    assert.ok(result.length <= 140, `${name}: teaser is ${result.length} chars`);
    for (const sentence of splitSentences(result)) {
      assert.ok(wordCount(sentence) < 12, `${name}: "${sentence}" reaches the 12-word duplicate floor`);
    }
  }
});

test('faq leaf metadata carries article dates and computes the description from question and answer', () => {
  const question = 'How do you charge for the work?';
  const answer = 'Three fixed structures, no hourly billing. The rest follows.';
  const metadata = faqMetadata({
    question,
    answer,
    publishDate: new Date('2026-09-12T00:00:00Z'),
    updatedDate: new Date('2026-09-12T00:00:00Z'),
  });

  assert.equal(metadata.title, question);
  assert.equal(metadata.description, faqDescription(question, answer));
  assert.equal(metadata.openGraph.type, 'article');
  assert.equal(metadata.openGraph.article.publishedTime, '2026-09-12T00:00:00.000Z');
  assert.equal(metadata.openGraph.article.modifiedTime, '2026-09-12T00:00:00.000Z');
  assert.equal(metadata.openGraph.images, undefined);
});

test('faqMetadata prefers an explicit description and shortTitle over the computed defaults', () => {
  const metadata = faqMetadata({
    question: 'What do NIST AI RMF, ISO/IEC 42001 and the EU AI Act each require of a company our size?',
    shortTitle: 'What do NIST, ISO/IEC 42001 and the EU AI Act require?',
    answer: 'None of the three sets a headcount threshold.',
    description:
      'A hand-authored description that overrides the mechanical default entirely, kept between the required floor and ceiling.',
    publishDate: new Date('2026-09-12T00:00:00Z'),
    updatedDate: new Date('2026-09-12T00:00:00Z'),
  });

  assert.equal(metadata.title, 'What do NIST, ISO/IEC 42001 and the EU AI Act require?');
  assert.equal(
    metadata.description,
    'A hand-authored description that overrides the mechanical default entirely, kept between the required floor and ceiling.'
  );
});

const datedFaqEntry = z
  .object({
    question: z.string(),
    answer: z.string(),
    publishDate: z.date(),
    updatedDate: z.date(),
  })
  .refine((entry) => isNotBeforePublish(entry.publishDate, entry.updatedDate), {
    message: 'updatedDate must not be before publishDate',
    path: ['updatedDate'],
  });

test('every FAQ entry ships with both dates in order', () => {
  for (const { name, data } of entries) {
    const parsed = datedFaqEntry.safeParse(data);
    assert.ok(parsed.success, `${name}: ${parsed.error?.issues.map((issue) => issue.message).join(', ')}`);
  }
});

test('an FAQ entry missing updatedDate fails the schema parse', () => {
  const specimen = structuredClone(entries[0].data);
  delete specimen.updatedDate;

  const parsed = datedFaqEntry.safeParse(specimen);
  assert.equal(parsed.success, false);
  assert.deepEqual(
    parsed.error.issues.map((issue) => issue.path[0]),
    ['updatedDate']
  );
});

test('a short question is returned verbatim as the title', () => {
  assert.equal(pageTitle('How does the retainer end?'), 'How does the retainer end?');
});

test('an over-budget question with a shortTitle uses the shortTitle for the title', () => {
  const question = 'What do NIST AI RMF, ISO/IEC 42001 and the EU AI Act each require of a company our size?';
  const shortTitle = 'What do NIST, ISO/IEC 42001 and the EU AI Act require?';

  const title = pageTitle(question, shortTitle);

  assert.equal(title, shortTitle);
  assert.ok((title + ' — meshin.co').length <= 70);
});

test('an over-budget question without a shortTitle falls back to a clause boundary, never an ellipsis', () => {
  const question = 'What do NIST AI RMF, ISO/IEC 42001 and the EU AI Act each require of a company our size?';

  const title = pageTitle(question);

  assert.ok(!title.includes('…'));
  assert.ok(question.startsWith(title.replace(/[.!?]$/, '')));
});

test('clauseTrim never leaves a trailing coordinating conjunction', () => {
  const trimmed = clauseTrim('Ships fast, and cheap, and broken, and nobody notices until it matters.', 24);

  assert.ok(!/\b(and|or|but)\.?$/i.test(trimmed));
  assert.ok(!trimmed.includes('…'));
});

test('faqDescription returns an already-well-sized first sentence verbatim', () => {
  const description = faqDescription(
    'Does this matter?',
    'Evals catch a regression before it reaches production, and the rollback path is exercised in the very same pipeline run.'
  );

  assert.equal(
    description,
    'Evals catch a regression before it reaches production, and the rollback path is exercised in the very same pipeline run.'
  );
});

test('faqDescription pads a short first sentence with the question and more of the answer', () => {
  const description = faqDescription(
    'How do you charge for the work?',
    'Three fixed structures, no hourly billing. The Assessment is a fixed fee for the two-week engagement, quoted once before we start.'
  );

  assert.ok(description.startsWith('How do you charge for the work?'));
  assert.ok(description.length >= 120 && description.length <= 160);
});

test('faqDescription clause-trims an over-ceiling first sentence without an ellipsis', () => {
  const description = faqDescription(
    'Why?',
    'Evals in continuous integration run as a mandatory gate on every change, block the merge outright the instant measured quality falls under the agreed floor, and require a named engineer to sign off before any override is granted.'
  );

  assert.ok(!description.includes('…'));
  assert.ok(description.length >= 120 && description.length <= 160);
});

test('every FAQ entry resolves a description within the 120-160 character floor and ceiling', () => {
  for (const { name, data } of entries) {
    const description = data.description ?? faqDescription(data.question, data.answer);
    assert.ok(
      description.length >= 120 && description.length <= 160,
      `${name}: description is ${description.length} characters`
    );
    assert.ok(!description.includes('…'), `${name}: description contains an ellipsis`);
  }
});
