import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LengthError,
  bodyProfile,
  deriveLimits,
  lengthFor,
  lengthProblems,
  lengthRecord,
  measureLength,
  recordProblems,
} from './entry-length.mjs';

const words = (count) =>
  Array.from({ length: count }, (_, index) => (index === count - 1 ? 'end.' : 'w' + index)).join(' ');
const section = (heading, count) => '## ' + heading + '\n\n' + words(count) + '\n';
const bodyOf = (sections, preface = '') =>
  [preface, ...sections.map(([heading, count]) => section(heading, count))].filter(Boolean).join('\n');

const entry = (id, collection, sections, preface) => ({
  id,
  collection,
  frontmatter: {},
  body: bodyOf(sections, preface),
});

const article = (name, ...counts) =>
  entry(
    'post/' + name,
    'post',
    counts.map((count, index) => ['Question ' + (index + 1) + '?', count])
  );
const term = (name, ...counts) =>
  entry(
    'glossary/' + name,
    'glossary',
    counts.map((count, index) => ['Part ' + (index + 1), count])
  );

const CORPUS = [
  article('short', 100, 120, 140, 160),
  article('middle-a', 200, 210, 220, 230, 240),
  article('middle-b', 300, 310, 320, 330, 340, 350),
  article('long', 400, 410, 420, 430, 440, 450, 460),
  term('a', 50, 60),
  term('b', 70, 80),
  term('c', 90, 100),
];

const FRESH = measureLength(CORPUS);
const LIMITS = deriveLimits(FRESH);
const TODAY = '2026-11-02';
const RECORD = lengthRecord({ measure: FRESH, limits: LIMITS, measuredOn: TODAY });
const rulesOf = (found) => found.map(({ rule }) => rule);

test('a body is counted in prose words, the headings and the markup left out', () => {
  const profile = bodyProfile({
    collection: 'post',
    body: [
      'Preface of four words.',
      '',
      '## First heading?',
      '',
      'One **bold** two [linked words](/blog) three.',
      '',
      '### A deeper heading',
      '',
      '- item of three',
      '',
      '| head | cells |',
      '| --- | --- |',
      '| one | two |',
      '',
      '## Second heading?',
      '',
      'Four words in here.',
    ].join('\n'),
  });
  assert.deepEqual(profile.sections, [
    { heading: 'First heading?', words: 13 },
    { heading: 'Second heading?', words: 4 },
  ]);
  assert.equal(profile.words, 4 + 13 + 4);
});

test('a ## line inside a fenced block is code, not a section', () => {
  const profile = bodyProfile({
    collection: 'post',
    body: ['## Real?', '', 'Three words here.', '', '~~~', '## Not a heading', '~~~', '', 'After the fence.'].join(
      '\n'
    ),
  });
  assert.deepEqual(profile.sections, [{ heading: 'Real?', words: 6 }]);
});

test('a body with no ## heading has words and no section', () => {
  const profile = bodyProfile({ collection: 'post', body: words(40) });
  assert.deepEqual(profile, { words: 40, sections: [] });
});

test('only the ## level opens a section, and a deeper heading stays inside it', () => {
  const profile = bodyProfile({
    collection: 'glossary',
    body: [
      '## One',
      '',
      'alpha beta.',
      '',
      '### Inside one',
      '',
      'gamma delta.',
      '',
      '#### Deeper',
      '',
      'epsilon.',
    ].join('\n'),
  });
  assert.deepEqual(profile.sections, [{ heading: 'One', words: 5 }]);
});

test('the measurement counts entries and spreads words, sections and the thinnest section per format', () => {
  assert.deepEqual(FRESH.corpus, { article: { entries: 4 }, term: { entries: 3 } });
  assert.deepEqual(FRESH.distribution.article.words, { min: 520, p25: 1100, p50: 1950, p75: 3010, max: 3010 });
  assert.deepEqual(FRESH.distribution.article.sections, { min: 4, p25: 5, p50: 6, p75: 7, max: 7 });
  assert.deepEqual(FRESH.distribution.article.thinnestSection, { min: 100, p25: 200, p50: 300, p75: 400, max: 400 });
  assert.deepEqual(FRESH.distribution.term.words, { min: 110, p25: 110, p50: 150, p75: 190, max: 190 });
});

test('the floor is the shortest entry, the target the middle half, and the structure the shallowest', () => {
  assert.deepEqual(LIMITS.article, {
    format: 'article',
    wordsFloor: 520,
    targetFrom: 1100,
    targetTo: 3010,
    sectionsFloor: 4,
    sectionWordsFloor: 100,
  });
  assert.deepEqual(LIMITS.term, {
    format: 'term',
    wordsFloor: 110,
    targetFrom: 110,
    targetTo: 190,
    sectionsFloor: 2,
    sectionWordsFloor: 50,
  });
});

test('every entry of the corpus clears the limits derived from it', () => {
  for (const { collection, body, id } of CORPUS) {
    const format = collection === 'post' ? 'article' : 'term';
    assert.deepEqual(lengthProblems({ collection, body, limits: LIMITS[format] }), [], id);
  }
});

test('a format with no entry has nothing to derive a floor from', () => {
  const onlyArticles = measureLength(CORPUS.filter(({ collection }) => collection === 'post'));
  assert.throws(
    () => deriveLimits(onlyArticles),
    (error) => error instanceof LengthError && /no term/.test(error.message)
  );
});

test('a corpus that holds a body with no section is refused, because its floor would admit one unbroken block', () => {
  const unbroken = measureLength([
    ...CORPUS,
    { id: 'glossary/flat', collection: 'glossary', frontmatter: {}, body: words(120) },
  ]);
  assert.throws(
    () => deriveLimits(unbroken),
    (error) => error instanceof LengthError && /no section/.test(error.message)
  );
});

test('a body at every floor passes and one word under the floor fails', () => {
  const at = bodyOf([
    ['One?', 100],
    ['Two?', 100],
    ['Three?', 100],
    ['Four?', 220],
  ]);
  assert.deepEqual(lengthProblems({ collection: 'post', body: at, limits: LIMITS.article }), []);
  const under = bodyOf([
    ['One?', 100],
    ['Two?', 100],
    ['Three?', 100],
    ['Four?', 219],
  ]);
  assert.deepEqual(rulesOf(lengthProblems({ collection: 'post', body: under, limits: LIMITS.article })), [
    'body-too-short',
  ]);
});

test('a short body is told its words, its floor, the middle half and how to reach it', () => {
  const [problem] = lengthProblems({
    collection: 'post',
    body: bodyOf([
      ['One?', 150],
      ['Two?', 150],
      ['Three?', 150],
      ['Four?', 50],
    ]),
    limits: LIMITS.article,
  });
  assert.equal(problem.rule, 'body-too-short');
  assert.match(problem.detail, /the body has 500 words/);
  assert.match(problem.detail, /fewer than 520/);
  assert.match(problem.detail, /1100 to 3010/);
  assert.match(problem.detail, /more sections/);
});

test('too few sections is its own finding, whatever the word count', () => {
  const body = bodyOf([
    ['One?', 400],
    ['Two?', 400],
    ['Three?', 400],
  ]);
  const found = lengthProblems({ collection: 'post', body, limits: LIMITS.article });
  assert.deepEqual(rulesOf(found), ['too-few-sections']);
  assert.match(found[0].detail, /3 sections/);
  assert.match(found[0].detail, /at least 4/);
});

test('every section under the floor is named with its own word count', () => {
  const body = bodyOf([
    ['Deep?', 300],
    ['Stub one?', 40],
    ['Deep again?', 300],
    ['Stub two?', 99],
    ['Fine?', 100],
  ]);
  const found = lengthProblems({ collection: 'post', body, limits: LIMITS.article });
  assert.deepEqual(rulesOf(found), ['section-too-thin']);
  assert.match(found[0].detail, /2 sections under 100 words/);
  assert.match(found[0].detail, /"Stub one\?" has 40/);
  assert.match(found[0].detail, /"Stub two\?" has 99/);
  assert.doesNotMatch(found[0].detail, /Deep/);
});

test('an empty body fails every floor at once', () => {
  assert.deepEqual(rulesOf(lengthProblems({ collection: 'post', body: '', limits: LIMITS.article })), [
    'body-too-short',
    'too-few-sections',
  ]);
});

test('padding a short body with long sentences or a preface does not reach the structure floors', () => {
  const stretched = bodyOf(
    [
      ['One?', 60],
      ['Two?', 60],
    ],
    words(600)
  );
  assert.deepEqual(rulesOf(lengthProblems({ collection: 'post', body: stretched, limits: LIMITS.article })), [
    'too-few-sections',
    'section-too-thin',
  ]);
});

test('the limits of a format are read from the record, and an absent format names the ones it holds', () => {
  assert.equal(lengthFor(RECORD, 'term'), RECORD.limits.term);
  assert.throws(
    () => lengthFor(RECORD, 'service'),
    (error) => error instanceof LengthError && /"service"/.test(error.message) && /article, term/.test(error.message)
  );
  assert.throws(
    () => lengthFor(null, 'term'),
    (error) => error instanceof LengthError && /measure-entry-length/.test(error.message)
  );
});

test('a record equal to a fresh measurement of the corpus has no problem', () => {
  assert.deepEqual(recordProblems(RECORD, FRESH), []);
});

test('a record that is missing is one finding that names the command', () => {
  const [problem] = recordProblems(null, FRESH);
  assert.equal(problem.rule, 'length-record-missing');
});

test('a corpus that gained an entry makes the record stale and says how many it measured', () => {
  const grown = measureLength([...CORPUS, article('new', 700, 710, 720, 730)]);
  const found = recordProblems(RECORD, grown);
  assert.ok(rulesOf(found).includes('length-record-corpus-stale'));
  const corpus = found.find(({ rule }) => rule === 'length-record-corpus-stale');
  assert.match(corpus.detail, /4 article entries/);
  assert.match(corpus.detail, /5 article entries/);
});

test('a floor edited by hand differs from the derivation and is stale', () => {
  const edited = structuredClone(RECORD);
  edited.limits.article.wordsFloor = 100;
  assert.deepEqual(rulesOf(recordProblems(edited, FRESH)), ['length-record-limits-stale']);
});

test('a distribution edited by hand is stale on its own', () => {
  const edited = structuredClone(RECORD);
  edited.distribution.article.words.max += 1;
  assert.deepEqual(rulesOf(recordProblems(edited, FRESH)), ['length-record-distribution-stale']);
});

test('the date of the measurement is not compared, because a re-measure of the same corpus changes only it', () => {
  assert.deepEqual(recordProblems({ ...RECORD, measuredOn: '2020-01-01' }, FRESH), []);
});
