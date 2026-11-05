import { familyOf, slugOfRecord } from './record-layout.mjs';

export const CATCH_UP_SUBJECT = 'chore(autowriter): catch up ';

export const SHARED_DERIVED = [
  'audits/phase-4.7/dispositions/routes.json',
  'audits/routes.json',
  'audits/spend-report.md',
  'docs/SEMANTIC-CORE.md',
  'site/content-facts.json',
];

const ARTICLE = /^site\/src\/data\/(?:post|glossary)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

const slugOf = (path) => slugOfRecord(path) ?? ARTICLE.exec(path)?.[1] ?? null;

export function classifyPath(path, slugs) {
  if (SHARED_DERIVED.includes(path)) return 'shared';
  const slug = slugOf(path);
  if (slug !== null && slugs.includes(slug)) return 'own';
  return familyOf(path) === 'disposition' ? 'restated' : 'foreign';
}

export const isDerivedPath = (path) => classifyPath(path, []) !== 'foreign';
