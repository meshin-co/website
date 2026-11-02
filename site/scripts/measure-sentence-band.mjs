import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { DUPLICATE_MINIMUM_WORDS } from './content-gate.mjs';
import { GENERATION_DIR } from './generation-record.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import {
  BAND_FILE,
  BandError,
  bandRecord,
  deriveBands,
  loadCorpus,
  measureCorpus,
  readBandRecord,
  recordProblems,
  REMEASURE_COMMAND,
} from './sentence-band.mjs';

const USAGE = 'usage: node scripts/measure-sentence-band.mjs [--write] [repository root]';
const RECORD_SUFFIX = '.json';

const percent = (share) => `${Number((share * 100).toFixed(2))}%`;

const spreadText = (spread, show = String) =>
  Object.entries(spread)
    .map(([key, value]) => `${key} ${show(value)}`)
    .join(', ');

function generatedSlugs(repoRoot) {
  const directory = join(repoRoot, GENERATION_DIR);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(RECORD_SUFFIX))
    .map((name) => name.slice(0, -RECORD_SUFFIX.length));
}

function describeFormat(format, { threshold, minimumSentences, corpus, distribution }, band) {
  const { entries, measured, sentences } = corpus[format];
  const { pooled, perEntry } = distribution[format];
  const window = `${band.justBelowFrom} to ${threshold - 1}`;
  return [
    `${format}: ${entries} entries, ${measured} of them with ${minimumSentences} sentences or more, ` +
      `${sentences} sentences`,
    `  sentences per measured entry: ${spreadText(perEntry.sentences)}`,
    `  pooled sentence words: ${spreadText(pooled.sentenceWords)}`,
    `  pooled share of sentences: under ${threshold} words ${percent(pooled.shareBelowThreshold)}, ` +
      `${window} words ${percent(pooled.shareJustBelow)}, ` +
      `exactly ${threshold - 1} words ${percent(pooled.shareOneBelow)}`,
    `  per-entry median sentence words: ${spreadText(perEntry.median)}`,
    `  per-entry share under ${threshold} words: ${spreadText(perEntry.shareBelowThreshold, percent)}`,
    `  per-entry share of ${window} words: ${spreadText(perEntry.shareJustBelow, percent)}`,
    `  band: ${JSON.stringify(band)}`,
  ];
}

const describe = (measure, bands) => [
  `duplicate threshold: ${measure.threshold} words`,
  ...Object.entries(bands).flatMap(([format, band]) => describeFormat(format, measure, band)),
];

function writeRecord(repoRoot, record) {
  const path = join(repoRoot, BAND_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
}

export function run({ write, repoRoot, today, out, err }) {
  try {
    const entries = loadCorpus(repoRoot, { exclude: generatedSlugs(repoRoot) });
    const fresh = measureCorpus(entries, { threshold: DUPLICATE_MINIMUM_WORDS });
    const bands = deriveBands(fresh);
    for (const line of describe(fresh, bands)) out(line);

    if (write) {
      writeRecord(repoRoot, bandRecord({ measure: fresh, bands, measuredOn: today }));
      out(`wrote ${BAND_FILE}`);
      return 0;
    }

    const problems = recordProblems(readBandRecord(repoRoot), fresh);
    for (const { rule, detail } of problems) err(`SENTENCE-BAND ${rule} ${BAND_FILE}: ${detail}`);
    if (problems.length === 0) out(`${BAND_FILE} matches a fresh measurement`);
    else err(`SENTENCE-BAND the record is out of date; re-measure with: ${REMEASURE_COMMAND}`);
    return problems.length === 0 ? 0 : 1;
  } catch (error) {
    if (!(error instanceof BandError)) throw error;
    err(`SENTENCE-BAND ${error.message}`);
    return 1;
  }
}

function main(argv) {
  const flags = argv.filter((argument) => argument.startsWith('--'));
  const [repoArgument, ...extra] = argv.filter((argument) => !argument.startsWith('--'));
  if (flags.some((flag) => flag !== '--write') || extra.length > 0) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  process.exitCode = run({
    write: flags.includes('--write'),
    repoRoot: resolve(repoArgument ?? '..'),
    today: new Date().toISOString().slice(0, 10),
    out: console.log,
    err: console.error,
  });
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
