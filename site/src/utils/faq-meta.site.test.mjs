import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';
import { z } from 'astro/zod';

import { isNotBeforePublish } from './content-rules.mjs';
import { splitSentences } from '../../scripts/prose-rules.mjs';
import { faqDescription, teaser } from './faq-meta.mjs';

const wordCount = (sentence) => sentence.split(/\s+/).filter(Boolean).length;

const faqDir = join(import.meta.dirname, '..', 'data', 'faq');
const files = (await readdir(faqDir)).filter((name) => name.endsWith('.md')).sort();
const frontmatterOf = (raw) => yaml.load(raw.replace(/^---\n([\s\S]*?)\n---/, '$1'));
const entries = await Promise.all(
  files.map(async (name) => ({ name, data: frontmatterOf(await readFile(join(faqDir, name), 'utf8')) }))
);

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
