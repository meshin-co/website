import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bannedPhraseHits,
  duplicateSentences,
  paragraphViolations,
  selfContainmentIssues,
  sentenceLengths,
  splitSentences,
} from './prose-rules.mjs';

test('sentences split on terminators but not on abbreviations, decimals or initials', () => {
  const text = 'ISO/IEC 42001 costs approx. 3.5 days. Dr. Meshin signed it! Did it work? Yes.';
  assert.deepEqual(splitSentences(text), [
    'ISO/IEC 42001 costs approx. 3.5 days.',
    'Dr. Meshin signed it!',
    'Did it work?',
    'Yes.',
  ]);
});

test('sentence length reports the median and the longest, not the mean', () => {
  const text = 'One two three. Yes it works. ' + Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ') + '.';
  const { median, max, longest } = sentenceLengths(text);
  assert.equal(median, 3);
  assert.equal(max, 30);
  assert.match(longest, /^w0 w1/);
});

test('a paragraph is flagged over the word cap, and a single runaway sentence is flagged separately', () => {
  const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ') + '.';
  const runaway = Array.from({ length: 50 }, (_, i) => `s${i}`).join(' ') + '.';
  const findings = paragraphViolations([long, runaway, 'Short and clear.']);
  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['paragraph-words', 'sentence-length']
  );
});

test('banned phrases match case-insensitively on word boundaries and report the excerpt', () => {
  const hits = bannedPhraseHits('We leverage AI to Delve into synergies.', ['leverage', 'delve', 'unlock']);
  assert.deepEqual(
    hits.map((hit) => hit.phrase),
    ['leverage', 'delve']
  );
  assert.match(hits[0].excerpt, /We leverage AI/);
  assert.deepEqual(bannedPhraseHits('Unlockable levers are fine.', ['unlock', 'leverage']), []);
});

test('an answer that leans on the page around it is not self-contained', () => {
  assert.deepEqual(selfContainmentIssues('In this article we will look at the table below.').sort(), [
    'below',
    'in this article',
    'we will',
  ]);
  assert.deepEqual(selfContainmentIssues('An AI register lists every AI system a company runs.'), []);
});

test('a long sentence repeated across two routes is a duplicate, a short one is not', () => {
  const repeated = 'An AI register is the list of every AI system your company runs today.';
  const pages = [
    { route: '/a', text: `${repeated} Local colour here.` },
    { route: '/b', text: `${repeated} Different colour.` },
    { route: '/c', text: 'Book a call.' },
  ];
  const duplicates = duplicateSentences(pages, 12);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0].routes, ['/a', '/b']);
  assert.deepEqual(duplicateSentences([...pages, { route: '/d', text: 'Book a call.' }], 12).length, 1);
});
