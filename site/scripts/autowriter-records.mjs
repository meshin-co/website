import { readFileSync } from 'node:fs';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MILLISECOND_FREE_LENGTH = 19;

export const readSchema = (fileName) => JSON.parse(readFileSync(new URL(fileName, import.meta.url), 'utf8'));

export function describeProblem({ path, problem }) {
  const field = path.replace(/^\$\.?/, '');
  return field === '' ? `the file ${problem}` : `${field} ${problem}`;
}

export function isCalendarInstant(value) {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return false;
  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, MILLISECOND_FREE_LENGTH) === value.slice(0, MILLISECOND_FREE_LENGTH)
  );
}

export const instantProblems = (entries) =>
  entries
    .filter(([, value]) => value !== null && !isCalendarInstant(value))
    .map(([path, value]) => ({ path, problem: `must be a real calendar instant, got ${JSON.stringify(value)}` }));
