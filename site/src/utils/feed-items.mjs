import { buildFeedItems, mergeWithKindFloor } from './machine-text.mjs';
import { FEED_BASES, isLive, toFeedSource } from './feeds.mjs';

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
  return buildFeedItems(mergeWithKindFloor(sources));
}

export async function collectionFeedItems(entries, site, kind, base) {
  return buildFeedItems(entries.filter(isLive).map((entry) => toFeedSource(entry, { kind, base, site })));
}
