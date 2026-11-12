import { lastmod } from './lastmod.mjs';
import { teaser } from './faq-meta.mjs';
import { FEED_WINDOW, MERGED_FEED_WINDOW, SERIES_COLLECTIONS } from './feeds.mjs';
import { absoluteUrl, entryCount, renderLlmsCollection, renderLlmsIndex, renderLlmsShard } from './machine-text.mjs';
import { seriesDescription, seriesLabel } from './spec-series.mjs';

export const LLMS_COLLECTIONS = [
  { name: 'service', base: '/services', title: 'Offers', file: '/llms/service.txt' },
  { name: 'post', base: '/blog', title: 'Writing', file: '/llms/post.txt' },
  { name: 'resource', base: '/resources', title: 'Resources', file: '/llms/resource.txt' },
  { name: 'glossary', base: '/glossary', title: 'Glossary', file: '/llms/glossary.txt' },
  { name: 'case', base: '/case-studies', title: 'Case studies', file: '/llms/case.txt' },
  { name: 'faq', base: '/faq', title: 'Questions and answers', file: '/llms/faq.txt' },
  { name: 'spec', base: '/spec', title: 'Specifications', file: '/llms/spec.txt' },
];

export const HUB_COLLECTIONS = LLMS_COLLECTIONS.filter(({ name }) => !SERIES_COLLECTIONS.has(name));

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

export const llmsSeriesHubs = (base, series) =>
  series.map(({ name, updated }) => ({
    title: seriesLabel(name),
    description: seriesDescription(name),
    updated,
    url: `${base}/${name}`,
  }));

export const LLMS_FILE_MAX_BYTES = 100_000;

export const LLMS_FULL_MAX_BYTES = 4_096;

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function orderEntries(entries) {
  return [...entries].sort((a, b) => compare(a.published ?? '', b.published ?? '') || compare(a.id, b.id));
}

const bytesOf = (text) => Buffer.byteLength(text, 'utf8');

function packShards({ total, maxBytes, render }) {
  const shards = [];
  let first = 0;
  while (first < total) {
    const position = shards.length;
    let end = first + 1;
    let text = render({ position, first, end });
    while (end < total) {
      const longer = render({ position, first, end: end + 1 });
      if (bytesOf(longer) > maxBytes) break;
      end += 1;
      text = longer;
    }
    shards.push({ from: first + 1, to: end, text });
    first = end;
  }
  return shards;
}

export function llmsCollectionFiles({ site, origin, name, title, entries, maxBytes = LLMS_FILE_MAX_BYTES }) {
  const live = orderEntries(entries.filter((entry) => !entry.draft && !entry.noindex));
  const whole = renderLlmsCollection({ site, title, entries: live });
  if (bytesOf(whole) <= maxBytes) return [{ param: name, text: whole }];

  const paramOf = (position) => `${name}-${position + 1}`;
  const urlOf = (position) => absoluteUrl(origin, `/llms/${paramOf(position)}.txt`);
  const shards = packShards({
    total: live.length,
    maxBytes,
    render: ({ position, first, end }) =>
      renderLlmsShard({
        site,
        title,
        entries: live.slice(first, end),
        from: first + 1,
        to: end,
        nextUrl: end < live.length ? urlOf(position + 1) : null,
      }),
  });
  const index = renderLlmsIndex({
    site,
    title,
    shards: shards.map(({ from, to }, position) => ({ url: urlOf(position), from, to, count: to - from + 1 })),
  });
  return [{ param: name, text: index }, ...shards.map(({ text }, position) => ({ param: paramOf(position), text }))];
}
