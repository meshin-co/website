export const TITLE_COVERAGE = 0.75;

const MIN_TITLE_WORDS = 2;
const MIN_WORD_LENGTH = 3;
const MISSING_WORDS_SHOWN = 5;
const LARGEST_CODE_POINT = 0x10ffff;

const spaceSeparated = (list) => list.split(' ');
const STOP_WORDS = new Set([
  ...spaceSeparated('the and for with from that this are was not but has have its into our your per you who how'),
  ...spaceSeparated('what when where which will would could should can may might than then them they their there'),
  ...spaceSeparated('these those about over under between through also such each other some any all via been'),
  ...spaceSeparated('being were had does did'),
]);

const HIDDEN =
  /<!--(?:[\s\S]*?-->|[\s\S]*$)|<(script|style|noscript|template|svg)(?=[\s/>])[^>]*(?:>|$)(?:[\s\S]*?<\/\1\s*>|[\s\S]*$)/gi;
const TAG = /<\/?[a-z!?][^>]*(?:>|$)/gi;
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntity(whole, name) {
  if (name.startsWith('#')) {
    const hexadecimal = name[1] === 'x' || name[1] === 'X';
    const codePoint = hexadecimal ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return codePoint > 0 && codePoint <= LARGEST_CODE_POINT ? String.fromCodePoint(codePoint) : whole;
  }
  const key = name.toLowerCase();
  return Object.hasOwn(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : whole;
}

export function visibleText(html) {
  const source = typeof html === 'string' ? html : '';
  return source.replace(HIDDEN, ' ').replace(TAG, ' ').replace(ENTITY, decodeEntity).replace(/\s+/g, ' ').trim();
}

export function normalise(text) {
  const source = typeof text === 'string' ? text : '';
  return source
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const wordsOf = (text) =>
  normalise(text)
    .split(' ')
    .filter((word) => word !== '');

function titleWordsOf(title) {
  const candidates = wordsOf(title).filter((word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word));
  return [...new Set(candidates)];
}

const refused = (reason) => ({ ok: false, reason });

export function supportsCitation(input) {
  const { text, title, spans } = input ?? {};
  const wanted = titleWordsOf(title);
  if (wanted.length < MIN_TITLE_WORDS) return refused('the title is too short to check a page against');

  const page = normalise(text);
  const pageWords = new Set(page.split(' '));
  const missing = wanted.filter((word) => !pageWords.has(word));
  const coverage = (wanted.length - missing.length) / wanted.length;
  if (coverage < TITLE_COVERAGE) {
    return refused(
      `the page carries ${wanted.length - missing.length} of the ${wanted.length} title words ` +
        `(coverage ${coverage.toFixed(2)}, below ${TITLE_COVERAGE}); ` +
        `missing: ${missing.slice(0, MISSING_WORDS_SHOWN).join(', ')}`
    );
  }

  const quoted = (Array.isArray(spans) ? spans : []).filter((span) => normalise(span) !== '');
  const paddedPage = ` ${page} `;
  const absent = quoted.find((span) => !paddedPage.includes(` ${normalise(span)} `));
  if (absent !== undefined) return refused(`the page does not carry the quoted span: ${absent}`);

  return { ok: true, coverage, spansChecked: quoted.length };
}
