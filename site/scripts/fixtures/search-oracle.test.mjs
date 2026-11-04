import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scanRank, scanScore } from './search-oracle.mjs';

const ENTRY = {
  href: '/glossary/evals',
  title: 'Evals',
  description: 'A test suite for a model, run in CI.',
  kind: 'glossary',
  text: 'An eval set measures whether a change made the answers better or only different.',
};

test('a title hit outranks a description hit, which outranks a body hit', () => {
  const title = scanScore(ENTRY, 'evals');
  const description = scanScore(ENTRY, 'suite');
  const body = scanScore(ENTRY, 'different');

  assert.ok(title > description, `${title} > ${description}`);
  assert.ok(description > body, `${description} > ${body}`);
});

test('an entry matching none of the words scores zero', () => {
  assert.equal(scanScore(ENTRY, 'kubernetes'), 0);
});

test('every word must appear somewhere for the entry to match, and a repeated word counts twice', () => {
  assert.ok(scanScore(ENTRY, 'evals model') > 0);
  assert.equal(scanScore(ENTRY, 'evals kubernetes'), 0);
  assert.equal(scanScore(ENTRY, 'evals evals'), 2 * scanScore(ENTRY, 'evals'));
});

test('matching is case-insensitive and matches word prefixes, not substrings mid-word', () => {
  assert.ok(scanScore(ENTRY, 'EVAL') > 0);
  assert.equal(scanScore(ENTRY, 'vals'), 0);
});

test('ranking returns the best entries first, breaks ties by href and drops non-matches', () => {
  const other = { ...ENTRY, href: '/blog/a', title: 'Why pilots stall', description: 'No evals in CI.', text: 'x' };
  const tied = { ...other, href: '/blog/b' };

  assert.deepEqual(
    scanRank([tied, other, ENTRY], 'evals').map((entry) => entry.href),
    ['/glossary/evals', '/blog/a', '/blog/b']
  );
  assert.deepEqual(scanRank([other, ENTRY], 'kubernetes'), []);
});

test('a query of only punctuation or one letter matches nothing', () => {
  assert.deepEqual(scanRank([ENTRY], '.'), []);
  assert.deepEqual(scanRank([ENTRY], 'e'), []);
});
