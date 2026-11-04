import { lastmod } from './lastmod.mjs';
import { teaser } from './faq-meta.mjs';
import { FEED_WINDOW, MERGED_FEED_WINDOW } from './feeds.mjs';
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
      description: `Merged full-text feed of the ${MERGED_FEED_WINDOW} newest entries, with at least five of each collection.`,
    },
    ...LLMS_COLLECTIONS.map(({ name, base, title }) => ({
      name,
      url: `${base}/rss.xml`,
      title: `${title} feed`,
      description: `Full-text feed of the ${FEED_WINDOW} newest entries in ${title.toLowerCase()}.`,
    })),
  ];
}

export function llmsCollectionPointers(counts) {
  return LLMS_COLLECTIONS.filter(({ name }) => counts[name] > 0).map(({ file, name, title }) => ({
    url: file,
    title,
    description: `${entryCount(counts[name])}, full body text of each.`,
  }));
}

export function llmsFullTextPointers(counts) {
  return [
    {
      url: '/llms-full.txt',
      title: 'Full text index',
      description: 'The collection files that hold the full body text of every live entry, one line each.',
    },
    ...llmsCollectionPointers(counts),
  ];
}

export const LLMS_FILE_MAX_BYTES = 100_000;

export const LLMS_SHARD_FRAME_BYTES = 1_024;

export const LARGEST_MEASURED_ENTRY_BYTES = {
  service: 2_055,
  post: 28_454,
  resource: 13_269,
  glossary: 2_938,
  faq: 832,
};

const LARGEST_MEASURED_ENTRY_ANYWHERE = Math.max(...Object.values(LARGEST_MEASURED_ENTRY_BYTES));

export const LLMS_SHARD_MAX_ENTRIES = Object.fromEntries(
  LLMS_COLLECTIONS.map(({ name }) => [
    name,
    Math.floor(
      (LLMS_FILE_MAX_BYTES - LLMS_SHARD_FRAME_BYTES) /
        (LARGEST_MEASURED_ENTRY_BYTES[name] ?? LARGEST_MEASURED_ENTRY_ANYWHERE)
    ),
  ])
);

export const LLMS_FULL_MAX_BYTES = 4_096;

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function orderEntries(entries) {
  return [...entries].sort((a, b) => compare(a.published ?? '', b.published ?? '') || compare(a.id, b.id));
}

export function llmsCollectionFiles({ site, origin, name, title, entries, max = LLMS_SHARD_MAX_ENTRIES[name] }) {
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
