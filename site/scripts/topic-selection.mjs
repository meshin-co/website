import { categoryStandings, rotationOrder } from './topic-categories.mjs';
import { proposalCandidates, strengthenCandidates } from './topic-demand.mjs';
import { examineQuery, walkOrdered, walkPosts, walkTerms, walkWeak } from './topic-walk.mjs';
import {
  categoryChoice,
  measuredChoice,
  measuredReason,
  noneReason,
  orderedChoice,
  orderedReason,
  postChoice,
  termChoice,
  weakChoice,
} from './topic-wording.mjs';

const WIRED_FROM = { posts: 'readPublishedPosts', rotation: 'CATEGORY_ROTATION' };

const ORDER_SHAPE = "null, { kind: 'prompt', number } or { kind: 'title', text }";

const isOrder = (order) =>
  order === null ||
  (order?.kind === 'prompt' && Number.isSafeInteger(order.number) && order.number > 0) ||
  (order?.kind === 'title' && typeof order.text === 'string' && order.text.trim() !== '');

function requireWiring(inputs) {
  for (const [name, source] of Object.entries(WIRED_FROM)) {
    if (!Array.isArray(inputs[name])) {
      throw new TypeError(`inputs.${name} must be an array, read with ${source} of topic-categories.mjs`);
    }
  }
  if (!isOrder(inputs.order)) {
    throw new TypeError(`inputs.order must be ${ORDER_SHAPE}, read from the order flags of pick-a-topic.mjs`);
  }
}

const measuredAdvisory = (row, report) => ({
  source: 'measured',
  route: row.route,
  query: row.query,
  number: row.prompts[0] ?? null,
  impressions: row.impressions,
  position: row.position,
  reason: measuredReason(row, report),
  choice: measuredChoice(row, report),
});

function publicAdvisory(advisory) {
  const { source, route, query, number, impressions, position, reason } = advisory;
  return { source, route, query, number, impressions, position, reason };
}

const postEntry = ({ candidate, topic }, report) => ({
  format: 'article',
  topic,
  prompt: { number: candidate.number, text: candidate.prompt },
  demand: { impressions: 0, position: null },
  table: 'Buyer prompts',
  row: candidate.row,
  choice: postChoice(candidate, report),
  origin: 'demand',
});

const weakEntry = ({ candidate, topic }, report) => ({
  format: 'article',
  topic,
  demand: { impressions: candidate.impressions, position: candidate.position },
  table: 'Queries',
  row: candidate.row,
  choice: weakChoice(candidate, report),
  origin: 'weak-demand',
  weakness: candidate.weakness,
});

const orderedByPrompt = ({ candidate, topic }) => ({
  format: 'article',
  topic,
  prompt: { number: candidate.number, text: candidate.prompt },
  demand: { impressions: candidate.impressions, position: candidate.position },
  table: 'Buyer prompts',
  row: candidate.row,
  choice: orderedChoice(candidate.order),
  origin: 'ordered',
});

const orderedByTitle = ({ candidate, topic }) => ({
  format: 'article',
  topic,
  demand: { impressions: 0, position: null },
  table: null,
  row: null,
  choice: orderedChoice(candidate.order),
  origin: 'ordered',
});

const LEAD_ENTRIES = {
  post: postEntry,
  weak: weakEntry,
  ordered: (lead) => (lead.candidate.order.kind === 'prompt' ? orderedByPrompt(lead) : orderedByTitle(lead)),
};

const leadEntry = (lead, report) => LEAD_ENTRIES[lead.candidate.arm](lead, report);

function promptOf({ prompts }, report, fallback) {
  const found = report.prompts.find(({ number }) => number === prompts[0]);
  return found ? { number: found.number, text: found.prompt } : fallback;
}

const termEntry = ({ candidate, topic }, prompt, report) => ({
  format: 'term',
  topic,
  prompt,
  demand: { impressions: candidate.impressions, position: candidate.position },
  table: 'Queries',
  row: candidate.row,
  choice: termChoice(candidate, report),
  origin: 'demand',
});

const namedConcept = ({ candidate, topic }, why) => ({
  query: candidate.query,
  title: topic.title,
  slug: topic.slug,
  impressions: candidate.impressions,
  position: candidate.position,
  why,
});

function whyNotWritten(prompt, written, { termArm, termCap }) {
  if (!termArm) return 'term-arm-off';
  if (prompt === null) return 'no-prompt';
  return written >= termCap ? 'cap' : null;
}

function splitTerms(survivors, settings, { report, lead }) {
  const written = [];
  const named = [];
  for (const survivor of survivors) {
    const prompt = promptOf(survivor.candidate, report, lead.prompt ?? null);
    const why = whyNotWritten(prompt, written.length, settings);
    if (why === null) written.push(termEntry(survivor, prompt, report));
    else named.push(namedConcept(survivor, why));
  }
  return { written, named };
}

function writeDecision({ inputs, lead, survivors, advisories, shared }) {
  const { report, settings } = inputs;
  const first = leadEntry(lead, report);
  const { written, named } = splitTerms(survivors, settings, { report, lead: first });
  return {
    decision: 'write',
    choice: first.choice,
    reason: null,
    entries: [first, ...written],
    strengthen: null,
    advisories: advisories.map(publicAdvisory),
    concepts: { named },
    fallback: null,
    ...shared,
  };
}

const strengthenDecision = (first, rest, shared) => ({
  decision: 'strengthen',
  choice: first.choice,
  reason: null,
  entries: [],
  strengthen: publicAdvisory(first),
  advisories: rest.map(publicAdvisory),
  concepts: { named: [] },
  ...shared,
});

const noneDecision = (reason, shared) => ({
  decision: 'none',
  choice: null,
  reason,
  entries: [],
  strengthen: null,
  advisories: [],
  concepts: { named: [] },
  ...shared,
});

const categoryFallback = ({ rotation, posts, claims, now }) => ({
  categories: rotationOrder({ rotation, posts, claims, now }),
});

function selectOrdered(inputs) {
  const ordered = walkOrdered(inputs);
  const shared = { refusals: ordered.refusals, proposals: [], trail: ordered.trail };
  if (ordered.chosen) return writeDecision({ inputs, lead: ordered.chosen, survivors: [], advisories: [], shared });
  return noneDecision(orderedReason(inputs.order, ordered.trail[0]), { ...shared, fallback: null });
}

export function selectTopic(inputs) {
  requireWiring(inputs);
  if (inputs.order !== null) return selectOrdered(inputs);
  const { report } = inputs;
  const posts = walkPosts(inputs);
  const weak = posts.chosen ? { chosen: null, trail: [], refusals: [] } : walkWeak(inputs);
  const lead = posts.chosen ?? weak.chosen;
  const terms = walkTerms(inputs, lead);
  const measured = strengthenCandidates(report).map((row) => measuredAdvisory(row, report));
  const advisories = [...measured, ...posts.advisories, ...terms.advisories];
  const shared = {
    refusals: [...posts.refusals, ...weak.refusals, ...terms.refusals],
    proposals: proposalCandidates(report),
    trail: [...posts.trail, ...weak.trail, ...terms.trail],
  };
  if (lead) return writeDecision({ inputs, lead, survivors: terms.survivors, advisories, shared });
  const unwritten = { ...shared, fallback: categoryFallback(inputs) };
  const [first, ...rest] = advisories;
  if (first) return strengthenDecision(first, rest, unwritten);
  return noneDecision(noneReason({ report, trail: unwritten.trail }), unwritten);
}

export function categoryEntry({ category, query, proposal, ...context }) {
  const examined = examineQuery(query, context);
  if (examined.outcome !== 'chosen') {
    return { refusal: { outcome: examined.outcome, detail: examined.detail, ledger: examined.refusal ?? null } };
  }
  const { posts, claims, now } = context;
  const [standing] = categoryStandings({ rotation: [category], posts, claims, now });
  return {
    entry: {
      format: 'article',
      topic: examined.topic,
      demand: { impressions: 0, position: null },
      table: null,
      row: null,
      choice: categoryChoice(standing),
      origin: 'category',
      category,
      proposal,
    },
  };
}
