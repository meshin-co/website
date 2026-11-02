import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  measuredChoice,
  measuredReason,
  noneReason,
  postChoice,
  promptReason,
  strengthens,
  termChoice,
  termReason,
} from './topic-wording.mjs';

const WINDOW = { measured: '2026-11-01', windowStart: '2026-08-01', windowEnd: '2026-10-30' };

const query = (text, position) => ({ query: text, impressions: 1, clicks: 0, position, pages: ['/x'], prompts: [] });
const prompt = (number, unproven = true) => ({ number, prompt: 'p' + number, unproven });
const step = (number, outcome) => ({ arm: 'post', number, outcome });

test('the choice line of a post names the prompt, that it is unproven and the end of the window', () => {
  assert.equal(
    postChoice({ number: 9 }, WINDOW),
    'Choice: signal 2, prompt 9, unproven, 0 impressions in the window to 2026-10-30'
  );
});

test('the choice line of a term names the measured query, its numbers and the day it was measured', () => {
  assert.equal(
    termChoice({ query: 'what is ai literacy', impressions: 5, position: 42.46 }, WINDOW),
    'Choice: signal 3, "what is ai literacy", 5 impressions at position 42.5, measured 2026-11-01'
  );
  assert.equal(
    termChoice({ query: 'what is x', impressions: 1, position: 90 }, WINDOW),
    'Choice: signal 3, "what is x", 1 impression at position 90.0, measured 2026-11-01'
  );
});

test('the choice line of a measured query in the band names the query, its numbers and the day it was measured', () => {
  assert.equal(
    measuredChoice({ query: 'ai governance', impressions: 6, position: 21.46 }, WINDOW),
    'Choice: signal 1, "ai governance", 6 impressions at position 21.5, measured 2026-11-01'
  );
  assert.equal(
    measuredChoice({ query: 'x', impressions: 1, position: 8 }, WINDOW),
    'Choice: signal 1, "x", 1 impression at position 8.0, measured 2026-11-01'
  );
});

test('a choice that strengthens a page ends by naming the route', () => {
  assert.equal(
    strengthens('Choice: signal 2, prompt 11, unproven, 0 impressions in the window to 2026-10-30', '/glossary/evals'),
    'Choice: signal 2, prompt 11, unproven, 0 impressions in the window to 2026-10-30; strengthens /glossary/evals'
  );
});

test('the reason of a measured query states the window and the band it sits in', () => {
  assert.equal(
    measuredReason({ query: 'ai governance', impressions: 6, position: 21.5 }, WINDOW),
    'query "ai governance" has 6 impressions at position 21.5 over 2026-08-01 to 2026-10-30, inside positions 8 to 30: ' +
      'strengthen the route that already ranks and add no page'
  );
});

test('the reason of a refused prompt says the prompt is unproven and why the page was not written', () => {
  assert.equal(
    promptReason({ number: 11 }, 'the query "evals in ci" names the concept "Evals"'),
    'prompt 11 is unproven and the query "evals in ci" names the concept "Evals"'
  );
});

test('the reason of a refused term gives the cause, then the measured query with its numbers and the window', () => {
  assert.equal(
    termReason(
      { query: 'what is the eu ai act', impressions: 48, position: 76.2 },
      WINDOW,
      'the query "what is the eu ai act" names the concept "EU AI Act", which the concept register assigns to /glossary/eu-ai-act'
    ),
    'the query "what is the eu ai act" names the concept "EU AI Act", which the concept register assigns to /glossary/eu-ai-act; ' +
      'the query "what is the eu ai act" has 48 impressions at position 76.2 over 2026-08-01 to 2026-10-30: ' +
      'strengthen that route and add no page'
  );
});

test('an empty report says it holds nothing to choose from', () => {
  assert.equal(
    noneReason({ report: { queries: [], prompts: [] }, trail: [] }),
    'The report holds no query and no buyer prompt, so there is nothing to choose from.'
  );
});

test('the strengthen sentence counts the rows on each side of the band and names the one nearest to it', () => {
  const queries = [query('a', 6), query('b', 7), query('c', 67), query('d', 75), query('e', 100)];
  assert.equal(
    noneReason({ report: { queries, prompts: [prompt(1, false)] }, trail: [] }),
    'No candidate. Strengthen: 0 of 5 query rows between positions 8 and 30 with an impression; ' +
      'better than 8: 2 (nearest "b" at position 7.0); worse than 30: 3 (nearest "c" at position 67.0). ' +
      'Write: no prompt is unproven.'
  );
});

test('a report with prompts and no query row says the report lists no query row', () => {
  assert.equal(
    noneReason({ report: { queries: [], prompts: [prompt(1)] }, trail: [step(1, 'retired')] }),
    'No candidate. Strengthen: the report lists no query row. Write: 1 unproven prompt examined; retired prompt: 1.'
  );
});

test('a row with no position is counted in the total and in neither side', () => {
  const queries = [query('a', null), query('b', 40)];
  assert.match(
    noneReason({ report: { queries, prompts: [] }, trail: [] }),
    /0 of 2 query rows between positions 8 and 30 with an impression; better than 8: 0; worse than 30: 1 \(nearest "b" at position 40\.0\)\./
  );
});

test('the write sentence counts every outcome it saw, in a fixed order, and leaves out the ones it did not see', () => {
  const trail = [
    step(1, 'slug-held'),
    step(2, 'retired'),
    step(3, 'family-served'),
    step(4, 'retired'),
    step(5, 'register-owner'),
    step(6, 'title-too-long'),
    step(7, 'title-collision'),
    step(8, 'route-exists'),
    step(9, 'no-slug'),
    step(10, 'definition'),
  ];
  const prompts = Array.from({ length: 10 }, (_, index) => prompt(index + 1));
  assert.match(
    noneReason({ report: { queries: [query('a', 50)], prompts }, trail }),
    /Write: 10 unproven prompts examined; retired prompt: 2; a definition, left to the term arm: 1; title too long for a page: 1; no slug can be made: 1; concept already in the register: 1; already answered in its own format: 1; route already published: 1; title already taken: 1; slug already held: 1\.$/
  );
});

test('the write sentence counts the steps of the post arm and no step of the term arm', () => {
  const trail = [step(1, 'definition'), { arm: 'term', query: 'what is x', outcome: 'register-owner' }];
  assert.match(
    noneReason({ report: { queries: [query('a', 50)], prompts: [prompt(1)] }, trail }),
    /Write: 1 unproven prompt examined; a definition, left to the term arm: 1\.$/
  );
});
