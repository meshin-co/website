import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildIndexEntry, scoreEntry, rankEntries } from '../public/search/index-model.mjs';

const ENTRY = {
  href: '/glossary/evals',
  title: 'Evals',
  description: 'A test suite for a model, run in CI.',
  kind: 'Glossary',
  text: 'An eval set measures whether a change made the answers better or only different.',
};

test('an index entry keeps only what search needs, with collapsed whitespace', () => {
  const entry = buildIndexEntry({
    href: '/glossary/evals/',
    title: 'Evals',
    description: 'A test   suite\nfor a model.',
    kind: 'Glossary',
    body: '## Heading\n\nAn *eval* set measures  answers.\n',
  });

  assert.deepEqual(entry, {
    href: '/glossary/evals',
    title: 'Evals',
    description: 'A test suite for a model.',
    kind: 'Glossary',
    text: 'Heading An eval set measures answers.',
  });
});

test('a title hit outranks a description hit, which outranks a body hit', () => {
  const title = scoreEntry(ENTRY, ['evals']);
  const description = scoreEntry(ENTRY, ['suite']);
  const body = scoreEntry(ENTRY, ['different']);

  assert.ok(title > description, `${title} > ${description}`);
  assert.ok(description > body, `${description} > ${body}`);
});

test('an entry matching none of the words scores zero', () => {
  assert.equal(scoreEntry(ENTRY, ['kubernetes']), 0);
});

test('every word must appear somewhere for the entry to match', () => {
  assert.ok(scoreEntry(ENTRY, ['evals', 'model']) > 0);
  assert.equal(scoreEntry(ENTRY, ['evals', 'kubernetes']), 0);
});

test('matching is case-insensitive and matches word prefixes, not substrings mid-word', () => {
  assert.ok(scoreEntry(ENTRY, ['EVAL']) > 0);
  assert.equal(scoreEntry(ENTRY, ['vals']), 0);
});

test('ranking returns the best entries first and drops non-matches', () => {
  const other = { ...ENTRY, href: '/blog/a', title: 'Why pilots stall', description: 'No evals in CI.', text: 'x' };

  const ranked = rankEntries([other, ENTRY], 'evals');

  assert.deepEqual(
    ranked.map((entry) => entry.href),
    ['/glossary/evals', '/blog/a']
  );
  assert.deepEqual(rankEntries([other, ENTRY], 'kubernetes'), []);
});

test('a query of only punctuation or one letter matches nothing', () => {
  assert.deepEqual(rankEntries([ENTRY], '.'), []);
  assert.deepEqual(rankEntries([ENTRY], 'e'), []);
});
