import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  LENGTH_FILE,
  LengthError,
  REMEASURE_COMMAND,
  deriveLimits,
  lengthRecord,
  measureLength,
  readLengthRecord,
  recordProblems,
  shortestEntry,
} from './entry-length.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { generatedSlugs } from './measure-sentence-band.mjs';
import { FORMATS, loadCorpus } from './sentence-band.mjs';

const USAGE = 'usage: node scripts/measure-entry-length.mjs [--write] [repository root]';

const slugOf = ({ id }) => id.slice(id.indexOf('/') + 1);

const spreadText = (spread) =>
  Object.entries(spread)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');

export function measureRepository(repoRoot, exclude = generatedSlugs(repoRoot)) {
  const skipped = new Set(exclude);
  const everything = loadCorpus(repoRoot);
  const kept = everything.filter((entry) => !skipped.has(slugOf(entry)));
  const left = everything.filter((entry) => skipped.has(slugOf(entry)));
  const fresh = measureLength(kept);
  return { kept, left, fresh, limits: deriveLimits(fresh) };
}

const leftOutLine = (left) => {
  const names = left.length === 0 ? '' : ` (${left.map(slugOf).join(', ')})`;
  return `left out: ${left.length} ${left.length === 1 ? 'entry' : 'entries'} the pipeline wrote${names}`;
};

function describeFormat(format, { kept, fresh, limits }) {
  const { words, sections, thinnestSection } = fresh.distribution[format];
  const shortest = shortestEntry(kept, format);
  return [
    `${format}: ${fresh.corpus[format].entries} entries`,
    `  body words: ${spreadText(words)}`,
    `  sections: ${spreadText(sections)}`,
    `  thinnest section words: ${spreadText(thinnestSection)}`,
    `  shortest: ${shortest.id}, ${shortest.words} words, which sets the floor`,
    `  limits: ${JSON.stringify(limits[format])}`,
  ];
}

const describe = (measured) => [
  leftOutLine(measured.left),
  ...FORMATS.flatMap((format) => describeFormat(format, measured)),
];

function writeRecord(repoRoot, record) {
  const path = join(repoRoot, LENGTH_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
}

export function run({ write, repoRoot, today, out, err, exclude = generatedSlugs(repoRoot) }) {
  try {
    const measured = measureRepository(repoRoot, exclude);
    for (const line of describe(measured)) out(line);

    if (write) {
      writeRecord(repoRoot, lengthRecord({ measure: measured.fresh, limits: measured.limits, measuredOn: today }));
      out(`wrote ${LENGTH_FILE}`);
      return 0;
    }

    const problems = recordProblems(readLengthRecord(repoRoot), measured.fresh);
    for (const { rule, detail } of problems) err(`ENTRY-LENGTH ${rule} ${LENGTH_FILE}: ${detail}`);
    if (problems.length === 0) out(`${LENGTH_FILE} matches a fresh measurement`);
    else err(`ENTRY-LENGTH the record is out of date; re-measure with: ${REMEASURE_COMMAND}`);
    return problems.length === 0 ? 0 : 1;
  } catch (error) {
    if (!(error instanceof LengthError)) throw error;
    err(`ENTRY-LENGTH ${error.message}`);
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
