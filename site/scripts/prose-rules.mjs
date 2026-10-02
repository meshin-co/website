const PARAGRAPH_WORD_CAP = 75;
const SENTENCE_WORD_CAP = 40;

const ABBREVIATIONS = ['approx', 'e.g', 'i.e', 'etc', 'vs', 'no', 'fig', 'dr', 'mr', 'mrs', 'ms', 'prof', 'st'];

const SELF_CONTAINMENT_MARKERS = [
  'this article',
  'this post',
  'this guide',
  'this page',
  'in this article',
  'in this post',
  'in this guide',
  'below',
  'above',
  'we will',
  "we'll",
  'read on',
];

const words = (text) => text.split(/\s+/).filter(Boolean);

const isAbbreviationBoundary = (text, index) => {
  const before = text.slice(0, index).toLowerCase();
  const lastWord = before.split(/[\s(]/).pop() ?? '';
  if (ABBREVIATIONS.includes(lastWord.replace(/[^a-z.]/g, '').replace(/\.$/, ''))) return true;
  if (/\d$/.test(before) && /^\.\d/.test(text.slice(index))) return true;
  if (/(^|[\s(])[A-Z]$/.test(text.slice(0, index))) return true;
  return false;
};

export function splitSentences(text) {
  const normalised = text.replace(/\s+/g, ' ').trim();
  const sentences = [];
  let start = 0;

  for (let index = 0; index < normalised.length; index += 1) {
    if (!'.!?'.includes(normalised[index])) continue;
    if (normalised[index] === '.' && isAbbreviationBoundary(normalised, index)) continue;

    let end = index + 1;
    while (end < normalised.length && '.!?"\u2019\u201d)'.includes(normalised[end])) end += 1;
    if (end < normalised.length && normalised[end] !== ' ') continue;

    const sentence = normalised.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
  }

  const tail = normalised.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

export function sentenceLengths(text) {
  const counts = splitSentences(text).map((sentence) => words(sentence).length);
  if (counts.length === 0) return { median: 0, max: 0, longest: '' };

  const sorted = [...counts].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
  const max = sorted.at(-1);
  const longest = splitSentences(text)[counts.indexOf(max)] ?? '';

  return { median, max, longest };
}

export function paragraphViolations(paragraphs) {
  const findings = [];

  for (const paragraph of paragraphs) {
    const count = words(paragraph).length;
    if (count > PARAGRAPH_WORD_CAP) {
      findings.push({ rule: 'paragraph-words', count, excerpt: paragraph.slice(0, 80) });
      continue;
    }

    const { max, longest } = sentenceLengths(paragraph);
    if (max > SENTENCE_WORD_CAP) findings.push({ rule: 'sentence-length', count: max, excerpt: longest.slice(0, 80) });
  }

  return findings;
}

export function bannedPhraseHits(text, phrases) {
  const hits = [];

  for (const phrase of phrases) {
    const pattern = new RegExp(`(^|[^\\p{L}])(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([^\\p{L}]|$)`, 'giu');
    const match = pattern.exec(text);
    if (!match) continue;

    const at = match.index + match[1].length;
    hits.push({ phrase, excerpt: text.slice(Math.max(0, at - 30), at + phrase.length + 30).trim() });
  }

  return hits;
}

export function selfContainmentIssues(text) {
  const lowered = text.toLowerCase();
  const found = SELF_CONTAINMENT_MARKERS.filter((marker) =>
    new RegExp(`(^|[^\\p{L}])${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(lowered)
  );

  return found.filter((marker) => !found.some((other) => other !== marker && other.includes(marker)));
}

export function duplicateSentences(pages, minimumWords) {
  const seen = new Map();

  for (const { route, text } of pages) {
    for (const sentence of splitSentences(text)) {
      if (words(sentence).length < minimumWords) continue;
      const key = sentence.toLowerCase();
      const routes = seen.get(key) ?? [];
      if (!routes.includes(route)) routes.push(route);
      seen.set(key, routes);
    }
  }

  return [...seen.entries()]
    .filter(([, routes]) => routes.length > 1)
    .map(([sentence, routes]) => ({ sentence, routes }));
}

const MACHINE_PATTERNS = [
  {
    rule: 'formulaic-transition',
    pattern: /(^|[.!?]\s+|\s)(moreover|furthermore|additionally|in conclusion|in summary|as such)\b/gi,
  },
  { rule: 'not-only-but-also', pattern: /\bnot only\b[^.!?]{0,80}\bbut also\b/gi },
  { rule: 'guide-preamble', pattern: /\b(this (guide|article|post|page) will|in this (guide|article|post),? we)\b/gi },
  {
    rule: 'hollow-credential',
    pattern:
      /\b(industry-leading|leading (provider|expert|authority)|passionate about|deeply passionate|thought leader)\b/gi,
  },
];

const DENSITY_RULES = [
  { rule: 'semicolon-density', pattern: /;/g, minimum: 3, perThousand: 6 },
  { rule: 'em-dash-density', pattern: /—/g, minimum: 3, perThousand: 6 },
];

export function machinePatternHits(text) {
  return MACHINE_PATTERNS.flatMap(({ rule, pattern }) =>
    [...text.matchAll(pattern)].map((match) => ({ rule, excerpt: match[0].trim() }))
  );
}

export function punctuationFindings(text) {
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  return DENSITY_RULES.flatMap(({ rule, pattern, minimum, perThousand }) => {
    const count = (text.match(pattern) ?? []).length;
    const density = (count / words) * 1000;
    return count >= minimum && density > perThousand
      ? [{ rule, excerpt: `${count} in ${words} words`, detail: `${density.toFixed(1)} per 1000, cap ${perThousand}` }]
      : [];
  });
}

export function questionRunLength(text) {
  let run = 0;
  let longest = 0;
  for (const sentence of splitSentences(text)) {
    run = sentence.trim().endsWith('?') ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}
