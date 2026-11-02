import { TITLE_ROOM_CHARS } from '../src/utils/faq-meta.mjs';

const SUBJECT_MAX_WORDS = 6;
const SUBJECT_STOP_TOKENS = new Set('of between vs versus for in to with on at from by per and or'.split(' '));
const SUBJECT_BAD_FIRST_WORDS = new Set(
  (
    'difference differences best worst cheapest cost price pricing reason purpose point role impact benefit ' +
    'benefits example examples step steps rule rules requirement requirements obligation obligations deadline deadlines'
  ).split(' ')
);
const QUESTION_WORDS = new Set(
  'who whom whose why when where which what how do does did is are was were can could should would will shall may might'.split(
    ' '
  )
);

const DEFINITION_LEAD = /^what(?:'s| is| are)\s+(.+)$/i;
const DEFINITION_MEANING = /^what does\s+(.+?)\s+mean$/i;
const LEADING_ARTICLE = /^(a|an|the)(?:\s+|$)/i;
const PROCEDURAL_LEAD = /^(?:how to|steps to|step by step|ways to)(?=\s|$)/i;
const SINGLE_FINAL_S = /[^s]s$/i;

const withoutDoubleQuotes = (text) => text.replace(/["“”„″]/g, '');
const straightenApostrophes = (text) => text.replace(/[‘’‚′]/g, "'");
const collapse = (text) => text.replace(/\s+/g, ' ').trim();
const stripTerminators = (text) => text.replace(/[?.\s]+$/, '');
const firstWord = (text) => text.split(' ', 1)[0].toLowerCase();
const upperFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function kebab(text) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isTermSubject(subject) {
  const words = subject.split(' ').filter(Boolean);
  if (words.length < 1 || words.length > SUBJECT_MAX_WORDS) return false;
  if (SUBJECT_BAD_FIRST_WORDS.has(words[0].toLowerCase())) return false;
  return !words.some((word) => SUBJECT_STOP_TOKENS.has(word.toLowerCase()));
}

function definitionOf(text) {
  const match = DEFINITION_LEAD.exec(text) ?? DEFINITION_MEANING.exec(text);
  if (!match) return null;
  const lead = LEADING_ARTICLE.exec(match[1]);
  const subject = lead ? match[1].slice(lead[0].length) : match[1];
  if (!isTermSubject(subject)) return null;
  return { article: lead ? lead[1].toLowerCase() : null, subject };
}

function cueFrom({ original, normalized, definition }) {
  if (normalized === '') return null;
  if (definition) return 'definition';
  if (PROCEDURAL_LEAD.test(normalized)) return 'procedure';
  if (QUESTION_WORDS.has(firstWord(normalized)) || original.endsWith('?')) return 'question';
  return null;
}

function readWording(text) {
  const original = collapse(straightenApostrophes(withoutDoubleQuotes(text)));
  const normalized = stripTerminators(original);
  const definition = definitionOf(normalized);
  return { normalized, definition, cue: cueFrom({ original, normalized, definition }) };
}

export const cueOf = (text) => readWording(text).cue;

function termTopic({ article, subject }) {
  const plural = article !== 'a' && article !== 'an' && SINGLE_FINAL_S.test(subject);
  const lead = `What ${plural ? 'are' : 'is'} ${article === null ? '' : `${article} `}`;
  return { format: 'term', subject, title: `${lead}${subject}?`, slug: kebab(subject), query: subject.toLowerCase() };
}

function articleTopic(normalized, cue) {
  const title = upperFirst(normalized) + (cue === 'question' ? '?' : '');
  return { format: 'article', subject: null, title, slug: kebab(title), query: normalized.toLowerCase() };
}

export function topicFrom(text) {
  const { normalized, definition, cue } = readWording(text);
  const topic = definition ? termTopic(definition) : articleTopic(normalized, cue);
  if (topic.title.length > TITLE_ROOM_CHARS) return { format: null, reason: 'title-too-long' };
  if (topic.slug === '') return { format: null, reason: 'no-slug' };
  return topic;
}
