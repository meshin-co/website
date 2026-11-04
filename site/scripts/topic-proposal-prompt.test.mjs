import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categoryPillars } from '../src/data/categories.mjs';
import {
  AGENTIC,
  GOVERNANCE,
  QUERY_ACCEPTED,
  QUERY_OTHER,
  QUERY_REGISTER,
  answerWith,
  modelRequests,
  promptOf,
  proposalScene,
} from './fixtures/proposal-scene.mjs';
import { LAPSED_AT, claimed, published } from './fixtures/topic-inputs.mjs';
import { proposeTopic } from './topic-proposal.mjs';

const run = ({ decision, inputs, adapter }) => proposeTopic({ decision, inputs, adapter });
const firstPrompt = async (options) => {
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)], ...options });
  await run(scene);
  return promptOf(modelRequests(scene.sent)[0]);
};
const lineAt = (text, line) => text.split('\n').indexOf(line);
const day = (number) => new Date(Date.UTC(2026, 0, 1 + number)).toISOString().slice(0, 10);
const numbered = (count) =>
  Array.from({ length: count }, (_, at) =>
    published(`post-${at + 1}`, `Article ${String(at + 1).padStart(3, '0')}`, { publishDate: day(at + 1) })
  );

test('the request is one structured call: a strict one-field schema, one user message and a small answer budget', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_ACCEPTED)] });
  await run(scene);
  const [{ json }] = modelRequests(scene.sent);
  assert.deepEqual(json.text.format, {
    type: 'json_schema',
    name: 'topic_proposal',
    schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
    strict: true,
  });
  assert.equal(json.max_output_tokens, 200);
  assert.deepEqual(
    json.input.map(({ role }) => role),
    ['user']
  );
  assert.match(json.instructions, /definition/i);
});

test('the prompt gives the category id, title and description, and the other categories stay out of it', async () => {
  const text = await firstPrompt();
  const { title, description } = categoryPillars[GOVERNANCE];
  for (const needle of [GOVERNANCE, title, description]) assert.ok(text.includes(needle), needle);
  assert.equal(text.includes(categoryPillars[AGENTIC].description), false);
});

test('the next category of the order gets its own prompt', async () => {
  const answers = [answerWith(QUERY_REGISTER), answerWith(QUERY_REGISTER), answerWith(QUERY_OTHER)];
  const scene = proposalScene({ answers });
  await run(scene);
  const prompts = modelRequests(scene.sent).map(promptOf);
  assert.deepEqual(
    prompts.map((text) => text.includes(categoryPillars[GOVERNANCE].description)),
    [true, true, false]
  );
  assert.ok(prompts[2].includes(categoryPillars[AGENTIC].description));
});

test('the titles of the published articles are listed newest first, and an undated article last', async () => {
  const posts = [
    published('old', 'Oldest article', { publishDate: '2026-01-05' }),
    published('undated', 'Undated article', { publishDate: null }),
    published('new', 'Newest article', { publishDate: '2026-10-20' }),
    published('mid', 'Middle article', { publishDate: '2026-06-01' }),
  ];
  const text = await firstPrompt({ posts });
  const places = ['Newest article', 'Middle article', 'Oldest article', 'Undated article'].map((title) =>
    lineAt(text, `- ${title}`)
  );
  assert.ok(
    places.every((place) => place > -1),
    places.join()
  );
  assert.deepEqual(
    places,
    [...places].sort((first, second) => first - second)
  );
});

test('at most 120 titles are listed, the newest ones', async () => {
  const text = await firstPrompt({ posts: numbered(130) });
  const listed = text.split('\n').filter((line) => /^- Article \d{3}$/.test(line));
  assert.equal(listed.length, 120);
  assert.equal(listed[0], '- Article 130');
  assert.equal(listed.at(-1), '- Article 011');
  assert.equal(text.includes('Article 010'), false);
});

test('every concept of the register is listed with the route that defines it', async () => {
  const text = await firstPrompt();
  for (const [concept, route] of [
    ['Evals', '/glossary/evals'],
    ['AI register', '/glossary/ai-register'],
    ['Guardrails', '/glossary/guardrails'],
  ]) {
    assert.ok(text.includes(concept) && text.includes(route), concept);
  }
});

test('the articles being written are listed, and a lapsed claim and a term claim are not', async () => {
  const claims = [
    claimed('held', 'Held article title'),
    claimed('lapsed', 'Lapsed article title', { expiresAt: LAPSED_AT }),
    claimed('a-term', 'Term claim title?', { format: 'term' }),
  ];
  const text = await firstPrompt({ claims });
  assert.ok(lineAt(text, '- Held article title') > -1);
  assert.equal(text.includes('Lapsed article title'), false);
  assert.equal(text.includes('Term claim title'), false);
});

test('the first attempt of a category carries no refusal, and the second carries the query and the reason it was refused', async () => {
  const scene = proposalScene({ answers: [answerWith(QUERY_REGISTER), answerWith(QUERY_OTHER)] });
  await run(scene);
  const [first, second] = modelRequests(scene.sent).map(promptOf);
  assert.equal(first.includes(QUERY_REGISTER), false);
  assert.ok(second.includes(QUERY_REGISTER));
  assert.ok(second.includes('names the concept "Evals"'));
  assert.ok(second.startsWith(first.slice(0, 200)));
});

test('the first attempt of the next category carries no refusal of the one before', async () => {
  const answers = [answerWith(QUERY_REGISTER), answerWith(QUERY_REGISTER), answerWith(QUERY_OTHER)];
  const scene = proposalScene({ answers });
  await run(scene);
  assert.equal(promptOf(modelRequests(scene.sent)[2]).includes(QUERY_REGISTER), false);
});
