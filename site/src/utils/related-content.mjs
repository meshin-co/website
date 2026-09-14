function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @typedef {{ name: string, href?: string, id?: string }} RelatedEntity
 */

/** @param {RelatedEntity} entity @returns {string} */
export function lastSignificantWord(entity) {
  return entity.name.trim().split(/\s+/).pop()?.toLowerCase() ?? '';
}

/**
 * @template {{ id: string }} T
 * @param {string[]} ids
 * @param {T[]} entries
 * @returns {T[]}
 */
export function resolveByIds(ids, entries) {
  return ids.flatMap((id) => {
    const found = entries.find((entry) => entry.id === id);
    return found ? [found] : [];
  });
}

/**
 * @template {RelatedEntity} T
 * @param {T[]} entities
 * @param {(entity: T) => string} [extractKeyword]
 * @returns {(T & { keyword: string })[]}
 */
export function distinctByKeyword(entities, extractKeyword = lastSignificantWord) {
  const counts = new Map();
  const withKeyword = entities.map((entity) => {
    const keyword = extractKeyword(entity);
    counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    return { ...entity, keyword };
  });
  return withKeyword.filter((entity) => entity.keyword.length > 2 && counts.get(entity.keyword) === 1);
}

/** @param {string} text @param {string} keyword @returns {boolean} */
export function textMentionsKeyword(text, keyword) {
  if (!text || !keyword) return false;
  return new RegExp(`(?<![\\w])${escapeRegExp(keyword)}(?![\\w])`, 'iu').test(text);
}

/**
 * @param {string} text
 * @param {RelatedEntity[]} candidates
 * @returns {{ before: string, matched: string, after: string, href?: string } | null}
 */
export function firstMention(text, candidates) {
  if (!text || !candidates?.length) return null;
  let best = null;
  for (const candidate of candidates) {
    if (!candidate.name) continue;
    const pattern = new RegExp(`(?<![\\w])${escapeRegExp(candidate.name)}(?![\\w])`, 'iu');
    const match = pattern.exec(text);
    if (match && (!best || match.index < best.index)) {
      best = { index: match.index, length: match[0].length, matchedText: match[0], href: candidate.href };
    }
  }
  if (!best) return null;
  return {
    before: text.slice(0, best.index),
    matched: best.matchedText,
    after: text.slice(best.index + best.length),
    href: best.href,
  };
}
