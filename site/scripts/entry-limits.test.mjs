import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CATEGORIES, COUNT_LIMITS, META_DESCRIPTION_MAX_CHARS, WORD_LIMITS } from './entry-limits.mjs';
import { blockBetween, declarationAt } from './prompt-extract.mjs';

const CONFIG_PATH = 'site/src/content.config.ts';
const GATE_PATH = 'docs/CONTENT-GATE.md';
const config = readFileSync(new URL('../src/content.config.ts', import.meta.url), 'utf8');
const gateDoc = readFileSync(new URL('../../docs/CONTENT-GATE.md', import.meta.url), 'utf8');

const numbers = (match, label) => {
  assert.ok(match, `content.config.ts no longer holds ${label}`);
  return match.slice(1).map(Number);
};

function limitsOf(source) {
  const helpers = blockBetween(source, CONFIG_PATH, 'const CATEGORIES', 'const postCollection = defineCollection(');
  const post = declarationAt(source, CONFIG_PATH, 'const postCollection = defineCollection(');
  const glossary = declarationAt(source, CONFIG_PATH, 'const glossaryCollection = defineCollection(');
  const listed = /const CATEGORIES = \[([^\]]*)\] as const;/.exec(helpers);
  return {
    categories: [...(listed?.[1] ?? '').matchAll(/'([^']+)'/g)].map(([, name]) => name),
    description: numbers(/description: z\.string\(\)\.max\((\d+)\)/.exec(helpers), 'the description cap')[0],
    shortAnswer: numbers(
      /const shortAnswer = \(\) => \{\s*const rule = wordRange\((\d+), (\d+)\);/.exec(helpers),
      'the shortAnswer range'
    ),
    fullAnswer: numbers(
      /const fullAnswer = \(\) => \{\s*const rule = wordRange\((\d+), (\d+)\);/.exec(helpers),
      'the fullAnswer range'
    ),
    keyTakeaways: numbers(
      /keyTakeaways: z\.array\(z\.string\(\)\)\.min\((\d+)\)\.max\((\d+)\)/.exec(post),
      'the keyTakeaways count'
    ),
    postFaqMax: numbers(
      /faq: z\s*\.array\(z\.object\(\{ q: z\.string\(\), a: z\.string\(\) \}\)\)\s*\.max\((\d+)\)/.exec(post),
      'the post faq cap'
    )[0],
    shortDefinitionMax: numbers(
      /shortDefinition: z\s*\.string\(\)\s*\.refine\(\(value\) => countWords\(value\) <= (\d+)/.exec(glossary),
      'the shortDefinition cap'
    )[0],
    definition: numbers(/isWithinWordRange\(value, (\d+), (\d+)\)/.exec(glossary), 'the definition range'),
  };
}

const bounds = ({ min, max }) => [min, max];

test('the categories are the enum of content.config.ts', () => {
  assert.deepEqual(CATEGORIES, limitsOf(config).categories);
});

test('the word ranges are the ones content.config.ts enforces', () => {
  const found = limitsOf(config);
  assert.deepEqual(bounds(WORD_LIMITS.shortAnswer), found.shortAnswer);
  assert.deepEqual(bounds(WORD_LIMITS.fullAnswer), found.fullAnswer);
  assert.equal(WORD_LIMITS.shortDefinition.max, found.shortDefinitionMax);
  assert.deepEqual(bounds(WORD_LIMITS.definition), found.definition);
});

test('the counts and the description cap are the ones content.config.ts enforces', () => {
  const found = limitsOf(config);
  assert.deepEqual(bounds(COUNT_LIMITS.keyTakeaways), found.keyTakeaways);
  assert.equal(COUNT_LIMITS.faq.max, found.postFaqMax);
  assert.equal(META_DESCRIPTION_MAX_CHARS, found.description);
});

test('the least number of article faq entries is the one row 14 of the content gate states', () => {
  const row = /^14\. (\d+)–(\d+) FAQ entries/m.exec(gateDoc);
  assert.ok(row, `${GATE_PATH} no longer states the faq entry count in row 14`);
  assert.deepEqual(bounds(COUNT_LIMITS.faq), [Number(row[1]), Number(row[2])]);
});

test('a limit moved in content.config.ts is read as moved, so the comparisons above can fail', () => {
  const moved = config
    .replace('wordRange(40, 60)', 'wordRange(40, 70)')
    .replace("'executive'] as const", "'executive', 'finance'] as const")
    .replace('countWords(value) <= 50', 'countWords(value) <= 60');
  const found = limitsOf(moved);
  assert.notDeepEqual(bounds(WORD_LIMITS.shortAnswer), found.shortAnswer);
  assert.notDeepEqual(CATEGORIES, found.categories);
  assert.notEqual(WORD_LIMITS.shortDefinition.max, found.shortDefinitionMax);
});

test('every word range holds a minimum no larger than its maximum', () => {
  for (const [field, { min, max }] of Object.entries(WORD_LIMITS)) {
    assert.ok(min >= 1 && min <= max, `${field} has the range ${min}-${max}`);
  }
});
