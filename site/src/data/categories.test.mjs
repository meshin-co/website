import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countWords } from '../utils/content-rules.mjs';
import { categoryPillars } from './categories.mjs';

const CATEGORIES = ['governance', 'agentic-architecture', 'operating-model', 'executive'];

test('every category has pillar text of at least 300 words', () => {
  const short = Object.entries(categoryPillars)
    .map(([key, pillar]) => [key, countWords(pillar.body.join(' '))])
    .filter(([, words]) => words < 300);
  assert.deepEqual(short, []);
});

test('the pillar set matches the post categories exactly', () => {
  assert.deepEqual(Object.keys(categoryPillars).sort(), [...CATEGORIES].sort());
});

test('descriptions stay inside the meta description limit', () => {
  const long = Object.entries(categoryPillars).filter(([, pillar]) => pillar.description.length > 155);
  assert.deepEqual(long, []);
});
