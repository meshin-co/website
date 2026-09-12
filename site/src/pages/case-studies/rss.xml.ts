import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

import { SITE, METADATA } from 'astrowind:config';
import { collectionFeedItems, lastBuildDate } from '~/utils/feed-items.mjs';
import { toRssItems } from '~/utils/machine-text.mjs';

export const prerender = true;

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');
  const entries = await getCollection('case');
  const items = await collectionFeedItems(entries, site, 'case', 'case-studies');

  return rss({
    title: `${SITE.name} — Case studies`,
    description: METADATA.description ?? '',
    site,
    items: toRssItems(items),
    customData: lastBuildDate(items),
  });
};
