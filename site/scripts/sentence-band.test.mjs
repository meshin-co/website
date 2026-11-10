import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { proseBlocks, proseSentences } from './entry-prose.mjs';
import {
  BandError,
  bandFor,
  bandProblems,
  bandSummary,
  deriveBand,
  deriveBands,
  entryStats,
  measureCorpus,
} from './sentence-band.mjs';

const ARTICLE_BAND = {
  format: 'article',
  threshold: 12,
  justBelowFrom: 8,
  minimumSentences: 8,
  medianFloor: 10,
  medianCeiling: 15,
  belowThresholdCap: 0.5779,
  justBelowCap: 0.2907,
};

const TERM_BAND = {
  format: 'term',
  threshold: 12,
  justBelowFrom: 8,
  minimumSentences: 8,
  medianFloor: 13,
  medianCeiling: 19,
  belowThresholdCap: 0.381,
  justBelowCap: 0.2941,
};

const FORMATS = [
  { format: 'article', collection: 'post', band: ARTICLE_BAND },
  { format: 'term', collection: 'glossary', band: TERM_BAND },
];

const FIELD_OF = { post: 'fullAnswer', glossary: 'definition' };

const sentence = (words) =>
  Array.from({ length: words }, (_, index) => (index === words - 1 ? 'end.' : `w${index}`)).join(' ');
const sentencesOf = (lengths) => lengths.map(sentence);
const repeat = (length, count) => Array(count).fill(length);
const entry = (id, collection, lengths) => ({
  id,
  collection,
  frontmatter: { [FIELD_OF[collection]]: sentencesOf(lengths).join(' ') },
  body: '',
});
const entriesOf = (collection, count, lengths) =>
  Array.from({ length: count }, (_, index) => entry(`${collection}/t${index}`, collection, lengths));
const rulesOf = (lengths, band) => bandProblems({ sentences: sentencesOf(lengths), band }).map(({ rule }) => rule);
const measure = (corpus) => measureCorpus(corpus, { threshold: 12 });

const CORPUS = [
  entry('post/steady', 'post', repeat(14, 10)),
  entry('post/long', 'post', repeat(20, 9)),
  entry('glossary/split', 'glossary', [...repeat(10, 4), ...repeat(16, 4)]),
  entry('glossary/low', 'glossary', [11, 11, 12, 12, 13, 13, 14, 14]),
  entry('glossary/short', 'glossary', [5, 20, 13]),
];

const same = (value) => ({
  p5: value,
  p25: value,
  p50: value,
  p75: value,
  p90: value,
  p95: value,
  p99: value,
  max: value,
});

test('measureCorpus keeps the formats apart and takes per-entry spreads only from entries of eight sentences or more', () => {
  const termShares = { ...same(0.5), p5: 0.25, p25: 0.25 };
  assert.deepEqual(measure(CORPUS), {
    threshold: 12,
    minimumSentences: 8,
    corpus: {
      article: { entries: 2, measured: 2, sentences: 19 },
      term: { entries: 3, measured: 2, sentences: 19 },
    },
    distribution: {
      article: {
        pooled: {
          sentenceWords: { p5: 14, p25: 14, p50: 14, p75: 20, p90: 20, p95: 20, p99: 20, max: 20 },
          shareBelowThreshold: 0,
          shareJustBelow: 0,
          shareOneBelow: 0,
        },
        perEntry: {
          sentences: { p5: 9, p25: 9, p50: 10, p75: 10, p90: 10, p95: 10, p99: 10, max: 10 },
          median: { p5: 14, p25: 14, p50: 20, p75: 20, p90: 20, p95: 20, p99: 20, max: 20 },
          shareBelowThreshold: same(0),
          shareJustBelow: same(0),
        },
      },
      term: {
        pooled: {
          sentenceWords: { p5: 5, p25: 10, p50: 13, p75: 16, p90: 16, p95: 20, p99: 20, max: 20 },
          shareBelowThreshold: 0.3685,
          shareJustBelow: 0.3158,
          shareOneBelow: 0.1053,
        },
        perEntry: {
          sentences: same(8),
          median: same(13),
          shareBelowThreshold: termShares,
          shareJustBelow: termShares,
        },
      },
    },
  });
});

test('quantiles are upper empirical quantiles: forty entries put p5 at the third smallest and p95 at the 39th', () => {
  const corpus = Array.from({ length: 40 }, (_, index) =>
    entry(`glossary/t${index}`, 'glossary', repeat(index + 1, 8))
  );
  const { median } = measure(corpus).distribution.term.perEntry;
  assert.deepEqual([median.p5, median.p50, median.p95, median.max], [3, 21, 39, 40]);
});

test('deriveBand reads the ceiling at p95 of the entry medians, which is not p90', () => {
  const corpus = Array.from({ length: 40 }, (_, index) =>
    entry(`glossary/t${index}`, 'glossary', repeat(index + 12, 8))
  );
  const band = deriveBand(measure(corpus), 'term');
  assert.deepEqual([band.medianFloor, band.medianCeiling], [14, 50]);
});

test('a fragment that does not end like a sentence is not measured, a closing quote or bracket still ends one', () => {
  const fragmented = {
    id: 'post/fragments',
    collection: 'post',
    frontmatter: { fullAnswer: 'One two three. He said "done." Then left (quietly.) Trailing label' },
    body: '- A bare list item\n- Another bare item',
  };
  assert.equal(measure([fragmented]).corpus.article.sentences, 3);
});

test('deriveBand puts the floor and ceiling at p5 and p95 of entry medians and the caps at p95 of entry shares', () => {
  assert.deepEqual(deriveBand(measure(CORPUS), 'article'), {
    format: 'article',
    threshold: 12,
    justBelowFrom: 8,
    minimumSentences: 8,
    medianFloor: 14,
    medianCeiling: 20,
    belowThresholdCap: 0,
    justBelowCap: 0,
  });
  assert.deepEqual(deriveBand(measure(CORPUS), 'term'), {
    format: 'term',
    threshold: 12,
    justBelowFrom: 8,
    minimumSentences: 8,
    medianFloor: 13,
    medianCeiling: 13,
    belowThresholdCap: 0.5,
    justBelowCap: 0.5,
  });
});

test('deriveBands returns one band per format', () => {
  const measured = measure(CORPUS);
  assert.deepEqual(deriveBands(measured), {
    article: deriveBand(measured, 'article'),
    term: deriveBand(measured, 'term'),
  });
});

test('the band of a format depends on the entries of that format alone', () => {
  const articles = CORPUS.filter(({ collection }) => collection === 'post');
  const terms = CORPUS.filter(({ collection }) => collection === 'glossary');
  assert.deepEqual(deriveBand(measure(articles), 'article'), deriveBand(measure(CORPUS), 'article'));
  assert.deepEqual(deriveBand(measure(terms), 'term'), deriveBand(measure(CORPUS), 'term'));
});

test('deriveBand refuses a format with no entry long enough to measure', () => {
  assert.throws(() => deriveBand(measure(CORPUS.slice(0, 2)), 'term'), /no term has 8 sentences/);
  assert.throws(() => deriveBand(measure(CORPUS.slice(4)), 'term'), /no term has 8 sentences/);
  assert.throws(() => deriveBand(measure([]), 'article'), BandError);
});

test('deriveBand refuses a format with one measured entry, since a band is the spread between entries', () => {
  const lone = [entry('post/only', 'post', repeat(14, 10))];
  assert.throws(
    () => deriveBand(measure(lone), 'article'),
    /the article band would have no width: 1 article has 8 sentences or more/
  );
  const pair = CORPUS.filter(({ collection }) => collection === 'post');
  assert.equal(pair.length, 2);
  assert.doesNotThrow(() => deriveBand(measure(pair), 'article'));
});

test('deriveBand throws when the band it derived would admit an entry of eleven-word sentences, for either format', () => {
  for (const { format, collection } of FORMATS)
    assert.throws(
      () => deriveBand(measure(entriesOf(collection, 10, repeat(11, 8))), format),
      /admits an entry made only of 11-word sentences \(8 sentences\)/,
      format
    );
});

test('a median floor under the threshold is safe while the caps and the minimum bind eleven-word entries', () => {
  const lowMedian = [11, 11, 11, 11, 11, 30, 30, 30];
  for (const { format, collection } of FORMATS) {
    const corpus = [...entriesOf(collection, 2, lowMedian), ...entriesOf(collection, 18, repeat(20, 8))];
    const band = deriveBand(measure(corpus), format);
    assert.equal(band.medianFloor, 11);
    for (let size = 1; size <= 40; size += 1)
      assert.notDeepEqual(rulesOf(repeat(11, size), band), [], `${format}, ${size} sentences`);
  }
});

test('a median floor exactly at the threshold is accepted for either format', () => {
  for (const { format, collection } of FORMATS)
    assert.equal(deriveBand(measure(entriesOf(collection, 10, repeat(12, 8))), format).medianFloor, 12);
});

test('a share rounded up to four decimals admits the entry that sets a cap, and one rounded down would not', () => {
  const lengths = [...repeat(10, 26), ...repeat(15, 25)];
  const twins = [entry('glossary/odd', 'glossary', lengths), entry('glossary/odd-too', 'glossary', lengths)];
  const band = deriveBand(measure(twins), 'term');
  assert.equal(band.belowThresholdCap, 0.5099);
  assert.equal(band.justBelowCap, 0.5099);
  assert.deepEqual(rulesOf(lengths, band), []);
  const roundedDown = { ...band, belowThresholdCap: 0.5098, justBelowCap: 0.5098 };
  assert.deepEqual(rulesOf(lengths, roundedDown), ['below-threshold-share', 'just-below-threshold-cluster']);
});

test('an entry of eleven-word sentences fails the band of either format, naming both sides', () => {
  const sentences = sentencesOf(repeat(11, 20));
  const article = bandProblems({ sentences, band: ARTICLE_BAND });
  assert.deepEqual(
    article.map(({ rule }) => rule),
    ['below-threshold-share', 'just-below-threshold-cluster']
  );
  const term = bandProblems({ sentences, band: TERM_BAND });
  assert.deepEqual(
    term.map(({ rule }) => rule),
    ['median-below-band', 'below-threshold-share', 'just-below-threshold-cluster']
  );
  assert.match(article[0].detail, /20 of 20 sentences \(100%\) are under 12 words; the band allows 11;/);
  assert.match(article[1].detail, /20 of 20 sentences \(100%\) are 8 to 11 words long; the band allows 5;/);
  assert.match(term[0].detail, /the median sentence is 11 words over 20 sentences, below the band floor of 13;/);
  for (const { detail } of article)
    assert.match(
      detail,
      /article band: median 10 to 15 words, at most 57.79% of sentences under 12 words, at most 29.07% of sentences of 8 to 11 words$/
    );
  for (const { detail } of term)
    assert.match(
      detail,
      /term band: median 13 to 19 words, at most 38.1% of sentences under 12 words, at most 29.41% of sentences of 8 to 11 words$/
    );
});

test('an even mix of eleven and fifteen words passes the median but fails the cluster rule', () => {
  const lengths = [...repeat(11, 10), ...repeat(15, 10)];
  assert.deepEqual(rulesOf(lengths, ARTICLE_BAND), ['just-below-threshold-cluster']);
  assert.deepEqual(rulesOf(lengths, TERM_BAND), ['below-threshold-share', 'just-below-threshold-cluster']);
});

test('an alternation of three and eleven words fails all three rules for either format', () => {
  const alternating = Array.from({ length: 20 }, (_, index) => (index % 2 === 0 ? 3 : 11));
  for (const { band } of FORMATS)
    assert.deepEqual(rulesOf(alternating, band), [
      'median-below-band',
      'below-threshold-share',
      'just-below-threshold-cluster',
    ]);
});

test('one long sentence among eleven-word sentences does not rescue the entry', () => {
  const lengths = [...repeat(11, 19), 38];
  assert.deepEqual(rulesOf(lengths, ARTICLE_BAND), ['below-threshold-share', 'just-below-threshold-cluster']);
  assert.deepEqual(rulesOf(lengths, TERM_BAND), [
    'median-below-band',
    'below-threshold-share',
    'just-below-threshold-cluster',
  ]);
});

test('a median above the ceiling fails on its own', () => {
  for (const { band } of FORMATS) {
    assert.deepEqual(rulesOf(repeat(30, 8), band), ['median-above-band']);
    const [{ detail }] = bandProblems({ sentences: sentencesOf(repeat(30, 8)), band });
    assert.match(detail, new RegExp(`above the band ceiling of ${band.medianCeiling};`));
  }
});

test('an entry with fewer sentences than the band minimum is refused as too short to measure, whatever they are', () => {
  for (const { band } of FORMATS) {
    assert.deepEqual(rulesOf(repeat(15, 7), band), ['too-few-sentences']);
    assert.deepEqual(rulesOf(repeat(11, 3), band), ['too-few-sentences']);
    assert.deepEqual(rulesOf(repeat(11, 1), band), ['too-few-sentences']);
    assert.deepEqual(rulesOf([], band), ['too-few-sentences']);
    assert.deepEqual(rulesOf(repeat(15, 8), band), []);
  }
  const [{ detail }] = bandProblems({ sentences: sentencesOf(repeat(15, 7)), band: TERM_BAND });
  assert.match(detail, /^the entry has 7 sentences; the term band judges entries of 8 or more sentences/);
});

test('a fragment without a sentence ending does not count towards the minimum', () => {
  const sentences = [...sentencesOf(repeat(15, 7)), 'Short label', 'Another label'];
  assert.deepEqual(
    bandProblems({ sentences, band: TERM_BAND }).map(({ rule }) => rule),
    ['too-few-sentences']
  );
  assert.deepEqual(bandProblems({ sentences: [...sentences, sentence(15)], band: TERM_BAND }), []);
});

test('a cap that rounds to nothing still leaves a short entry one sentence of room and no more', () => {
  const band = { ...TERM_BAND, belowThresholdCap: 0, justBelowCap: 0 };
  assert.deepEqual(rulesOf([9, ...repeat(15, 7)], band), []);
  assert.deepEqual(rulesOf([9, 10, ...repeat(15, 6)], band), ['below-threshold-share', 'just-below-threshold-cluster']);
});

test('the cluster window starts at the shortest sentence it names: justBelowFrom words count, one fewer do not', () => {
  const window = (words) => [...repeat(words, 5), ...repeat(16, 12)];
  assert.deepEqual(rulesOf(window(TERM_BAND.justBelowFrom), TERM_BAND), ['just-below-threshold-cluster']);
  assert.deepEqual(rulesOf(window(TERM_BAND.justBelowFrom - 1), TERM_BAND), []);
});

test('entryStats reports the measured values bandProblems compares against the band, and the format', () => {
  const sentences = [...sentencesOf([11, 11, 15, 20]), 'A label without an ending'];
  assert.deepEqual(entryStats({ sentences, band: TERM_BAND }), {
    format: 'term',
    sentences: 4,
    median: 13,
    shareBelowThreshold: 0.5,
    shareJustBelow: 0.5,
    threshold: 12,
  });
  assert.deepEqual(entryStats({ sentences: [], band: ARTICLE_BAND }), {
    format: 'article',
    sentences: 0,
    median: 0,
    shareBelowThreshold: 0,
    shareJustBelow: 0,
    threshold: 12,
  });
});

const RECORD = {
  schema: 1,
  measuredOn: '2026-11-02',
  threshold: 12,
  bands: { article: ARTICLE_BAND, term: TERM_BAND },
};

test('bandFor returns the band of a format and refuses every other name', () => {
  assert.equal(bandFor(RECORD, 'article'), ARTICLE_BAND);
  assert.equal(bandFor(RECORD, 'term'), TERM_BAND);
  for (const format of ['faq-answer', 'glossary', 'constructor', undefined])
    assert.throws(() => bandFor(RECORD, format), BandError, String(format));
  assert.throws(() => bandFor(RECORD, 'faq-answer'), /"faq-answer".*article, term/);
});

test('bandFor names the missing record and the command that writes it', () => {
  assert.throws(() => bandFor(null, 'article'), BandError);
  assert.throws(
    () => bandFor(null, 'article'),
    /audits\/sentence-band\.json does not exist; measure it with: node scripts\/measure-sentence-band\.mjs --write/
  );
});

test('bandSummary names the date, the threshold and the band of the format', () => {
  assert.deepEqual(bandSummary(RECORD, 'term'), { measuredOn: '2026-11-02', threshold: 12, band: TERM_BAND });
  assert.deepEqual(bandSummary(RECORD, 'article').band.format, 'article');
});

const handWrittenLengths = (index) => [
  ...repeat(7 + (index % 5), 1 + (index % 6)),
  ...Array.from({ length: 11 - (index % 6) }, (_, slot) => 13 + ((index * 3 + slot * 7) % 10)),
];

const handWrittenOf = (collection, firstIndex) =>
  Array.from({ length: 40 }, (_, offset) =>
    entry(`${collection}/hand-${offset}`, collection, handWrittenLengths(firstIndex + offset))
  );
const HAND_WRITTEN = [...handWrittenOf('post', 0), ...handWrittenOf('glossary', 7)];

test('each format band passes a typical entry of a corpus of its format and at least four in five of them', () => {
  const bands = deriveBands(measure(HAND_WRITTEN));
  for (const { format, collection } of FORMATS) {
    const band = bands[format];
    const measured = HAND_WRITTEN.filter((written) => written.collection === collection)
      .map((written) => {
        const sentences = proseSentences(proseBlocks(written));
        return { id: written.id, sentences, median: entryStats({ sentences, band }).median };
      })
      .filter(({ sentences }) => sentences.length >= band.minimumSentences)
      .sort((a, b) => a.median - b.median || a.id.localeCompare(b.id));
    assert.ok(measured.length > 0, `the corpus has ${format} entries long enough to measure`);
    const typical = measured[Math.floor(measured.length / 2)];
    assert.deepEqual(bandProblems({ sentences: typical.sentences, band }), [], typical.id);
    const passing = measured.filter(({ sentences }) => bandProblems({ sentences, band }).length === 0);
    assert.ok(
      passing.length / measured.length >= 0.8,
      `${passing.length} of ${measured.length} ${format} entries pass`
    );
  }
});
