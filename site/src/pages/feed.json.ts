import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { SITE, METADATA } from 'astrowind:config';
import { mergedFeedItems } from '~/utils/feed-items.mjs';
import { FEED_BASES, isLive } from '~/utils/feeds.mjs';
import { absoluteUrl } from '~/utils/machine-text.mjs';

export const prerender = true;

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE.name,
    home_page_url: site,
    feed_url: absoluteUrl(site, '/feed.json'),
    description: METADATA.description,
    items: await mergedFeedItems((kind: keyof typeof FEED_BASES) => getCollection(kind, isLive), site),
  };

  return new Response(JSON.stringify(feed), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
};
