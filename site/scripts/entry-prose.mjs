import { parse } from 'yaml';

import { readEngineConfig } from './engine-config.mjs';
import { splitSentences } from './prose-rules.mjs';

const { formats } = readEngineConfig().content;

export const COLLECTION_OF = Object.freeze({ term: formats.term.collection, article: formats.article.collection });
export const RESOURCE_COLLECTION = formats.article.resourceCollection;

const FRONTMATTER_PROSE = {
  [COLLECTION_OF.article]: ({ shortAnswer, fullAnswer, keyTakeaways, faq }) => [
    shortAnswer,
    fullAnswer,
    ...(keyTakeaways ?? []),
    ...(faq ?? []).map(({ a }) => a),
  ],
  [COLLECTION_OF.term]: ({ shortDefinition, definition }) => [shortDefinition, definition],
};

const SOURCE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const COMMENT = /<!--[\s\S]*?-->/g;
const QUOTE_MARKERS = /^\s{0,3}(?:>\s?)+/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^\s{0,3}(`{3,}|~{3,})\s*$/;
const HEADING = /^\s{0,3}#{1,6}(?:\s|$)/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_ROW = /^\s*\|/;
const SEPARATOR_CELL = /^:?-+:?$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;

const LINK_TARGET = String.raw`(?:\((?:[^()]|\([^()]*\))*\)|\[[^\]]*\])`;

const INLINE_RULES = [
  [new RegExp(String.raw`!\[[^\]]*\]${LINK_TARGET}`, 'g'), ''],
  [new RegExp(String.raw`\[([^\]]*)\]${LINK_TARGET}`, 'g'), '$1'],
  [/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, '$1'],
  [/<br\s*\/?>/gi, ' '],
  [/<\/?[a-zA-Z][^>]*>/g, ''],
  [/`+([^`]+)`+/g, '$1'],
  [/\*{1,3}(?=\S)([^*]+?)(?<=\S)\*{1,3}/g, '$1'],
  [/(?<![\p{L}\p{N}_])_{1,2}(?=\S)([^_]+?)(?<=\S)_{1,2}(?![\p{L}\p{N}_])/gu, '$1'],
  [/~~([^~]+)~~/g, '$1'],
  [/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1'],
];

const inlineText = (markdown) =>
  INLINE_RULES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), markdown)
    .replace(/\s+/g, ' ')
    .trim();

const tableCells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim())
    .filter((cell) => !SEPARATOR_CELL.test(cell));

function markdownBlocks(markdown) {
  const blocks = [];
  let open = [];
  let fence = null;
  const close = () => {
    if (open.length > 0) blocks.push(open.join(' '));
    open = [];
  };

  for (const raw of markdown.replace(COMMENT, '').split(/\r?\n/)) {
    const line = raw.replace(QUOTE_MARKERS, '');
    if (fence) {
      const closing = FENCE_CLOSE.exec(line)?.[1];
      if (closing && closing[0] === fence[0] && closing.length >= fence.length) fence = null;
      continue;
    }
    const opening = FENCE.exec(line)?.[1];
    const item = LIST_ITEM.exec(line);
    if (opening) {
      close();
      fence = opening;
    } else if (line.trim() === '' || HEADING.test(line) || RULE.test(line)) {
      close();
    } else if (TABLE_ROW.test(line)) {
      close();
      blocks.push(...tableCells(line));
    } else if (item) {
      close();
      open = [item[1]];
    } else {
      open.push(line.trim());
    }
  }
  close();

  return blocks.map(inlineText).filter(Boolean);
}

export function parseEntrySource(raw) {
  const split = SOURCE.exec(raw.replace(/\r\n/g, '\n'));
  if (!split) throw new Error('the entry has no front matter block between --- lines');
  return { frontmatter: parse(split[1]) ?? {}, body: split[2] };
}

export function proseBlocks({ collection, frontmatter, body }) {
  const fields = FRONTMATTER_PROSE[collection];
  if (!fields) throw new Error(`no prose fields are defined for the collection "${collection}"`);
  return [...fields(frontmatter), body].filter((text) => typeof text === 'string').flatMap(markdownBlocks);
}

export const proseSentences = (blocks) => blocks.flatMap(splitSentences);

export const wordCount = (sentence) => sentence.split(/\s+/).filter(Boolean).length;
