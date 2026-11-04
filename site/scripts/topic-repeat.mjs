import { isHolding } from './autowriter-claims.mjs';
import { FUNCTION_WORDS } from './search-demand-rows.mjs';

export const REPEAT_THRESHOLD = 0.5;

const IGNORED_WORDS = new Set([...FUNCTION_WORDS, 'your', 'you', 'into']);
const MIN_FOLDED_LENGTH = 5;
const MIN_STEM_LENGTH = 3;
const PLURAL_ENDINGS = [
  [/ies$/, 'y'],
  [/(?<=s|x|z|ch|sh)es$/, ''],
  [/(?<![su])s$/, ''],
];
const VERB_ENDINGS = [
  [/ied$/, 'y'],
  [/(?:ing|ed)$/, ''],
];

function foldEnding(endings, word) {
  if (word.length < MIN_FOLDED_LENGTH) return word;
  const ending = endings.find(([pattern]) => pattern.test(word));
  if (!ending) return word;
  const folded = word.replace(ending[0], ending[1]);
  return folded.length >= MIN_STEM_LENGTH ? folded : word;
}

const withoutFinalE = (stem) => (stem.length > 3 && stem.endsWith('e') ? stem.slice(0, -1) : stem);

const stemOf = (word) => withoutFinalE(foldEnding(VERB_ENDINGS, foldEnding(PLURAL_ENDINGS, word)));

export const stemsOf = (text) =>
  new Set(
    text
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 1 && !IGNORED_WORDS.has(word))
      .map(stemOf)
  );

export function containment(first, second) {
  const smaller = Math.min(first.size, second.size);
  if (smaller === 0) return 0;
  let shared = 0;
  for (const stem of first) if (second.has(stem)) shared += 1;
  return shared / smaller;
}

export const subjectStems = ({ title, query }) => new Set([...stemsOf(title), ...stemsOf(query ?? '')]);

export function existingArticles({ posts, claims, now }) {
  const published = posts.map(({ route, title, query }) => ({ against: route, title, query }));
  const holding = claims
    .filter(({ claim }) => claim.format === 'article' && isHolding(claim, now))
    .map(({ path, claim }) => ({ against: path, title: claim.title, query: claim.query }));
  return [...published, ...holding];
}

function strongestOverlap(subject, existing) {
  let strongest = null;
  for (const article of existing) {
    const theirs = subjectStems(article);
    const ratio = containment(subject, theirs);
    if (ratio >= REPEAT_THRESHOLD && (strongest === null || ratio > strongest.ratio)) {
      strongest = { article, theirs, ratio };
    }
  }
  return strongest;
}

function repeatDetail(topic, subject, { article, theirs, ratio }) {
  const shared = [...subject].filter((stem) => theirs.has(stem)).sort();
  return (
    `the topic "${topic.title}" repeats ${article.against} ("${article.title}"): its subject shares ${shared.join(', ')}, ` +
    `${shared.length} of the ${Math.min(subject.size, theirs.size)} stems of the smaller one, ` +
    `a containment of ${ratio.toFixed(2)} against the threshold of ${REPEAT_THRESHOLD}`
  );
}

export function repeatRefusal({ topic, existing }) {
  const subject = subjectStems(topic);
  const strongest = strongestOverlap(subject, existing);
  if (!strongest) return null;
  return {
    reason: 'same-subject',
    against: strongest.article.against,
    detail: repeatDetail(topic, subject, strongest),
  };
}
