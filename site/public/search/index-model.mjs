const MINIMUM_WORD_LENGTH = 2;

const TITLE_WEIGHT = 8;
const DESCRIPTION_WEIGHT = 3;
const TEXT_WEIGHT = 1;

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

const stripMarkdown = (markdown) =>
  collapse(
    markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_>]/g, '')
  );

const withoutTrailingSlash = (href) => (href.length > 1 ? href.replace(/\/$/, '') : href);

export function buildIndexEntry({ href, title, description, kind, body }) {
  return {
    href: withoutTrailingSlash(href),
    title,
    description: collapse(description),
    kind,
    text: stripMarkdown(body ?? ''),
  };
}

export function queryWords(query) {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MINIMUM_WORD_LENGTH);
}

const countMatches = (haystack, word) => {
  const pattern = new RegExp(`\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gu');
  return (haystack.toLowerCase().match(pattern) ?? []).length;
};

export function scoreEntry(entry, words) {
  let score = 0;

  for (const word of words) {
    const title = countMatches(entry.title, word);
    const description = countMatches(entry.description, word);
    const text = countMatches(entry.text, word);
    if (title + description + text === 0) return 0;

    score += title * TITLE_WEIGHT + description * DESCRIPTION_WEIGHT + text * TEXT_WEIGHT;
  }

  return score;
}

export function rankEntries(entries, query) {
  const words = queryWords(query);
  if (words.length === 0) return [];

  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, words) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.href.localeCompare(b.entry.href))
    .map(({ entry }) => entry);
}

export function excerptFor(entry, query) {
  const [word] = queryWords(query);
  if (!word) return entry.description;

  const haystack = entry.text || entry.description;
  const position = haystack.toLowerCase().search(new RegExp(`\\b${word}`, 'u'));
  if (position < 0) return entry.description;

  const start = Math.max(0, position - 60);
  const slice = haystack.slice(start, start + 220).trim();
  return `${start > 0 ? '…' : ''}${slice}${start + 220 < haystack.length ? '…' : ''}`;
}
