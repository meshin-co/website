import { brandFromDisk, titleSuffix } from './brand.mjs';
import { splitSentences } from '../../scripts/prose-rules.mjs';

const TEASER_MAX_CHARS = 140;
const DUPLICATE_SENTENCE_FLOOR_WORDS = 12;

export function firstSentence(text) {
  const trimmed = text.trim();
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(trimmed);
  return match ? match[0] : trimmed;
}

export function teaser(answer) {
  const sentence = firstSentence(answer);
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  if (words.length < DUPLICATE_SENTENCE_FLOOR_WORDS && sentence.length <= TEASER_MAX_CHARS) return sentence;

  const clause = clauseTrim(sentence, TEASER_MAX_CHARS, DUPLICATE_SENTENCE_FLOOR_WORDS);
  if (clause) return clause;

  const kept = [];
  for (const word of words) {
    if (kept.length === DUPLICATE_SENTENCE_FLOOR_WORDS - 1) break;
    if (kept.length > 0 && `${kept.join(' ')} ${word}.`.length > TEASER_MAX_CHARS) break;
    kept.push(word);
  }
  return `${kept.join(' ').replace(/[,;:.!?]+$/, '')}.`;
}

const TITLE_SUFFIX = titleSuffix(brandFromDisk());
const TITLE_MAX_CHARS = 70;
export const TITLE_ROOM_CHARS = TITLE_MAX_CHARS - TITLE_SUFFIX.length;

const COORDINATING_BOUNDARY = /\s*,\s*|\s+(?=(?:and|or|but)\s)/;

export function clauseTrim(text, maxChars, maxWords = Infinity) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars && trimmed.split(/\s+/).filter(Boolean).length < maxWords) return trimmed;
  const terminal = /[.!?]$/.test(trimmed) ? trimmed.slice(-1) : '.';
  const body = /[.!?]$/.test(trimmed) ? trimmed.slice(0, -1) : trimmed;
  const parts = body.split(COORDINATING_BOUNDARY).filter(Boolean);
  let best = null;
  let acc = '';
  for (const part of parts) {
    const candidate = acc ? `${acc}, ${part}` : part;
    const withTerminal = `${candidate}${terminal}`;
    const words = candidate.split(/\s+/).filter(Boolean).length;
    if (withTerminal.length > maxChars || words >= maxWords) break;
    acc = candidate;
    best = withTerminal;
  }
  return best;
}

export function pageTitle(question, shortTitle) {
  if (question.length <= TITLE_ROOM_CHARS) return question;
  if (shortTitle) return shortTitle;
  return clauseTrim(question, TITLE_ROOM_CHARS) ?? question;
}

export const DESCRIPTION_MIN_CHARS = 120;
export const DESCRIPTION_MAX_CHARS = 160;

export function faqDescription(question, answer) {
  const q = question.trim();
  const sentences = splitSentences(answer);
  const first = sentences[0] ?? answer.trim();

  if (first.length >= DESCRIPTION_MIN_CHARS && first.length <= DESCRIPTION_MAX_CHARS) return first;

  const base = first.length > DESCRIPTION_MAX_CHARS ? (clauseTrim(first, DESCRIPTION_MAX_CHARS) ?? first) : first;
  if (base.length >= DESCRIPTION_MIN_CHARS && base.length <= DESCRIPTION_MAX_CHARS) return base;

  let text = `${q} ${base}`;
  if (text.length > DESCRIPTION_MAX_CHARS) {
    text = clauseTrim(text, DESCRIPTION_MAX_CHARS) ?? text;
  }

  let index = 1;
  while (text.length < DESCRIPTION_MIN_CHARS && index < sentences.length) {
    const next = sentences[index];
    const withNext = `${text} ${next}`;
    if (withNext.length <= DESCRIPTION_MAX_CHARS) {
      text = withNext;
    } else {
      const room = DESCRIPTION_MAX_CHARS - text.length - 1;
      const trimmedNext = clauseTrim(next, room);
      if (trimmedNext) text = `${text} ${trimmedNext}`;
      break;
    }
    index += 1;
  }

  return text;
}

export function isDescriptionInRange(description) {
  return description.length >= DESCRIPTION_MIN_CHARS && description.length <= DESCRIPTION_MAX_CHARS;
}

export function faqMetadata(entry) {
  const { question, answer, description, shortTitle, publishDate, updatedDate, noindex } = entry;
  return {
    title: pageTitle(question, shortTitle),
    description: description ?? faqDescription(question, answer),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: 'article',
      article: {
        publishedTime: publishDate.toISOString(),
        modifiedTime: updatedDate.toISOString(),
      },
    },
  };
}
