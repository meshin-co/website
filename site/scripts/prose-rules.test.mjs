import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bannedPhraseHits,
  duplicateSentences,
  machinePatternHits,
  paragraphViolations,
  punctuationFindings,
  questionRunLength,
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

test('formulaic transitions are refused outright, because the corpus contains none', () => {
  for (const word of ['Moreover', 'Furthermore', 'Additionally', 'In conclusion', 'In summary', 'As such']) {
    assert.equal(machinePatternHits(`${word}, the register matters.`).length, 1, word);
  }
  assert.deepEqual(machinePatternHits('The register lists every system, and one person owns each.'), []);
});

test('the not-only-but-also construction and guide-preamble are refused', () => {
  assert.equal(machinePatternHits('It is not only cheaper but also faster.').length, 1);
  assert.equal(machinePatternHits('This guide will help you write a policy.').length, 1);
  assert.equal(machinePatternHits('In this article, we look at evals.').length, 1);
});

test('hollow credential language is refused, but a real use of the same word survives', () => {
  assert.equal(machinePatternHits('An industry-leading approach.').length, 1);
  assert.equal(machinePatternHits('We are passionate about governance.').length, 1);
  assert.deepEqual(machinePatternHits('Leading the workshop takes two hours.'), []);
});

test('punctuation density fires on a semicolon-heavy page and ignores a short one with two', () => {
  const heavy = `${'word '.repeat(60)}one; two; three; four;`;
  assert.equal(
    punctuationFindings(heavy).some((finding) => finding.rule === 'semicolon-density'),
    true
  );
  assert.deepEqual(punctuationFindings('one; two; the rest is prose.'), []);
});

test('an em-dash pile-up fires on the same density rule', () => {
  const heavy = `${'word '.repeat(60)}a — b — c — d`;
  assert.equal(
    punctuationFindings(heavy).some((finding) => finding.rule === 'em-dash-density'),
    true
  );
});

test('two consecutive questions are a rhetorical run, one question is not', () => {
  assert.equal(questionRunLength('Who owns it? Who signs it off? Nobody knows.'), 2);
  assert.equal(questionRunLength('Who owns it? One person does.'), 1);
  assert.equal(questionRunLength('Nobody asks anything here.'), 0);
});
