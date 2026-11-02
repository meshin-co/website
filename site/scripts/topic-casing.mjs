import { generatedTitles } from './autowriter-claims.mjs';
import { readConceptRegister } from './topic-owners.mjs';

const TOKEN = /[\p{L}\p{N}]+/gu;
const UPPER = /\p{Lu}/u;

const tailOf = (token) => [...token].slice(1).join('');

const qualifies = (token) => [...token].length >= 2 && UPPER.test(tailOf(token));

function countSpellings(texts) {
  const spellings = new Map();
  for (const text of texts) {
    for (const [token] of text.matchAll(TOKEN)) {
      if (!qualifies(token)) continue;
      const key = token.toLowerCase();
      const counts = spellings.get(key) ?? new Map();
      counts.set(token, (counts.get(token) ?? 0) + 1);
      spellings.set(key, counts);
    }
  }
  return spellings;
}

function mostFrequent(counts) {
  let best = null;
  for (const [spelling, count] of counts) if (best === null || count > best.count) best = { spelling, count };
  return best.spelling;
}

export function casedForms(texts) {
  const forms = new Map();
  for (const [key, counts] of countSpellings(texts)) forms.set(key, mostFrequent(counts));
  return forms;
}

export function restoreCase(text, forms) {
  return text.replace(TOKEN, (token) => (UPPER.test(token) ? token : (forms.get(token.toLowerCase()) ?? token)));
}

export const casingTexts = (coreDoc) => [
  ...readConceptRegister(coreDoc).map(({ concept }) => concept),
  ...generatedTitles(coreDoc).map(({ title }) => title),
];
