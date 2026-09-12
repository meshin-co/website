import { absoluteUrl } from './machine-text.mjs';
import { teaser } from './faq-meta.mjs';

export const FEED_BASES = {
  post: 'blog',
  service: 'services',
  resource: 'resources',
  glossary: 'glossary',
  case: 'case-studies',
  faq: 'faq',
};

export const isLive = ({ data }) => !data.draft && !data.noindex;

export function toFeedSource(entry, { kind, base, site }) {
  const isQuestion = 'answer' in entry.data;
  return {
    url: absoluteUrl(site, `/${base}/${entry.id}`),
    title: isQuestion ? entry.data.question : entry.data.title,
    summary: isQuestion ? teaser(entry.data.answer) : (entry.data.shortAnswer ?? entry.data.description),
    body: isQuestion ? entry.data.answer : (entry.body ?? ''),
    publishDate: entry.data.publishDate,
    updatedDate: entry.data.updatedDate,
    tags: isQuestion ? [entry.data.category] : (entry.data.tags ?? []),
    kind,
  };
}
