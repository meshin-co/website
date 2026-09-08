import { countWords } from './content-rules.mjs';

const WORDS_PER_MINUTE = 220;

export function readingTime(markdown) {
  const words = countWords(markdown.replace(/[#>*_`[\]()!-]/g, ' '));
  return `${Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))} min read`;
}
