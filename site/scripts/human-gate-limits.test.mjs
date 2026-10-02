import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { SENTENCE_LONGEST_MAX, humanFindings, longSentencesAllowed, pageFromHtml } from './human-gate.mjs';
import { SPECIMENS } from './mutation-specimens.mjs';

const CONTROLLED = JSON.parse(readFileSync(new URL('../controlled-words.json', import.meta.url), 'utf8'));
const PASSIVE = 'The plan was written by the team.';
const ACTIVE = 'The coach sets the goals each week.';

const rulesFor = (overrides) => humanFindings({ route: '/specimen', ...overrides }, CONTROLLED).map(({ rule }) => rule);
const withText = (text) => ({ text, paragraphs: [text] });
const repeated = (sentence, count) => Array.from({ length: count }, () => sentence).join(' ');
const equal = (count, words) => Array.from({ length: count }, () => words);

const pageOf = (lengths, { two = 0, three = 0 } = {}) => {
  const total = lengths.reduce((sum, count) => sum + count, 0);
  const words = [
    ...Array(three).fill('important'),
    ...Array(two).fill('garden'),
    ...Array(total - three - two).fill('plan'),
  ];
  return lengths.map((count) => `${words.splice(0, count).join(' ')}.`).join(' ');
};

const RATCHET = {
  'sentence-longest': {
    passes: withText(pageOf([...equal(4, 5), 40])),
    refused: withText(pageOf([...equal(4, 5), 41])),
  },
  'sentence-average': {
    passes: withText(pageOf(equal(5, 21))),
    refused: withText(pageOf([...equal(4, 21), 22])),
  },
  'reading-grade': {
    passes: withText(pageOf(equal(6, 20), { two: 86 })),
    refused: withText(pageOf(equal(6, 20), { two: 87 })),
  },
  'reading-ease': {
    passes: withText(pageOf(equal(6, 12), { two: 63 })),
    refused: withText(pageOf(equal(6, 12), { two: 64 })),
  },
  'long-word-share': {
    passes: withText(pageOf(equal(6, 20), { three: 30 })),
    refused: withText(pageOf(equal(6, 20), { three: 31 })),
  },
  'passive-voice': {
    passes: withText(`${repeated(PASSIVE, 2)} ${repeated(ACTIVE, 2)}`),
    refused: withText(`${repeated(PASSIVE, 3)} ${repeated(ACTIVE, 2)}`),
  },
  'sentence-variance': {
    passes: withText(pageOf([2, 2, 2, 6, 6, 6, 8, 8])),
    refused: withText(pageOf([2, 2, 2, 5, 6, 6, 8, 8])),
  },
  'long-sentences, the share of a page': {
    rule: 'long-sentences',
    passes: withText(pageOf([26, 26, ...equal(8, 5)])),
    refused: withText(pageOf([26, 26, ...equal(7, 5)])),
  },
  'long-sentences, the one a page always may hold': {
    rule: 'long-sentences',
    passes: withText(pageOf([26, 5, 5])),
    refused: withText(pageOf([26, 26, 5])),
  },
  'long-sentences, the cap on a long page': {
    rule: 'long-sentences',
    passes: withText(pageOf([...equal(7, 26), ...equal(28, 5)])),
    refused: withText(pageOf([...equal(8, 26), ...equal(32, 5)])),
  },
  'paragraph-variance': {
    passes: { paragraphs: [4, 10, 17].map((count) => pageOf([count])) },
    refused: { paragraphs: [4, 10, 16].map((count) => pageOf([count])) },
  },
};

for (const [name, { rule = name, passes, refused }] of Object.entries(RATCHET)) {
  test(`${name}: one step past the limit is refused on that rule alone, one step inside it passes every rule`, () => {
    assert.deepEqual(rulesFor(passes), []);
    assert.deepEqual(rulesFor(refused), [rule]);
  });
}

test('a page may hold one long sentence in five, never fewer than one and never more than seven', () => {
  for (let sentences = 1; sentences <= 2000; sentences += 1)
    assert.equal(
      longSentencesAllowed(sentences),
      Math.min(7, Math.max(1, Math.floor(sentences / 5))),
      `${sentences} sentences`
    );
});

const findingsOfSpecimen = async (name) => {
  const copySite = mkdtempSync(join(tmpdir(), 'human-specimen-'));
  try {
    await SPECIMENS[name].plant(copySite);
    const page = pageFromHtml('/zz-specimen', readFileSync(join(copySite, 'dist/zz-specimen.html'), 'utf8'));
    return humanFindings(page, CONTROLLED).map(({ rule, detail }) => [rule, detail]);
  } finally {
    rmSync(copySite, { recursive: true, force: true });
  }
};

test('the smoke specimen is one word over the sentence ceiling and trips nothing else', async () => {
  assert.deepEqual(await findingsOfSpecimen('humanSentenceOverCeiling'), [
    ['sentence-longest', `${SENTENCE_LONGEST_MAX + 1} > ${SENTENCE_LONGEST_MAX}`],
  ]);
});

test('the share specimen holds a second long sentence on a nine-sentence page and trips nothing else', async () => {
  assert.deepEqual(await findingsOfSpecimen('humanLongSentencesOverShare'), [
    ['long-sentences', '2 of 9 sentences over 25 words, limit 1'],
  ]);
});

test('the cap specimen holds an eighth long sentence on a forty-sentence page and trips nothing else', async () => {
  assert.deepEqual(await findingsOfSpecimen('humanLongSentencesOverCap'), [
    ['long-sentences', '8 of 40 sentences over 25 words, limit 7'],
  ]);
});
