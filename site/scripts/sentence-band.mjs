import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { COLLECTION_OF, parseEntrySource, proseBlocks, proseSentences, wordCount } from './entry-prose.mjs';
import { DATA_DIRECTORY } from './writer-tree.mjs';

export const BAND_FILE = 'audits/sentence-band.json';
export const REMEASURE_COMMAND = 'node scripts/measure-sentence-band.mjs --write';

export class BandError extends Error {}

const MINIMUM_SENTENCES = 8;
const WINDOW_WIDTH = 4;
const PERCENTILES = [5, 25, 50, 75, 90, 95, 99];
const SHARE_SCALE = 10000;
const SENTENCE_END = /[.!?]["')\u2019\u201d]*$/;
const UNIFORM_ENTRY_MARGIN = 32;

export const FORMATS = Object.keys(COLLECTION_OF).sort();

const STALE_RULES = {
  schema: 'record-schema-stale',
  threshold: 'record-threshold-stale',
  minimumSentences: 'record-minimum-sentences-stale',
  corpus: 'record-corpus-stale',
  distribution: 'record-distribution-stale',
  bands: 'record-bands-stale',
};

export const byFormat = (build) => Object.fromEntries(FORMATS.map((format) => [format, build(format)]));

export const formatOf = (collection) => FORMATS.find((format) => COLLECTION_OF[format] === collection);

const windowOf = (threshold) => ({ threshold, justBelowFrom: threshold - WINDOW_WIDTH });

const shareRoundedUp = (count, total) => (total === 0 ? 0 : Math.ceil((count * SHARE_SCALE) / total) / SHARE_SCALE);

const percent = (share) => `${Number((share * 100).toFixed(2))}%`;

const allowedCount = (cap, total) => Math.max(1, Math.floor((Math.round(cap * SHARE_SCALE) * total) / SHARE_SCALE));

export const quantile = (sorted, percentile) => sorted[Math.floor((percentile * sorted.length) / 100)];

const spread = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    ...Object.fromEntries(PERCENTILES.map((percentile) => [`p${percentile}`, quantile(sorted, percentile)])),
    max: sorted.at(-1),
  };
};

const medianOf = (counts) => {
  if (counts.length === 0) return 0;
  const sorted = [...counts].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
};

const wordCounts = (sentences) => sentences.filter((sentence) => SENTENCE_END.test(sentence)).map(wordCount);

const profileOf = (counts, { threshold, justBelowFrom }) => ({
  counts,
  sentences: counts.length,
  median: medianOf(counts),
  below: counts.filter((count) => count < threshold).length,
  justBelow: counts.filter((count) => count >= justBelowFrom && count < threshold).length,
});

const bandText = (band) =>
  `${band.format} band: median ${band.medianFloor} to ${band.medianCeiling} words, ` +
  `at most ${percent(band.belowThresholdCap)} of sentences under ${band.threshold} words, ` +
  `at most ${percent(band.justBelowCap)} of sentences of ${band.justBelowFrom} to ${band.threshold - 1} words`;

const tooFewSentences = (sentences, band) => ({
  rule: 'too-few-sentences',
  detail:
    `the entry has ${sentences} sentences; the ${band.format} band judges entries of ${band.minimumSentences} ` +
    'or more sentences, because the median and the shares of fewer are not stable',
});

function problemsOf({ sentences, median, below, justBelow }, band) {
  if (sentences < band.minimumSentences) return [tooFewSentences(sentences, band)];

  const findings = [];
  const add = (rule, measured) => findings.push({ rule, detail: `${measured}; ${bandText(band)}` });
  const medianText = `the median sentence is ${median} words over ${sentences} sentences`;
  if (median < band.medianFloor) add('median-below-band', `${medianText}, below the band floor of ${band.medianFloor}`);
  if (median > band.medianCeiling)
    add('median-above-band', `${medianText}, above the band ceiling of ${band.medianCeiling}`);

  const belowAllowed = allowedCount(band.belowThresholdCap, sentences);
  if (below > belowAllowed)
    add(
      'below-threshold-share',
      `${below} of ${sentences} sentences (${percent(shareRoundedUp(below, sentences))}) are under ${band.threshold} ` +
        `words; the band allows ${belowAllowed}`
    );

  const justAllowed = allowedCount(band.justBelowCap, sentences);
  if (justBelow > justAllowed)
    add(
      'just-below-threshold-cluster',
      `${justBelow} of ${sentences} sentences (${percent(shareRoundedUp(justBelow, sentences))}) are ` +
        `${band.justBelowFrom} to ${band.threshold - 1} words long; the band allows ${justAllowed}`
    );
  return findings;
}

export const bandProblems = ({ sentences, band }) => problemsOf(profileOf(wordCounts(sentences), band), band);

export function entryStats({ sentences, band }) {
  const { sentences: total, median, below, justBelow } = profileOf(wordCounts(sentences), band);
  return {
    format: band.format,
    sentences: total,
    median,
    shareBelowThreshold: shareRoundedUp(below, total),
    shareJustBelow: shareRoundedUp(justBelow, total),
    threshold: band.threshold,
  };
}

export function bandFor(record, format) {
  if (!record) throw new BandError(`${BAND_FILE} does not exist; measure it with: ${REMEASURE_COMMAND}`);
  const bands = record.bands ?? {};
  if (!Object.hasOwn(bands, format))
    throw new BandError(
      `${BAND_FILE} holds no sentence band for the format "${format}"; it holds ${Object.keys(bands).join(', ')}`
    );
  return bands[format];
}

export const bandSummary = (record, format) => ({
  measuredOn: record.measuredOn,
  threshold: record.threshold,
  band: bandFor(record, format),
});

const measuredOnly = (profiles) => profiles.filter(({ sentences }) => sentences >= MINIMUM_SENTENCES);

const countsOf = (profiles) => ({
  entries: profiles.length,
  measured: measuredOnly(profiles).length,
  sentences: profiles.reduce((total, { sentences }) => total + sentences, 0),
});

function distributionOf(profiles, { threshold, justBelowFrom }) {
  const measured = measuredOnly(profiles);
  const pooled = profiles.flatMap(({ counts }) => counts);
  const pooledShare = (inside) => shareRoundedUp(pooled.filter(inside).length, pooled.length);
  const entrySpread = (statistic) => spread(measured.map(statistic));

  return {
    pooled: {
      sentenceWords: spread(pooled),
      shareBelowThreshold: pooledShare((count) => count < threshold),
      shareJustBelow: pooledShare((count) => count >= justBelowFrom && count < threshold),
      shareOneBelow: pooledShare((count) => count === threshold - 1),
    },
    perEntry: {
      sentences: entrySpread(({ sentences }) => sentences),
      median: entrySpread(({ median }) => median),
      shareBelowThreshold: entrySpread(({ below, sentences }) => shareRoundedUp(below, sentences)),
      shareJustBelow: entrySpread(({ justBelow, sentences }) => shareRoundedUp(justBelow, sentences)),
    },
  };
}

export function measureCorpus(entries, { threshold }) {
  const window = windowOf(threshold);
  const profiles = entries.map((entry) => ({
    format: formatOf(entry.collection),
    ...profileOf(wordCounts(proseSentences(proseBlocks(entry))), window),
  }));
  const inFormat = (format) => profiles.filter((profile) => profile.format === format);

  return {
    threshold,
    minimumSentences: MINIMUM_SENTENCES,
    corpus: byFormat((format) => countsOf(inFormat(format))),
    distribution: byFormat((format) => distributionOf(inFormat(format), window)),
  };
}

const uniformSentence = (words) => `${Array(words).fill('word').join(' ')}.`;

function admittedUniformEntry(band) {
  const sentence = uniformSentence(band.threshold - 1);
  const sizes = Array.from({ length: band.minimumSentences + UNIFORM_ENTRY_MARGIN }, (_, index) => index + 1);
  return sizes.find((size) => bandProblems({ sentences: Array(size).fill(sentence), band }).length === 0);
}

export function deriveBand({ threshold, minimumSentences, corpus, distribution }, format) {
  if (!corpus[format]?.measured)
    throw new BandError(`no ${format} has ${minimumSentences} sentences, so there is nothing to derive a band from`);

  const { median, shareBelowThreshold, shareJustBelow } = distribution[format].perEntry;
  const band = {
    format,
    ...windowOf(threshold),
    minimumSentences,
    medianFloor: median.p5,
    medianCeiling: median.p95,
    belowThresholdCap: shareBelowThreshold.p95,
    justBelowCap: shareJustBelow.p95,
  };

  const size = admittedUniformEntry(band);
  if (size !== undefined)
    throw new BandError(
      `the derived ${format} band admits an entry made only of ${threshold - 1}-word sentences ` +
        `(${size} sentences); ${bandText(band)}`
    );
  return band;
}

export const deriveBands = (measure) => byFormat((format) => deriveBand(measure, format));

export const bandRecord = ({ measure, bands, measuredOn }) => ({
  schema: 1,
  measuredOn,
  threshold: measure.threshold,
  minimumSentences: measure.minimumSentences,
  corpus: measure.corpus,
  distribution: measure.distribution,
  bands,
});

const describeCorpus = (corpus) =>
  FORMATS.map((format) => {
    const { entries, sentences } = corpus?.[format] ?? {};
    return `${entries} ${format} entries with ${sentences} sentences`;
  }).join(', ');

const STALE_DETAIL = {
  threshold: (found, wanted) =>
    `the record holds threshold ${found}, the duplicate-sentence rule now binds at ${wanted} words`,
  corpus: (found, wanted) =>
    `the record measured ${describeCorpus(found)}; the corpus now has ${describeCorpus(wanted)}`,
};

const staleDetail = (key, found, wanted) =>
  STALE_DETAIL[key]?.(found, wanted) ?? `the recorded ${key} differs from a fresh measurement of the corpus`;

export function recordProblems(record, fresh) {
  if (!record) return [{ rule: 'record-missing', detail: `${BAND_FILE} does not exist` }];

  const expected = bandRecord({ measure: fresh, bands: deriveBands(fresh), measuredOn: record.measuredOn });
  return Object.entries(STALE_RULES)
    .filter(([key]) => !isDeepStrictEqual(record[key], expected[key]))
    .map(([key, rule]) => ({ rule, detail: staleDetail(key, record[key], expected[key]) }));
}

function readEntry(directory, collection, slug) {
  const id = `${collection}/${slug}`;
  try {
    return { id, collection, ...parseEntrySource(readFileSync(join(directory, `${slug}.md`), 'utf8')) };
  } catch (error) {
    throw new BandError(`${id}: ${error.message}`);
  }
}

export function loadCorpus(repoRoot, { exclude = [] } = {}) {
  const skipped = new Set(exclude);
  return Object.values(COLLECTION_OF).flatMap((collection) => {
    const directory = join(repoRoot, DATA_DIRECTORY, collection);
    return readdirSync(directory)
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -'.md'.length))
      .filter((slug) => !skipped.has(slug))
      .map((slug) => readEntry(directory, collection, slug));
  });
}

export function readBandRecord(repoRoot) {
  const path = join(repoRoot, BAND_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new BandError(`${BAND_FILE} is not readable JSON: ${error.message}`);
  }
}
