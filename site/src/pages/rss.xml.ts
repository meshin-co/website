import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

import { SITE, METADATA } from 'astrowind:config';
import { lastBuildDate, mergedFeedItems } from '~/utils/feed-items.mjs';
import { FEED_BASES, isLive } from '~/utils/feeds.mjs';
import { toRssItems } from '~/utils/machine-text.mjs';

export const prerender = true;

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');
  const items = await mergedFeedItems((kind: keyof typeof FEED_BASES) => getCollection(kind, isLive), site);

  return rss({
    title: SITE.name,
    description: METADATA.description ?? '',
    site,
    items: toRssItems(items),
    customData: lastBuildDate(items),
  });
};
