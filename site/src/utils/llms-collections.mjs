import { lastmod } from './lastmod.mjs';
import { teaser } from './faq-meta.mjs';
import { absoluteUrl, entryCount, renderLlmsCollection, renderLlmsIndex, renderLlmsShard } from './machine-text.mjs';

export const LLMS_COLLECTIONS = [
  { name: 'service', base: '/services', title: 'Offers', file: '/llms/service.txt' },
  { name: 'post', base: '/blog', title: 'Writing', file: '/llms/post.txt' },
  { name: 'resource', base: '/resources', title: 'Resources', file: '/llms/resource.txt' },
  { name: 'glossary', base: '/glossary', title: 'Glossary', file: '/llms/glossary.txt' },
  { name: 'case', base: '/case-studies', title: 'Case studies', file: '/llms/case.txt' },
  { name: 'faq', base: '/faq', title: 'Questions and answers', file: '/llms/faq.txt' },
];

export function toLlmsEntry() {
  return (entry) => {
    const isFaq = 'answer' in entry.data;
    return {
      id: entry.id,
      title: isFaq ? entry.data.question : entry.data.title,
      description: isFaq ? teaser(entry.data.answer) : (entry.data.shortAnswer ?? entry.data.description),
      body: isFaq ? entry.data.answer : (entry.body ?? ''),
      updated: lastmod(entry.data),
      published: entry.data.publishDate ? new Date(entry.data.publishDate).toISOString() : null,
      draft: Boolean(entry.data.draft),
      noindex: Boolean(entry.data.noindex),
    };
  };
}

export function latestUpdated(entries) {
  const stamps = entries.map((entry) => entry.updated).filter(Boolean);
  return stamps.length === 0 ? null : stamps.reduce((a, b) => (a < b ? b : a));
}

export function llmsFeedPointers() {
  return [
    {
      name: '',
      url: '/rss.xml',
      title: 'All updates',
      description: 'Merged full-text feed of every live entry, newest first.',
    },
    ...LLMS_COLLECTIONS.map(({ name, base, title }) => ({
      name,
      url: `${base}/rss.xml`,
      title: `${title} feed`,
      description: `Full-text feed of every live entry in ${title.toLowerCase()}.`,
    })),
  ];
}

export function llmsFullTextPointers(counts) {
  return [
    {
      url: '/llms-full.txt',
      title: 'Everything in full',
      description: 'Full body text of every live entry, one section per collection.',
    },
    ...LLMS_COLLECTIONS.filter(({ name }) => counts[name] > 0).map(({ file, name, title }) => ({
      url: file,
      title,
      description: `${entryCount(counts[name])}, full body text of each.`,
    })),
  ];
}

export const LLMS_SHARD_MAX_ENTRIES = 100;

export const LLMS_FULL_MAX_BYTES = 2_000_000;

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function orderEntries(entries) {
  return [...entries].sort((a, b) => compare(a.published ?? '', b.published ?? '') || compare(a.id, b.id));
}

export function llmsCollectionFiles({ site, origin, name, title, entries, max = LLMS_SHARD_MAX_ENTRIES }) {
  const live = orderEntries(entries.filter((entry) => !entry.draft && !entry.noindex));
  if (live.length <= max) return [{ param: name, text: renderLlmsCollection({ site, title, entries: live }) }];

  const parts = Array.from({ length: Math.ceil(live.length / max) }, (_, index) => {
    const from = index * max + 1;
    const slice = live.slice(index * max, index * max + max);
    return { param: `${name}-${index + 1}`, from, to: from + slice.length - 1, entries: slice };
  });
  const urlOf = (part) => absoluteUrl(origin, `/llms/${part.param}.txt`);
  const shards = parts.map((part, index) => ({
    param: part.param,
    text: renderLlmsShard({
      site,
      title,
      entries: part.entries,
      from: part.from,
      to: part.to,
      nextUrl: parts[index + 1] ? urlOf(parts[index + 1]) : null,
    }),
  }));
  const index = renderLlmsIndex({
    site,
    title,
    shards: parts.map((part) => ({ url: urlOf(part), from: part.from, to: part.to, count: part.entries.length })),
  });
  return [{ param: name, text: index }, ...shards];
}
