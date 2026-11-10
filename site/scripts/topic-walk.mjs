import { normaliseTitle } from './autowriter-claims.mjs';
import { restoreCase } from './topic-casing.mjs';
import { claimRefusal } from './topic-claims.mjs';
import { promptCandidates, termCandidates, weakCandidates } from './topic-demand.mjs';
import { topicFrom } from './topic-format.mjs';
import { isHandled } from './keyword-handled.mjs';
import { keywordCandidates } from './topic-keywords.mjs';
import { ownerRefusal } from './topic-owners.mjs';
import { existingArticles, repeatRefusal } from './topic-repeat.mjs';
import {
  keywordChoice,
  keywordReason,
  noSuchPrompt,
  postChoice,
  promptReason,
  retiredPrompt,
  strengthens,
  termChoice,
  termReason,
} from './topic-wording.mjs';

const POST_ADVISED = new Set(['register-owner', 'family-served']);

const ledgerRefusal = ({ title }, { reason, against, detail }) => ({ title, reason, against, detail });

const refusedBy = (topic, refusal) => ({
  outcome: refusal.reason,
  topic,
  detail: refusal.detail,
  refusal: ledgerRefusal(topic, refusal),
});

const survives = (topic) => ({ outcome: 'chosen', topic, detail: topic.title });

const stepOf = (arm, subject, { outcome, detail }) => ({ arm, ...subject, outcome, ...(detail ? { detail } : {}) });

function record(walk, { refusal, advisory }) {
  if (refusal) walk.refusals.push(refusal);
  if (advisory) walk.advisories.push(advisory);
}

const promptAdvisory = (candidate, owned, report) => ({
  source: owned.reason,
  route: owned.route,
  query: candidate.prompt,
  number: candidate.number,
  impressions: 0,
  position: null,
  reason: promptReason(candidate, owned.detail),
  choice: strengthens(postChoice(candidate, report), owned.route),
});

const termAdvisory = (candidate, owned, report) => ({
  source: owned.reason,
  route: owned.route,
  query: candidate.query,
  number: candidate.prompts[0] ?? null,
  impressions: candidate.impressions,
  position: candidate.position,
  reason: termReason(candidate, report, owned.detail),
  choice: strengthens(termChoice(candidate, report), owned.route),
});

const keywordAdvisory = (candidate, { outcome, detail, refusal }) => ({
  source: outcome,
  route: refusal.against,
  query: candidate.phrase,
  number: null,
  impressions: candidate.exact,
  position: null,
  reason: keywordReason(candidate, detail),
  choice: strengthens(keywordChoice(candidate), refusal.against),
});

const isAdvised = (candidate, { outcome, refusal }, handled) =>
  POST_ADVISED.has(outcome) &&
  !isHandled(handled, { phrase: candidate.phrase, route: refusal.against, exact: candidate.exact });

const keywordRecord = (candidate, result, handled) =>
  isAdvised(candidate, result, handled) ? { ...result, advisory: keywordAdvisory(candidate, result) } : result;

function examinePrompt(candidate, context) {
  const source = context.promptSources.get(candidate.number);
  if (source?.retired) return { outcome: 'retired' };
  const topic = topicFrom(candidate.prompt);
  if (topic.format === null) return { outcome: topic.reason };
  if (topic.format === 'term') return { outcome: 'definition' };
  const { concepts, generated } = context;
  const owned = ownerRefusal({ topic, concepts, promptRoutes: source?.routes ?? [], generated });
  if (owned) {
    const refused = refusedBy(topic, owned);
    return POST_ADVISED.has(owned.reason)
      ? { ...refused, advisory: promptAdvisory(candidate, owned, context.report) }
      : refused;
  }
  const held = claimRefusal({ ...context, topic });
  return held ? refusedBy(topic, held) : survives(topic);
}

function examineTerm(candidate, context) {
  const topic = topicFrom(candidate.text);
  if (topic.format === null) return { outcome: topic.reason };
  const { concepts, generated } = context;
  const owned = ownerRefusal({ topic, concepts, promptRoutes: [], generated });
  if (owned) return { ...refusedBy(topic, owned), advisory: termAdvisory(candidate, owned, context.report) };
  const held = claimRefusal({ ...context, topic });
  return held ? refusedBy(topic, held) : survives(topic);
}

export function walkPosts(context) {
  const walk = { chosen: null, trail: [], refusals: [], advisories: [] };
  for (const candidate of promptCandidates(context.report)) {
    const result = examinePrompt(candidate, context);
    walk.trail.push(stepOf('post', { number: candidate.number }, result));
    record(walk, result);
    if (result.outcome === 'chosen') {
      walk.chosen = { candidate, topic: result.topic };
      break;
    }
  }
  return walk;
}

function take(taken, { slug, title }, suffix) {
  taken.slugs.add(slug);
  taken.titles.add(normaliseTitle(title, suffix));
}

function duplicateOf(topic, taken, suffix) {
  if (taken.slugs.has(topic.slug)) return `slug "${topic.slug}" was already chosen earlier in this run`;
  if (taken.titles.has(normaliseTitle(topic.title, suffix))) {
    return `title "${topic.title}" was already chosen earlier in this run`;
  }
  return null;
}

function settle(result, taken, suffix) {
  if (result.outcome !== 'chosen') return result;
  const detail = duplicateOf(result.topic, taken, suffix);
  return detail ? { outcome: 'same-concept', topic: result.topic, detail } : result;
}

export function walkTerms(context, post) {
  const walk = { survivors: [], trail: [], refusals: [], advisories: [] };
  const taken = { slugs: new Set(), titles: new Set() };
  if (post) take(taken, post.topic, context.suffix);
  for (const candidate of termCandidates(context.report, context.forms)) {
    const result = settle(examineTerm(candidate, context), taken, context.suffix);
    walk.trail.push(stepOf('term', { query: candidate.query }, result));
    record(walk, result);
    if (result.outcome === 'chosen') {
      walk.survivors.push({ candidate, topic: result.topic });
      take(taken, result.topic, context.suffix);
    }
  }
  return walk;
}

const UNMADE_DETAIL = {
  'title-too-long': (text) => `the query "${text}" would make a title longer than a page title has room for`,
  'no-slug': (text) => `the query "${text}" has no letter or digit a slug could be made from`,
};

const definitionMismatch = (text, topic) => ({
  outcome: 'format-mismatch',
  topic,
  detail: `the query "${text}" asks for the definition of "${topic.subject}", which is a glossary entry, not an article`,
});

export function examineQuery(text, context, promptRoutes = []) {
  const topic = topicFrom(restoreCase(text, context.forms));
  if (topic.format === null) return { outcome: topic.reason, detail: UNMADE_DETAIL[topic.reason](text) };
  if (topic.format !== 'article') return definitionMismatch(text, topic);
  const { concepts, generated } = context;
  const owned = ownerRefusal({ topic, concepts, promptRoutes, generated });
  if (owned) return refusedBy(topic, owned);
  const held = claimRefusal({ ...context, topic }) ?? repeatRefusal({ topic, existing: existingArticles(context) });
  return held ? refusedBy(topic, held) : survives(topic);
}

export function walkWeak(context) {
  const walk = { chosen: null, trail: [], refusals: [] };
  for (const candidate of weakCandidates(context.report)) {
    const result = examineQuery(candidate.query, context);
    walk.trail.push(stepOf('weak', { query: candidate.query }, result));
    if (result.refusal) walk.refusals.push(result.refusal);
    if (result.outcome === 'chosen') {
      walk.chosen = { candidate, topic: result.topic };
      break;
    }
  }
  return walk;
}

export function walkKeywords(context) {
  const walk = { chosen: null, trail: [], refusals: [], advisories: [] };
  const { handled = [] } = context.keywords;
  for (const candidate of keywordCandidates(context.keywords)) {
    const result = examineQuery(candidate.phrase, context);
    walk.trail.push(stepOf('keyword', { query: candidate.phrase }, result));
    record(walk, keywordRecord(candidate, result, handled));
    if (result.outcome === 'chosen') {
      walk.chosen = { candidate, topic: result.topic };
      break;
    }
  }
  return walk;
}

const orderSubject = (order) => (order.kind === 'prompt' ? { number: order.number } : { query: order.text });

function orderCandidate(order, { report, promptSources }) {
  if (order.kind === 'title') return { candidate: { arm: 'ordered', order }, text: order.text };
  const row = report.prompts.find(({ number }) => number === order.number);
  if (row === undefined) {
    return { refused: { outcome: 'no-such-prompt', detail: noSuchPrompt(order.number, report.prompts.length) } };
  }
  const source = promptSources.get(row.number);
  if (source?.retired) return { refused: { outcome: 'retired', detail: retiredPrompt(row.number) } };
  const { number, prompt, impressions, position, cells } = row;
  const candidate = { arm: 'ordered', order, number, prompt, impressions, position, row: cells };
  return { candidate, text: prompt, routes: source?.routes ?? [] };
}

export function walkOrdered(context) {
  const { order } = context;
  const walk = { chosen: null, trail: [], refusals: [] };
  const resolved = orderCandidate(order, context);
  const result = resolved.refused ?? examineQuery(resolved.text, context, resolved.routes);
  walk.trail.push(stepOf('ordered', orderSubject(order), result));
  if (result.refusal) walk.refusals.push(result.refusal);
  if (result.outcome === 'chosen') walk.chosen = { candidate: resolved.candidate, topic: result.topic };
  return walk;
}
