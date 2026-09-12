import { bannedPhraseHits, paragraphViolations, sentenceLengths } from './prose-rules.mjs';

const MEDIAN_SENTENCE_CAP = 22;

export const PROFILES = {
  article: {
    takeaways: [3, 5],
    needsTableOrFigure: true,
    inbound: 2,
    outbound: 3,
    questionHeadings: 3,
    needsUpdated: true,
  },
  offer: { needsTableOrFigure: true, inbound: 2, outbound: 1, questionHeadings: 0 },
  page: { inbound: 1, outbound: 0, questionHeadings: 0 },
  term: { inbound: 1, outbound: 1, questionHeadings: 0 },
};

const STANDARD_NUMBER = /\b(?:ISO|IEC|NIST|SP|OWASP|EU|Article|Annex|Regulation)\b[^.]{0,24}$/i;

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec';
const DATE_DAY = new RegExp(`^\\s?(?:${MONTHS})\\b`, 'i');
const DATE_MONTH_FIRST = new RegExp(`\\b(?:${MONTHS})\\s$`, 'i');

const numberClaims = (paragraphs, allowed) => {
  const claims = [];

  for (const paragraph of paragraphs) {
    for (const match of paragraph.matchAll(/\d[\d,.]*\s?%?/g)) {
      const value = match[0].trim().replace(/[.,]+$/, '');
      if (allowed.includes(value)) continue;
      if (/^(19|20)\d\d$/.test(value)) continue;

      const before = paragraph.slice(0, match.index);
      if (STANDARD_NUMBER.test(before)) continue;
      if (DATE_MONTH_FIRST.test(before)) continue;
      if (DATE_DAY.test(paragraph.slice(match.index + match[0].length))) continue;

      claims.push({ value, excerpt: paragraph.slice(Math.max(0, match.index - 40), match.index + 40).trim() });
    }
  }

  return claims;
};

export function judgePage(page, profile, facts, bannedPhrases) {
  const findings = [];
  const add = (rule, excerpt, detail) => findings.push({ route: page.route, rule, excerpt, detail });

  if (page.headings.h1.length !== 1)
    add('h1-count', page.headings.h1.join(' | '), `${page.headings.h1.length} h1 elements`);

  const query = page.headings.h1.length === 1 ? facts.targetQuery[page.route] : null;
  if (query) {
    const terms = query.toLowerCase().split(/\s+/);
    const inHeading = page.headings.h1[0]?.toLowerCase() ?? '';
    if (!terms.every((term) => inHeading.includes(term)))
      add('h1-query', page.headings.h1[0] ?? '', `missing "${query}"`);
    else if (!terms.every((term) => page.opening.toLowerCase().includes(term)))
      add('query-opening', page.opening.slice(0, 80), `missing "${query}" in the first 100 words`);
  }

  for (const violation of paragraphViolations(page.paragraphs))
    add(violation.rule, violation.excerpt, `${violation.count} words`);

  const prose = [page.lead, ...page.paragraphs].filter(Boolean).join(' ');
  const { median, longest } = sentenceLengths(prose);
  if (median > MEDIAN_SENTENCE_CAP) add('median-sentence', longest.slice(0, 80), `median ${median} words`);

  for (const hit of bannedPhraseHits(page.text, bannedPhrases)) add('banned-phrase', hit.excerpt, hit.phrase);

  for (const claim of numberClaims(page.paragraphs, facts.numbers)) add('unsourced-number', claim.excerpt, claim.value);

  if (profile.takeaways) {
    const [low, high] = profile.takeaways;
    if (page.takeaways < low || page.takeaways > high) add('takeaways', '', `${page.takeaways} takeaways`);
  }

  if (profile.needsTableOrFigure && page.tables + page.figures === 0)
    add('table-or-figure', '', 'no table and no figure');
  if (page.links.internal.length < profile.inbound)
    add('inbound-links', '', `${page.links.internal.length} internal links`);
  if (page.links.external.length < profile.outbound)
    add('outbound-links', '', `${page.links.external.length} external links`);

  if (profile.questionHeadings > 0) {
    const asked = page.headings.sub.filter((heading) => heading.trim().endsWith('?')).length;
    if (asked < profile.questionHeadings)
      add('question-headings', page.headings.sub.join(' | '), `${asked} of ${page.headings.sub.length} ask a question`);
  }

  if (profile.needsUpdated && !page.updated) add('updated-date', '', 'no rendered updated date');

  return findings;
}
