import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { pageBody, stripTags } from './content-html.mjs';
import { discoverRoutes } from './gate.mjs';
import { splitSentences } from './prose-rules.mjs';

export const GRADE_MAX = 14;
export const READING_EASE_MIN = 30;
export const SENTENCE_AVERAGE_MAX = 25;
export const SENTENCE_LONGEST_MAX = 45;
export const LONG_WORD_SHARE_MAX = 0.3;
export const PASSIVE_SHARE_MAX = 0.6;
export const SENTENCE_VARIANCE_MIN = 6;
export const PARAGRAPH_VARIANCE_MIN = 5;
export const LIST_MINIMUM_FOR_VARIETY = 3;
export const HEADING_MINIMUM_FOR_VARIETY = 3;
export const SENTENCE_MINIMUM_FOR_READABILITY = 3;
export const SENTENCE_MINIMUM_FOR_VARIANCE = 8;
export const PARAGRAPH_MINIMUM_FOR_VARIANCE = 3;

const UNGATED = new Set(['/404', '/search', '/styleguide']);
const UNGATED_PATTERNS = [/^\/blog\/page\/\d+$/, /^\/blog\/category\/[^/]+\/page\/\d+$/];
const EXCERPT_LENGTH = 100;

const VOWEL_GROUPS = /[aeiouy]+/g;
const AUXILIARY = "(?:am|is|are|was|were|be|been|being)(?:n['’]t)?";
const ADVERB = '(?:\\w+ly|not|never|also|always|often|still|just|only|already)';
const PARTICIPLE =
  '(?:[\\w-]{2,}ed|written|taken|given|chosen|broken|hidden|stolen|spoken|seen|shown|known|built|done|found|held|kept|made|paid|read|left|sent|set|sold|spent|told|lost)';
const PASSIVE = new RegExp(`\\b${AUXILIARY}\\s+(?:${ADVERB}\\s+)*${PARTICIPLE}\\b`, 'i');
const ANTITHESIS = /\b(?:not|\w+n['’]t)\b[^.!?]{1,80}?(?:[,;:—–]|\s-)\s*(?:it['’]s|it is)\b(?!\s+not\b)/i;
const BOLD_LEAD = /<li\b[^>]*>\s*(?:<p\b[^>]*>\s*)?<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const SEQUENCE_UNIT =
  '(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:day|week|month|quarter|step|phase|stage)s?\\s*\\d+|\\d+(?:st|nd|rd|th)?)';
const SEQUENCE_LABEL = new RegExp(`^${SEQUENCE_UNIT}(?:\\s*(?:,|and|to|through|&|[-–])\\s*${SEQUENCE_UNIT})*$`, 'i');
const LABEL_PUNCTUATION = /[\s.:;,]+$/;
const SYMBOL_LEAD =
  /<li\b[^>]*>\s*(?:<p\b[^>]*>\s*)?[\p{Extended_Pictographic}\p{So}\u2022\u2023\u2043\u2219\u2190-\u21FF]/u;
const SENTENCE_BLOCK = /<(p|li|td|dd)\b[^>]*>((?:(?!<\/?(?:p|li|td|dd|ul|ol|table|tr|h[1-6])\b)[\s\S])*)<\/\1>/gi;
const SENTENCE_END = /[.!?]["'’”)]*$/;
const LIST_BLOCK = /<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const SUB_HEADING = /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

const words = (text) => text.split(/\s+/).filter(Boolean);
const excerptOf = (text) => text.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_LENGTH);

export function syllablesIn(word) {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return 0;
  const groups = letters.match(VOWEL_GROUPS)?.length ?? 0;
  if (groups <= 1) return Math.max(1, groups);
  if (letters.endsWith('e') && !letters.endsWith('le')) return groups - 1;
  return groups;
}

const isPassive = (sentence) => PASSIVE.test(sentence);

export function sentenceStats(text) {
  const sentences = splitSentences(text);
  const counts = sentences.map((sentence) => words(sentence).length);
  const wordList = sentences.flatMap((sentence) => words(sentence));
  const total = wordList.length;
  const average = sentences.length ? total / sentences.length : 0;
  const variance =
    counts.length > 1 ? counts.reduce((sum, count) => sum + (count - average) ** 2, 0) / counts.length : 0;
  const syllables = wordList.reduce((sum, word) => sum + syllablesIn(word), 0);
  const longest = counts.length ? Math.max(...counts) : 0;
  return {
    sentences: sentences.length,
    words: total,
    syllables,
    average,
    longest,
    longestSentence: sentences[counts.indexOf(longest)] ?? '',
    variance,
    longWordShare: total ? wordList.filter((word) => syllablesIn(word) >= 3).length / total : 0,
    passiveShare: sentences.length ? sentences.filter(isPassive).length / sentences.length : 0,
    grade: total && sentences.length ? 0.39 * average + 11.8 * (syllables / total) - 15.59 : 0,
    ease: total && sentences.length ? 206.835 - 1.015 * average - 84.6 * (syllables / total) : 0,
  };
}

const stdev = (values) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
};

export function controlledWordHits(text, controlled) {
  const hits = [];
  for (const [word, use] of Object.entries(controlled ?? {})) {
    const pattern = new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'giu');
    if (pattern.test(text)) hits.push({ rule: 'controlled-word', detail: `${word} → ${use}` });
  }
  return hits;
}

function boldedLead(html) {
  for (const [, , inner] of html.matchAll(BOLD_LEAD)) {
    const label = stripTags(inner).replace(LABEL_PUNCTUATION, '');
    if (!SEQUENCE_LABEL.test(label)) return label;
  }
  return null;
}

const hasEnoughProse = ({ text = '', prose = text }) =>
  sentenceStats(prose).sentences >= SENTENCE_MINIMUM_FOR_READABILITY;

function readabilityFindings(stats) {
  const findings = [];
  if (stats.grade > GRADE_MAX)
    findings.push({ rule: 'reading-grade', detail: `${stats.grade.toFixed(1)} > ${GRADE_MAX}` });
  if (stats.ease < READING_EASE_MIN)
    findings.push({ rule: 'reading-ease', detail: `${stats.ease.toFixed(1)} < ${READING_EASE_MIN}` });
  if (stats.average > SENTENCE_AVERAGE_MAX)
    findings.push({ rule: 'sentence-average', detail: `${stats.average.toFixed(1)} > ${SENTENCE_AVERAGE_MAX}` });
  if (stats.longest > SENTENCE_LONGEST_MAX)
    findings.push({
      rule: 'sentence-longest',
      detail: `${stats.longest} > ${SENTENCE_LONGEST_MAX}`,
      excerpt: excerptOf(stats.longestSentence),
    });
  if (stats.longWordShare > LONG_WORD_SHARE_MAX)
    findings.push({
      rule: 'long-word-share',
      detail: `${(stats.longWordShare * 100).toFixed(1)}% > ${(LONG_WORD_SHARE_MAX * 100).toFixed(0)}%`,
    });
  if (stats.passiveShare > PASSIVE_SHARE_MAX)
    findings.push({
      rule: 'passive-voice',
      detail: `${(stats.passiveShare * 100).toFixed(0)}% passive > ${(PASSIVE_SHARE_MAX * 100).toFixed(0)}%`,
    });
  return findings;
}

export function humanFindings(
  { route, text = '', prose = text, paragraphs = [], headings = [], lists = [], html = '' },
  controlled
) {
  const findings = [];

  if (hasEnoughProse({ prose })) findings.push(...readabilityFindings(sentenceStats(prose)));

  const rhythm = sentenceStats(paragraphs.join(' '));
  if (rhythm.sentences >= SENTENCE_MINIMUM_FOR_VARIANCE && rhythm.variance < SENTENCE_VARIANCE_MIN)
    findings.push({ rule: 'sentence-variance', detail: `${rhythm.variance.toFixed(1)} < ${SENTENCE_VARIANCE_MIN}` });

  if (paragraphs.length >= PARAGRAPH_MINIMUM_FOR_VARIANCE) {
    const spread = stdev(paragraphs.map((paragraph) => words(paragraph).length));
    if (spread < PARAGRAPH_VARIANCE_MIN)
      findings.push({ rule: 'paragraph-variance', detail: `${spread.toFixed(1)} < ${PARAGRAPH_VARIANCE_MIN}` });
  }

  if (lists.length >= LIST_MINIMUM_FOR_VARIETY && new Set(lists).size < 2) {
    findings.push({ rule: 'list-variety', detail: `${lists.length} lists, one length` });
  }

  const openers = headings.map((heading) => words(heading)[0]?.toLowerCase()).filter(Boolean);
  if (openers.length >= HEADING_MINIMUM_FOR_VARIETY && new Set(openers).size < 2) {
    findings.push({ rule: 'heading-variety', detail: `${openers.length} headings open on ${openers[0]}` });
  }

  const antithesis = ANTITHESIS.exec(text);
  if (antithesis)
    findings.push({ rule: 'antithesis-template', detail: 'not X, it is Y', excerpt: excerptOf(antithesis[0]) });

  const lead = boldedLead(html);
  if (lead !== null)
    findings.push({ rule: 'bolded-lead', detail: 'list item opens in bold', excerpt: excerptOf(lead) });

  const symbol = SYMBOL_LEAD.exec(html);
  if (symbol)
    findings.push({
      rule: 'emoji-bullet',
      detail: 'list item opens with a symbol',
      excerpt: excerptOf(stripTags(html.slice(symbol.index, symbol.index + EXCERPT_LENGTH))),
    });

  findings.push(...controlledWordHits(text, controlled));
  return findings.map((finding) => ({ route, ...finding }));
}

function sentenceBlocks(body) {
  const blocks = [];
  for (const [, tag, inner] of body.matchAll(SENTENCE_BLOCK)) {
    const text = stripTags(inner);
    if (SENTENCE_END.test(text)) blocks.push({ tag: tag.toLowerCase(), text });
  }
  return blocks;
}

export function pageFromHtml(route, source) {
  const body = pageBody(source);
  const blocks = sentenceBlocks(body);
  return {
    route,
    text: stripTags(body),
    prose: blocks.map((block) => block.text).join(' '),
    paragraphs: blocks.filter((block) => block.tag === 'p').map((block) => block.text),
    headings: [...body.matchAll(SUB_HEADING)].map(([, , inner]) => stripTags(inner)),
    lists: [...body.matchAll(LIST_BLOCK)].map(([, , items]) => items.split(/<li\b/).length - 1),
    html: body,
  };
}

const CONTROLLED_WORDS = new URL('../controlled-words.json', import.meta.url);
const routeFile = (route) => (route === '/404' ? '404.html' : join(route.slice(1), 'index.html'));

export async function runGate(distDir) {
  const controlled = JSON.parse(await readFile(CONTROLLED_WORDS, 'utf8'));
  const findings = [];
  let checked = 0;
  let measured = 0;

  for (const route of await discoverRoutes(distDir)) {
    if (UNGATED.has(route) || UNGATED_PATTERNS.some((pattern) => pattern.test(route))) continue;
    const page = pageFromHtml(route, await readFile(join(distDir, routeFile(route)), 'utf8'));
    checked += 1;
    if (hasEnoughProse(page)) measured += 1;
    findings.push(...humanFindings(page, controlled));
  }

  if (checked === 0)
    findings.push({ route: distDir, rule: 'no-pages', detail: 'no built page was found, so nothing was checked' });
  else if (measured === 0)
    findings.push({
      route: distDir,
      rule: 'nothing-measured',
      detail: `no page had ${SENTENCE_MINIMUM_FOR_READABILITY} sentences of prose, so reading level was never graded`,
    });

  return { checked, measured, findings };
}

export function reportLines({ checked, measured, findings }) {
  return [
    `human: ${checked} pages checked, ${measured} measured for reading level, ${findings.length} findings`,
    ...findings.map(
      ({ route, rule, detail, excerpt }) => `HUMAN ${route} ${rule}: ${detail}${excerpt ? ` | ${excerpt}` : ''}`
    ),
  ];
}
