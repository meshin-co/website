import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readKeywordReport } from './keyword-report.mjs';

export const KEYWORD_REPORT_PATH = 'audits/keyword-demand.md';

const loudest = (first, second) =>
  second.exact - first.exact || second.broad - first.broad || first.phrase.localeCompare(second.phrase, 'en');

function reportText(repoRoot) {
  try {
    return readFileSync(join(repoRoot, KEYWORD_REPORT_PATH), 'utf8');
  } catch {
    return '';
  }
}

export const readKeywords = (repoRoot) => readKeywordReport(reportText(repoRoot));

export function keywordCandidates({ measured, candidates }) {
  if (measured === null) return [];
  return candidates
    .filter(({ exact }) => exact > 0)
    .map(({ phrase, exact, broad }) => ({ arm: 'keyword', phrase, exact, broad, measured }))
    .sort(loudest);
}
