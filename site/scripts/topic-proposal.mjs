import { categoryPillars } from '../src/data/categories.mjs';
import { TOPIC_ROLES, callTotals } from './generation-record.mjs';
import { existingArticles } from './topic-repeat.mjs';
import { categoryEntry } from './topic-selection.mjs';
import { meter } from './write-draft.mjs';
import { WriterError } from './writer-error.mjs';

const [ROLE] = TOPIC_ROLES;
const ATTEMPTS_PER_CATEGORY = 2;
const EXISTING_TITLE_CAP = 120;
const MAX_OUTPUT_TOKENS = 200;
const SCHEMA_NAME = 'topic_proposal';
const FAILED_ATTEMPT_KINDS = ['vendor', 'output'];
const NO_QUERY = 'the answer holds no query to examine';
const SCHEMA = {
  type: 'object',
  properties: { query: { type: 'string' } },
  required: ['query'],
  additionalProperties: false,
};
const SYSTEM = [
  'You choose the topic of one new article for a business site.',
  'Answer with one target query: the words a buyer types into a search engine, written as a question or as a how-to, specific enough that one article answers it in full.',
  'Never ask for a definition. A term that needs defining has its own glossary page, and the terms that have one are listed below.',
  'Choose a subject that no published article and no article in progress covers, even in other words.',
  'Answer with the query only.',
].join('\n');

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const bullets = (items) => (items.length === 0 ? ['none'] : items.map((item) => `- ${item}`));
const newestFirst = (first, second) => (second.publishDate ?? '').localeCompare(first.publishDate ?? '', 'en');

export const wantsProposal = (decision) => decision.decision !== 'write' && decision.fallback?.categories.length > 0;

function listsOf({ posts, claims, concepts, now }) {
  return {
    published: posts
      .filter(({ title }) => title !== '')
      .sort(newestFirst)
      .slice(0, EXISTING_TITLE_CAP)
      .map(({ title }) => title),
    claimed: existingArticles({ posts: [], claims, now }).map(({ title }) => title),
    concepts: concepts.map(({ concept, route }) => `${concept} (${route})`),
  };
}

function userPrompt({ published, claimed, concepts }, category, refused) {
  const { title, description } = categoryPillars[category];
  return [
    `Category: ${category} (${title})`,
    description,
    '',
    'Published articles, newest first. Do not repeat or reword any of them:',
    ...bullets(published),
    '',
    'Articles being written now. Do not take their subjects:',
    ...bullets(claimed),
    '',
    'Terms with their own glossary page. Never define one of them and never build the query around one:',
    ...bullets(concepts),
    ...(refused
      ? [
          '',
          `Your last query, "${refused.query}", was refused: ${refused.detail}`,
          'Choose a query on a different subject.',
        ]
      : []),
  ].join('\n');
}

const requestFor = (lists, category, refused) => ({
  system: SYSTEM,
  messages: [{ role: 'user', content: userPrompt(lists, category, refused) }],
  schema: SCHEMA,
  schemaName: SCHEMA_NAME,
  maxOutputTokens: MAX_OUTPUT_TOKENS,
});

const queryOf = (json) => {
  const text = typeof json?.query === 'string' ? json.query.trim() : '';
  return text === '' ? null : text;
};

const stepOf = (category, query, outcome, detail) => ({
  arm: 'category',
  category,
  ...(query === null ? {} : { query }),
  outcome,
  detail,
});

async function attemptOnce({ ask, calls, inputs, lists, category, refused }) {
  let answer;
  try {
    answer = await ask(ROLE, requestFor(lists, category, refused));
  } catch (error) {
    if (!(error instanceof WriterError) || !FAILED_ATTEMPT_KINDS.includes(error.kind)) throw error;
    return { step: stepOf(category, null, 'proposal-failed', error.message) };
  }
  const query = queryOf(answer.json);
  if (query === null) return { step: stepOf(category, null, 'proposal-failed', NO_QUERY) };
  const examined = categoryEntry({ ...inputs, category, query, proposal: { calls: structuredClone(calls) } });
  if (examined.entry) {
    return { entry: examined.entry, step: stepOf(category, query, 'chosen', examined.entry.topic.title) };
  }
  const { outcome, detail, ledger } = examined.refusal;
  return { step: stepOf(category, query, outcome, detail), ledger, refused: { query, detail } };
}

async function tryCategory({ category, outcome, ...rest }) {
  let refused = null;
  for (let attempt = 1; attempt <= ATTEMPTS_PER_CATEGORY; attempt += 1) {
    const result = await attemptOnce({ ...rest, category, refused });
    outcome.trail.push(result.step);
    if (result.ledger) outcome.refusals.push(result.ledger);
    if (result.entry) return result.entry;
    refused = result.refused ?? null;
  }
  return null;
}

const written = (decision, entry, { refusals, trail }) => ({
  ...decision,
  decision: 'write',
  choice: entry.choice,
  reason: null,
  entries: [entry],
  strengthen: null,
  advisories: [decision.strengthen, ...decision.advisories].filter(Boolean),
  fallback: null,
  refusals: [...decision.refusals, ...refusals],
  trail: [...decision.trail, ...trail],
});

function triedSentence(trail) {
  const outcomes = new Map();
  for (const { category, outcome } of trail) outcomes.set(category, [...(outcomes.get(category) ?? []), outcome]);
  const tried = [...outcomes].map(([category, list]) => `${category} (${list.join(', ')})`);
  return `Every category was tried and no proposal passed: ${tried.join('; ')}.`;
}

const unwritten = (decision, { refusals, trail }) => ({
  ...decision,
  reason: [decision.reason, triedSentence(trail)].filter(Boolean).join(' '),
  refusals: [...decision.refusals, ...refusals],
  trail: [...decision.trail, ...trail],
});

export async function proposeTopic({ decision, inputs, adapter }) {
  if (!wantsProposal(decision)) {
    throw new TypeError('proposeTopic needs a decision that wrote nothing and names a category to try');
  }
  const calls = [];
  const outcome = { refusals: [], trail: [] };
  const context = { ask: meter(adapter, calls), calls, inputs, lists: listsOf(inputs), outcome };
  try {
    for (const category of decision.fallback.categories) {
      const entry = await tryCategory({ ...context, category });
      if (entry) return { decision: written(decision, entry, outcome), calls };
    }
  } catch (error) {
    if (error instanceof WriterError) error.spend = callTotals(calls);
    throw error;
  }
  return { decision: unwritten(decision, outcome), calls };
}

function stepLine({ category, query, outcome, detail }) {
  if (outcome === 'chosen') return `Category ${category}: "${query}" was taken.`;
  if (query === undefined) return `Category ${category}: no query came back (${outcome}): ${detail}`;
  return `Category ${category}: "${query}" was refused (${outcome}): ${detail}`;
}

function spendLine(calls, recorded) {
  const { tokens, costUsd } = callTotals(calls);
  const where = recorded ? 'the ledger of the claim records them' : 'no ledger records them';
  return `Topic proposals: ${plural(calls.length, 'call')}, ${tokens.input} input and ${tokens.output} output tokens, ${costUsd} USD; ${where}.`;
}

export function proposalLines({ decision, calls, preview }) {
  const rotation = preview && wantsProposal(decision) ? [rotationLine(decision.fallback.categories)] : [];
  const steps = decision.trail.filter(({ arm }) => arm === 'category').map(stepLine);
  return [...rotation, ...steps, ...(calls.length > 0 ? [spendLine(calls, decision.decision === 'write')] : [])];
}

const rotationLine = (categories) => `Category rotation: ${categories.join(', ')}. No model is called without --write.`;
