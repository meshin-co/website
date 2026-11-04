import { buildFeedItems, mergeWithKindFloor } from './machine-text.mjs';
import { FEED_BASES, FEED_WINDOW, MERGED_FEED_WINDOW, isLive, toFeedSource } from './feeds.mjs';

const byNewestThenUrl = (a, b) => {
  if (a.date_modified !== b.date_modified) return a.date_modified < b.date_modified ? 1 : -1;
  return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
};

export function lastBuildDate(items) {
  const newest = items[0]?.date_published ?? new Date().toISOString();
  return `<lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>`;
}

export async function mergedFeedItems(load, site) {
  const sources = [];
  for (const kind of Object.keys(FEED_BASES)) {
    const base = FEED_BASES[kind];
    const entries = (await load(kind)).filter(isLive);
    sources.push(...entries.map((entry) => toFeedSource(entry, { kind, base, site })));
  }
  return buildFeedItems(mergeWithKindFloor(sources, { window: MERGED_FEED_WINDOW, floor: 5 }));
}

export async function collectionFeedItems(entries, site, kind, base) {
  const sources = entries.filter(isLive).map((entry) => toFeedSource(entry, { kind, base, site }));
  return buildFeedItems(sources).sort(byNewestThenUrl).slice(0, FEED_WINDOW);
}
