import { z } from 'astro/zod';

export function countWords(text) {
  return text
    .replace(/[\u2013\u2014]/g, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function isWithinWordRange(text, min, max) {
  const words = countWords(text);
  return words >= min && words <= max;
}

export function isNotBeforePublish(publishDate, updatedDate) {
  return updatedDate.getTime() >= publishDate.getTime();
}

export const OG_TITLE_MAX_CHARS = 98;

export const ogTitleSchema = z.string().max(OG_TITLE_MAX_CHARS, {
  message: `must be ${OG_TITLE_MAX_CHARS} characters or fewer`,
});
