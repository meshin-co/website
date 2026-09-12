import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';
import { z } from 'astro/zod';

import { isNotBeforePublish } from './content-rules.mjs';
import { splitSentences } from '../../scripts/prose-rules.mjs';
import { faqMetadata, firstSentence, teaser } from './faq-meta.mjs';

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

test('faq leaf metadata carries article dates and leaves og images to the static default', () => {
  const metadata = faqMetadata({
    question: 'How do you charge for the work?',
    answer: 'Three fixed structures, no hourly billing. The rest follows.',
    publishDate: new Date('2026-09-12T00:00:00Z'),
    updatedDate: new Date('2026-09-12T00:00:00Z'),
  });

  assert.equal(metadata.title, 'How do you charge for the work?');
  assert.equal(metadata.description, 'Three fixed structures, no hourly billing.');
  assert.equal(metadata.openGraph.type, 'article');
  assert.equal(metadata.openGraph.article.publishedTime, '2026-09-12T00:00:00.000Z');
  assert.equal(metadata.openGraph.article.modifiedTime, '2026-09-12T00:00:00.000Z');
  assert.equal(metadata.openGraph.images, undefined);
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

import { pageTitle } from './faq-meta.mjs';

test('a long question is truncated so the full title stays inside seventy characters', () => {
  const question = 'What do NIST AI RMF, ISO/IEC 42001 and the EU AI Act each require of a company our size?';
  const title = pageTitle(question);

  assert.ok((title + ' — meshin.co').length <= 70);
  assert.ok(title.endsWith('…'));
  assert.equal(pageTitle('How does the retainer end?'), 'How does the retainer end?');
});
