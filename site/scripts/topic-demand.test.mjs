import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { readDemandReport } from './demand-report.mjs';
import {
  STRENGTHEN_BAND,
  promptCandidates,
  proposalCandidates,
  strengthenCandidates,
  termCandidates,
} from './topic-demand.mjs';
import { casedForms } from './topic-casing.mjs';

const fixture = (name) => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
const real = readDemandReport(fixture('search-demand-2026-11-01.md'));
const forms = casedForms(['EU AI Act', 'NIST AI RMF', 'What is an AI register?']);

const row = (query, impressions, position, pages = ['/glossary/a-term'], prompts = []) => ({
  query,
  impressions,
  clicks: 0,
  position,
  pages,
  prompts,
  cells: { Query: query, Impressions: String(impressions) },
});
const reportOf = (queries, prompts = []) => ({ queries, prompts, pages: [], days: [] });

test('on the report measured 2026-11-01 no query sits between positions 8 and 30, so the strengthen arm selects nothing', () => {
  assert.equal(real.queries.length, 15);
  assert.deepEqual(strengthenCandidates(real), []);
  assert.deepEqual(
    real.queries.filter(({ position }) => position < STRENGTHEN_BAND.min).map(({ query }) => query),
    ['"fractional chief ai officer" remote', 'meshin']
  );
});

test('a query is in the band from position 8 to position 30 and nowhere else', () => {
  const queries = [row('a', 1, 7.9), row('b', 1, 8), row('c', 1, 30), row('d', 1, 30.1), row('e', 1, 18.4)];
  assert.deepEqual(
    strengthenCandidates(reportOf(queries)).map(({ query }) => query),
    ['b', 'e', 'c']
  );
});

test('a row with no impression, no position or no page is never a strengthen candidate', () => {
  const queries = [row('none', 0, 12), row('lost', 3, null), row('homeless', 3, 12, []), row('fine', 3, 12)];
  assert.deepEqual(
    strengthenCandidates(reportOf(queries)).map(({ query }) => query),
    ['fine']
  );
});

test('candidates run from the most impressions to the fewest, then the nearest to page one, then by query', () => {
  const queries = [row('b', 5, 20), row('c', 9, 25), row('a', 5, 20), row('d', 5, 12)];
  assert.deepEqual(
    strengthenCandidates(reportOf(queries)).map(({ query }) => query),
    ['c', 'd', 'a', 'b']
  );
});

test('a strengthen candidate names the route that carried the query, its numbers and the prompts it proves', () => {
  const carried = row('ai governance', 14, 22.5, ['/glossary/ai-governance', '/faq'], [4, 28]);
  assert.deepEqual(strengthenCandidates(reportOf([carried])), [
    {
      arm: 'strengthen',
      source: 'measured',
      route: '/glossary/ai-governance',
      query: 'ai governance',
      impressions: 14,
      position: 22.5,
      prompts: [4, 28],
    },
  ]);
});

test('every unproven prompt is a post candidate, in the order the core numbers them', () => {
  const candidates = promptCandidates(real);
  assert.equal(candidates.length, 28);
  assert.deepEqual(candidates.map(({ number }) => number).slice(0, 4), [1, 2, 3, 4]);
  assert.equal(candidates.at(-1).number, 30);
  assert.equal(
    candidates.some(({ number }) => number === 6 || number === 8),
    false
  );
});

test('a post candidate carries its prompt, its must-win route and its report row verbatim', () => {
  const nine = promptCandidates(real).find(({ number }) => number === 9);
  assert.equal(nine.arm, 'post');
  assert.equal(nine.prompt, 'why do AI pilots fail to reach production');
  assert.equal(nine.mustWin, '/blog/why-your-ai-pilot-never-reached-production');
  assert.deepEqual(nine.row, {
    '#': '9',
    Prompt: 'why do AI pilots fail to reach production',
    'Must win': '`/blog/why-your-ai-pilot-never-reached-production`',
    Impressions: 'unproven',
    Position: '-',
    'Carried by': '-',
  });
});

test('a prompt with impressions is proven, and a prompt list in any order is walked by number', () => {
  const prompts = [
    { number: 3, prompt: 'c', mustWin: null, unproven: true, impressions: 0, position: null, carriedBy: [], cells: {} },
    { number: 1, prompt: 'a', mustWin: null, unproven: true, impressions: 0, position: null, carriedBy: [], cells: {} },
    { number: 2, prompt: 'b', mustWin: null, unproven: false, impressions: 4, position: 30, carriedBy: [], cells: {} },
  ];
  assert.deepEqual(
    promptCandidates(reportOf([], prompts)).map(({ number }) => number),
    [1, 3]
  );
});

test('on the report measured 2026-11-01 no query is a definition, so the term arm has no candidate', () => {
  assert.deepEqual(termCandidates(real, forms), []);
});

test('a term candidate is a measured query worded as a definition, whatever the form of the definition', () => {
  const queries = [
    row('what is an ai register', 5, 40),
    row('what are guardrails', 4, 50),
    row("what's shadow ai", 3, 60),
    row('what does human oversight mean', 2, 70),
    row('how to build an ai register', 9, 20),
    row('ai governance', 8, 30),
    row('what is the difference between a model card and a datasheet', 7, 25),
  ];
  assert.deepEqual(
    termCandidates(reportOf(queries), forms).map(({ query }) => query),
    ['what is an ai register', 'what are guardrails', "what's shadow ai", 'what does human oversight mean']
  );
});

test('a term candidate keeps the measured query, the restored wording, the numbers, the prompts and the row', () => {
  const measured = row('what is the eu ai act', 48, 76.2, ['/glossary/eu-ai-act'], [8]);
  assert.deepEqual(termCandidates(reportOf([measured]), forms), [
    {
      arm: 'term',
      query: 'what is the eu ai act',
      text: 'what is the EU AI act',
      impressions: 48,
      position: 76.2,
      prompts: [8],
      row: { Query: 'what is the eu ai act', Impressions: '48' },
    },
  ]);
});

test('term candidates run from the most impressions to the fewest, then the nearest to page one, then by query', () => {
  const queries = [
    row('what is beta', 5, 20),
    row('what is gamma', 9, 90),
    row('what is alpha', 5, 20),
    row('what is delta', 5, 12),
    row('what is epsilon', 1, 3),
  ];
  assert.deepEqual(
    termCandidates(reportOf(queries), forms).map(({ query }) => query),
    ['what is gamma', 'what is delta', 'what is alpha', 'what is beta', 'what is epsilon']
  );
});

test('a definition with no impression or no position is never a term candidate, whichever page carried it', () => {
  const queries = [
    row('what is none', 0, 12),
    row('what is lost', 3, null),
    row('what is homeless', 3, 12, []),
    row('what is x', 3, 12),
  ];
  assert.deepEqual(
    termCandidates(reportOf(queries), forms).map(({ query }) => query),
    ['what is homeless', 'what is x']
  );
});

test('a query that no prompt names, that no page answers and that asks how or why is a proposal', () => {
  const queries = [
    row('how to write an ai policy', 3, 40, ['/']),
    row('why do ai pilots fail', 5, 45, ['/blog']),
    row('fractional caio cost', 9, 30, ['/']),
  ];
  assert.deepEqual(proposalCandidates(reportOf(queries)), [
    { query: 'why do ai pilots fail', impressions: 5, position: 45, page: '/blog' },
    { query: 'how to write an ai policy', impressions: 3, position: 40, page: '/' },
  ]);
});

test('a query that proves a prompt is never a proposal, because a prompt already names it', () => {
  assert.deepEqual(proposalCandidates(reportOf([row('how to build an ai register', 3, 40, ['/'], [6])])), []);
});

test('only a static page, a blog category or a tag leaves a query unanswered', () => {
  const unanswered = ['/', '/faq', '/blog/category/operating-model', '/blog/tag/agents'];
  const answered = ['/glossary/x', '/blog/x', '/faq/x', '/services/x', '/resources/x', '/case-studies/x'];
  for (const page of unanswered) {
    assert.equal(proposalCandidates(reportOf([row('how to x', 1, 40, [page])])).length, 1, page);
  }
  for (const page of answered) {
    assert.equal(proposalCandidates(reportOf([row('how to x', 1, 40, [page])])).length, 0, page);
  }
  assert.equal(proposalCandidates(reportOf([row('how to x', 1, 40, ['/', '/blog/x'])])).length, 0);
});

test('a row with no page at all is unanswered and a proposal names no page', () => {
  assert.deepEqual(proposalCandidates(reportOf([row('how to x', 1, 40, [])])), [
    { query: 'how to x', impressions: 1, position: 40, page: null },
  ]);
});

test('a definition and a wording with no cue are not proposals, and nor is a row with no impression', () => {
  const queries = [
    row('what is x', 4, 40, ['/']),
    row('fractional caio cost', 4, 40, ['/']),
    row('how to x', 0, 40, ['/']),
  ];
  assert.deepEqual(proposalCandidates(reportOf(queries)), []);
});

test('proposals run from the most impressions to the fewest, then the nearest to page one, then by query', () => {
  const queries = [row('how to b', 5, 20, ['/']), row('how to c', 9, 25, ['/']), row('how to a', 5, 20, ['/'])];
  assert.deepEqual(
    proposalCandidates(reportOf(queries)).map(({ query }) => query),
    ['how to c', 'how to a', 'how to b']
  );
});

test('on the report measured 2026-11-01 nothing is proposed, because no unnamed query asks how or why', () => {
  assert.deepEqual(proposalCandidates(real), []);
});

test('a report with no query and no prompt gives every arm nothing', () => {
  const empty = readDemandReport('');
  assert.deepEqual(strengthenCandidates(empty), []);
  assert.deepEqual(promptCandidates(empty), []);
  assert.deepEqual(termCandidates(empty, forms), []);
  assert.deepEqual(proposalCandidates(empty), []);
});
