import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { COLLECTION_OF, proseBlocks, wordCount } from './entry-prose.mjs';
import { FORMATS, byFormat, formatOf, quantile } from './sentence-band.mjs';

export const LENGTH_FILE = 'audits/entry-length.json';
export const REMEASURE_COMMAND = 'node scripts/measure-entry-length.mjs --write';

export class LengthError extends Error {}

export const LENGTH_RULES = Object.freeze(['body-too-short', 'too-few-sections', 'section-too-thin']);

const SECTION_OPENING = /^\s{0,3}##(?!#)(?:\s|$)/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^\s{0,3}(`{3,}|~{3,})\s*$/;
const COMMENT = /<!--[\s\S]*?-->/g;

const STALE_RULES = {
  schema: 'length-record-schema-stale',
  corpus: 'length-record-corpus-stale',
  distribution: 'length-record-distribution-stale',
  limits: 'length-record-limits-stale',
};

const headingOf = (line) =>
  line
    .replace(/^\s{0,3}##\s*/, '')
    .replace(/\s+#+\s*$/, '')
    .trim();

function splitSections(body) {
  const preface = [];
  const sections = [];
  let open = preface;
  let fence = null;
  for (const line of body.replace(COMMENT, '').split(/\r?\n/)) {
    if (fence) {
      const closing = FENCE_CLOSE.exec(line)?.[1];
      if (closing && closing[0] === fence[0] && closing.length >= fence.length) fence = null;
      open.push(line);
      continue;
    }
    fence = FENCE.exec(line)?.[1] ?? null;
    if (fence === null && SECTION_OPENING.test(line)) {
      open = [];
      sections.push({ heading: headingOf(line), lines: open });
    } else open.push(line);
  }
  return { preface: preface.join('\n'), sections };
}

const wordsOf = (collection, text) =>
  proseBlocks({ collection, frontmatter: {}, body: text }).reduce((total, block) => total + wordCount(block), 0);

export function bodyProfile({ collection, body }) {
  const { preface, sections } = splitSections(body);
  const measured = sections.map(({ heading, lines }) => ({ heading, words: wordsOf(collection, lines.join('\n')) }));
  return {
    words: wordsOf(collection, preface) + measured.reduce((total, { words }) => total + words, 0),
    sections: measured,
  };
}

function spread(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    p25: quantile(sorted, 25),
    p50: quantile(sorted, 50),
    p75: quantile(sorted, 75),
    max: sorted.at(-1),
  };
}

function profileOf({ collection, body }) {
  const { words, sections } = bodyProfile({ collection, body });
  return {
    words,
    sections: sections.length,
    thinnest: sections.length === 0 ? 0 : Math.min(...sections.map((section) => section.words)),
  };
}

const distributionOf = (profiles) =>
  profiles.length === 0
    ? null
    : {
        words: spread(profiles.map(({ words }) => words)),
        sections: spread(profiles.map(({ sections }) => sections)),
        thinnestSection: spread(profiles.map(({ thinnest }) => thinnest)),
      };

export function measureLength(entries) {
  const profiles = entries.map((entry) => ({ format: formatOf(entry.collection), ...profileOf(entry) }));
  const inFormat = (format) => profiles.filter((profile) => profile.format === format);
  return {
    corpus: byFormat((format) => ({ entries: inFormat(format).length })),
    distribution: byFormat((format) => distributionOf(inFormat(format))),
  };
}

const unbroken = (count) => Array(count).fill('word').join(' ');

const degenerateBodies = ({ wordsFloor }) => [
  { described: 'an empty body', body: '' },
  { described: `a body of ${wordsFloor} words with no section`, body: unbroken(wordsFloor) },
];

function admittedBody(limits) {
  const collection = COLLECTION_OF[limits.format];
  return degenerateBodies(limits).find(({ body }) => lengthProblems({ collection, body, limits }).length === 0);
}

export function deriveLimit({ corpus, distribution }, format) {
  if (corpus[format].entries === 0)
    throw new LengthError(`no ${format} entry has been measured, so there is nothing to derive a floor from`);

  const { words, sections, thinnestSection } = distribution[format];
  const limits = {
    format,
    wordsFloor: words.min,
    targetFrom: words.p25,
    targetTo: words.p75,
    sectionsFloor: sections.min,
    sectionWordsFloor: thinnestSection.min,
  };
  const admitted = admittedBody(limits);
  if (admitted !== undefined)
    throw new LengthError(
      `the derived ${format} limits admit ${admitted.described}, because a hand-written ${format} has no section ` +
        'or no words; fix that entry or the measurement before a floor rests on it'
    );
  return limits;
}

export const deriveLimits = (measure) => byFormat((format) => deriveLimit(measure, format));

export const lengthRecord = ({ measure, limits, measuredOn }) => ({
  schema: 1,
  measuredOn,
  corpus: measure.corpus,
  distribution: measure.distribution,
  limits,
});

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function wordsProblem({ words, limits }) {
  const { format, wordsFloor, targetFrom, targetTo } = limits;
  return words >= wordsFloor
    ? []
    : [
        {
          rule: 'body-too-short',
          detail:
            `the body has ${words} words; no hand-written ${format} has fewer than ${wordsFloor}, and the middle ` +
            `half of them run ${targetFrom} to ${targetTo}. Reach the length with more sections that each answer ` +
            'one more question a buyer asks, never with longer sentences or a restated field',
        },
      ];
}

const sectionCountProblem = ({ sections, limits: { format, sectionsFloor } }) =>
  sections.length >= sectionsFloor
    ? []
    : [
        {
          rule: 'too-few-sections',
          detail: `the body has ${plural(sections.length, 'section')} (## headings); every hand-written ${format} has at least ${sectionsFloor}`,
        },
      ];

function thinSectionProblem({ sections, limits: { format, sectionWordsFloor } }) {
  const thin = sections.filter(({ words }) => words < sectionWordsFloor);
  if (thin.length === 0) return [];
  const named = thin.map(({ heading, words }) => `"${heading}" has ${words}`).join(', ');
  return [
    {
      rule: 'section-too-thin',
      detail: `${plural(thin.length, 'section')} under ${sectionWordsFloor} words, the fewest any hand-written ${format} section holds: ${named}`,
    },
  ];
}

export function lengthProblems({ collection, body, limits }) {
  const { words, sections } = bodyProfile({ collection, body });
  return [
    ...wordsProblem({ words, limits }),
    ...sectionCountProblem({ sections, limits }),
    ...thinSectionProblem({ sections, limits }),
  ];
}

export function lengthFor(record, format) {
  if (!record) throw new LengthError(`${LENGTH_FILE} does not exist; measure it with: ${REMEASURE_COMMAND}`);
  const limits = record.limits ?? {};
  if (!Object.hasOwn(limits, format))
    throw new LengthError(
      `${LENGTH_FILE} holds no length limits for the format "${format}"; it holds ${Object.keys(limits).join(', ')}`
    );
  return limits[format];
}

const describeCorpus = (corpus) => FORMATS.map((format) => `${corpus?.[format]?.entries} ${format} entries`).join(', ');

const staleDetail = (key, found, wanted) =>
  key === 'corpus'
    ? `the record measured ${describeCorpus(found)}; the corpus now has ${describeCorpus(wanted)}`
    : `the recorded ${key} differs from a fresh measurement of the corpus`;

export function recordProblems(record, fresh) {
  if (!record) return [{ rule: 'length-record-missing', detail: `${LENGTH_FILE} does not exist` }];

  const expected = lengthRecord({ measure: fresh, limits: deriveLimits(fresh), measuredOn: record.measuredOn });
  return Object.entries(STALE_RULES)
    .filter(([key]) => !isDeepStrictEqual(record[key], expected[key]))
    .map(([key, rule]) => ({ rule, detail: staleDetail(key, record[key], expected[key]) }));
}

export function shortestEntry(entries, format) {
  const ranked = entries
    .filter(({ collection }) => formatOf(collection) === format)
    .map(({ id, collection, body }) => ({ id, words: bodyProfile({ collection, body }).words }))
    .sort((a, b) => a.words - b.words);
  return ranked[0] ?? null;
}

export function readLengthRecord(repoRoot) {
  const path = join(repoRoot, LENGTH_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new LengthError(`${LENGTH_FILE} is not readable JSON: ${error.message}`);
  }
}
