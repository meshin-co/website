import assert from 'node:assert/strict';
import { test } from 'node:test';

import { judgePage, PROFILES } from './content-rows.mjs';

const clean = {
  route: '/blog/ai-register',
  text: 'An AI register lists every AI system a company runs. It names an owner for each one.',
  opening: 'An AI register lists every AI system a company runs.',
  paragraphs: ['An AI register lists every AI system a company runs.', 'It names an owner for each one.'],
  headings: {
    h1: ['What is an AI register?'],
    sub: ['What goes in it?', 'How do I build one?', 'Who keeps it current?'],
  },
  links: {
    internal: ['/glossary/evals', '/services'],
    external: ['https://www.nist.gov/a', 'https://www.iso.org/b', 'https://eur-lex.europa.eu/c'],
  },
  tables: 1,
  figures: 0,
  takeaways: 3,
  updated: '2026-09-08',
};

const facts = { targetQuery: { '/blog/ai-register': 'AI register' }, numbers: [] };

test('a page that satisfies every row for its profile has no findings', () => {
  assert.deepEqual(judgePage(clean, PROFILES.article, facts, []), []);
});

test('a missing or duplicated h1 is a finding, and the target query must be in it', () => {
  const two = { ...clean, headings: { ...clean.headings, h1: ['One', 'Two'] } };
  const wrong = { ...clean, headings: { ...clean.headings, h1: ['Everything about governance'] } };

  assert.deepEqual(
    judgePage(two, PROFILES.article, facts, []).map((f) => f.rule),
    ['h1-count']
  );
  assert.deepEqual(
    judgePage(wrong, PROFILES.article, facts, []).map((f) => f.rule),
    ['h1-query']
  );
});

test('the target query must appear in the opening hundred words', () => {
  const buried = { ...clean, opening: 'Something else entirely for a hundred words.' };

  assert.deepEqual(
    judgePage(buried, PROFILES.article, facts, []).map((f) => f.rule),
    ['query-opening']
  );
});

test('article-only rows do not fire on a glossary term', () => {
  const term = {
    ...clean,
    route: '/glossary/ai-register',
    takeaways: 0,
    tables: 0,
    links: { internal: ['/x'], external: ['https://www.nist.gov/a'] },
  };
  const termFacts = { targetQuery: { '/glossary/ai-register': 'AI register' }, numbers: [] };

  assert.deepEqual(judgePage(term, PROFILES.term, termFacts, []), []);
  assert.deepEqual(
    judgePage(
      { ...term, route: '/blog/x' },
      PROFILES.article,
      { targetQuery: { '/blog/x': 'AI register' }, numbers: [] },
      []
    ).map((f) => f.rule),
    ['takeaways', 'table-or-figure', 'inbound-links', 'outbound-links']
  );
});

test('half the sub-headings must be questions', () => {
  const flat = { ...clean, headings: { ...clean.headings, sub: ['Background', 'Details', 'What now?'] } };

  assert.deepEqual(
    judgePage(flat, PROFILES.article, facts, []).map((f) => f.rule),
    ['question-headings']
  );
});

test('unpunctuated labels in the page chrome do not count as prose sentences', () => {
  const labelled = {
    ...clean,
    text: `02 Detail In practice Sources eur-lex.europa.eu Next step ${clean.paragraphs.join(' ')}`,
  };

  assert.deepEqual(judgePage(labelled, PROFILES.article, facts, []), []);
});

test('banned phrases and unsourced numbers are reported with their excerpt', () => {
  const loud = {
    ...clean,
    text: `${clean.text} We leverage 47 systems.`,
    paragraphs: [...clean.paragraphs, 'We leverage 47 systems.'],
  };
  const findings = judgePage(loud, PROFILES.article, facts, ['leverage']);

  assert.deepEqual(
    findings.map((f) => f.rule),
    ['banned-phrase', 'unsourced-number']
  );
  assert.match(findings[0].excerpt, /leverage/);
  assert.match(findings[1].excerpt, /47/);
});

test('a number listed as owner-confirmed or computed passes', () => {
  const priced = {
    ...clean,
    text: `${clean.text} The fee is 5,000 dollars.`,
    paragraphs: [...clean.paragraphs, 'The fee is 5,000 dollars.'],
  };

  assert.deepEqual(judgePage(priced, PROFILES.article, { ...facts, numbers: ['5,000'] }, []), []);
});

test('trailing punctuation does not hide a number from the allowlist', () => {
  const punctuated = {
    ...clean,
    text: `${clean.text} The fee is $5,000, and the sprint runs 90 days.`,
    paragraphs: [...clean.paragraphs, 'The fee is $5,000, and the sprint runs 90 days.'],
  };

  assert.deepEqual(judgePage(punctuated, PROFILES.article, { ...facts, numbers: ['5,000', '90'] }, []), []);
});

test('an article needs at least three headings a buyer would type, not a ratio', () => {
  const structural = {
    ...clean,
    headings: { ...clean.headings, sub: ['The short answer', 'What to remember', 'Sources', 'Why does it stall?'] },
  };
  const asked = {
    ...clean,
    headings: {
      ...clean.headings,
      sub: ['The short answer', 'Why does it stall?', 'Who owns it?', 'How do I measure it?', 'Sources'],
    },
  };

  assert.deepEqual(
    judgePage(structural, PROFILES.article, facts, []).map((f) => f.rule),
    ['question-headings']
  );
  assert.deepEqual(judgePage(asked, PROFILES.article, facts, []), []);
});

test('a rendered date is not a numeric claim', () => {
  const dated = {
    ...clean,
    text: `${clean.text} Updated 8 September 2026.`,
    paragraphs: [...clean.paragraphs, 'Updated 8 September 2026.'],
  };

  assert.deepEqual(judgePage(dated, PROFILES.article, facts, []), []);
});

test('a year, a standard number and an ordinal are not treated as claims', () => {
  const dated = {
    ...clean,
    text: `${clean.text} ISO/IEC 42001 was published in 2023, and Article 14 covers oversight.`,
    paragraphs: [...clean.paragraphs, 'ISO/IEC 42001 was published in 2023, and Article 14 covers oversight.'],
  };

  assert.deepEqual(judgePage(dated, PROFILES.article, facts, []), []);
});
