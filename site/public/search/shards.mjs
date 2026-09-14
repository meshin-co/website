import { buildIndexEntry } from './index-model.mjs';

export const ENTRY_TEXT_CAPS = {
  post: 16384,
  glossary: 4096,
  resource: 4096,
  service: 3072,
  case: 4096,
  faq: 1024,
  page: 4096,
};

export const KINDS = {
  post: { label: 'Writing', singular: 'article', plural: 'articles' },
  glossary: { label: 'Glossary', singular: 'term', plural: 'terms' },
  resource: { label: 'Resource', singular: 'resource', plural: 'resources' },
  service: { label: 'Service', singular: 'service', plural: 'services' },
  case: { label: 'Case study', singular: 'case study', plural: 'case studies' },
  faq: { label: 'Answer', singular: 'answer', plural: 'answers' },
  page: { label: 'Page', singular: 'page', plural: 'pages' },
};

export const shardHref = (kind) => `/search-index-${kind}.json`;

export const words = (parts) => parts.filter((part) => typeof part === 'string' && part.trim() !== '').join(' ');

const faqPairs = (items = []) => words(items.map(({ q, a }) => `${q} ${a}`));

const outcomeMetrics = ({ metrics = [] } = {}) =>
  words(metrics.map(({ label, before, after }) => `${label} ${before} to ${after}`));

const textFor = {
  post: ({ keyTakeaways = [], fullAnswer = '', faq = [], body = '' }) =>
    words([...keyTakeaways, fullAnswer, faqPairs(faq), body]),
  glossary: ({ shortDefinition = '', definition = '', body = '' }) => words([shortDefinition, definition, body]),
  resource: ({ body = '' }) => words([body]),
  service: ({ shortAnswer = '', deliverables = [], faq = [], body = '' }) =>
    words([shortAnswer, ...deliverables, faqPairs(faq), body]),
  case: ({ problem = '', approach = '', outcome, body = '' }) =>
    words([problem, approach, outcomeMetrics(outcome), body]),
  faq: ({ question = '', answer = '' }) => words([question, answer]),
  page: ({ body = '' }) => words([body]),
};

export function buildShardEntry(kind, record) {
  const entry = buildIndexEntry({
    href: record.href,
    title: record.title ?? record.question,
    description: record.description ?? record.answer ?? '',
    kind: KINDS[kind].label,
    body: textFor[kind](record),
  });
  const cap = ENTRY_TEXT_CAPS[kind];
  return entry.text.length > cap ? { ...entry, text: entry.text.slice(0, cap) } : entry;
}

const KIND_ORDER = Object.keys(KINDS);
const kindByLabel = new Map(KIND_ORDER.map((kind) => [KINDS[kind].label, kind]));

export function summaryLine(entries, query) {
  if (entries.length === 0) return `No pages match “${query}”.`;

  const counts = new Map();
  for (const { kind } of entries) counts.set(kind, (counts.get(kind) ?? 0) + 1);

  const groups = [...counts]
    .map(([label, count]) => {
      const kind = kindByLabel.get(label);
      const { singular, plural } = KINDS[kind];
      return { order: KIND_ORDER.indexOf(kind), count, noun: count === 1 ? singular : plural };
    })
    .sort((a, b) => b.count - a.count || a.order - b.order);

  const listed = groups.map(({ count, noun }) => `${count} ${noun}`).join(' · ');
  return `${listed} ${entries.length === 1 ? 'matches' : 'match'} “${query}”.`;
}
