const TITLE_WEIGHT = 8;
const DESCRIPTION_WEIGHT = 3;
const TEXT_WEIGHT = 1;

const words = (query) =>
  query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2);

const countMatches = (haystack, word) => {
  const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gu');
  return (haystack.toLowerCase().match(pattern) ?? []).length;
};

export function scanScore(entry, query) {
  let score = 0;

  for (const word of words(query)) {
    const title = countMatches(entry.title, word);
    const description = countMatches(entry.description, word);
    const text = countMatches(entry.text, word);
    if (title + description + text === 0) return 0;

    score += title * TITLE_WEIGHT + description * DESCRIPTION_WEIGHT + text * TEXT_WEIGHT;
  }

  return score;
}

export function scanRank(entries, query) {
  if (words(query).length === 0) return [];

  return entries
    .map((entry) => ({ entry, score: scanScore(entry, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.href.localeCompare(b.entry.href))
    .map(({ entry }) => entry);
}
