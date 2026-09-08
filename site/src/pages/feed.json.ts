import { getCollection } from 'astro:content';

import { SITE, METADATA } from 'astrowind:config';
import { absoluteUrl, buildFeedItems } from '~/utils/machine-text.mjs';

export const prerender = true;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

type Entry = {
  id: string;
  body?: string;
  data: {
    title: string;
    description: string;
    shortAnswer?: string;
    publishDate?: Date;
    updatedDate?: Date;
    tags?: string[];
  };
};

const toEntry = (site: string, base: string) => (entry: Entry) => ({
  url: absoluteUrl(site, `${base}/${entry.id}`),
  title: entry.data.title,
  summary: entry.data.shortAnswer ?? entry.data.description,
  body: entry.body ?? '',
  publishDate: entry.data.publishDate,
  updatedDate: entry.data.updatedDate,
  tags: entry.data.tags,
});

export const GET = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');
  const [services, posts, resources, glossary, cases] = await Promise.all([
    getCollection('service', isLive),
    getCollection('post', isLive),
    getCollection('resource', isLive),
    getCollection('glossary', isLive),
    getCollection('case', isLive),
  ]);

  const entries = [
    ...services.map(toEntry(site, '/services')),
    ...posts.map(toEntry(site, '/blog')),
    ...resources.map(toEntry(site, '/resources')),
    ...glossary.map(toEntry(site, '/glossary')),
    ...cases.map(toEntry(site, '/case-studies')),
  ];

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE.name,
    home_page_url: site,
    feed_url: absoluteUrl(site, '/feed.json'),
    description: METADATA.description,
    items: buildFeedItems(entries),
  };

  return new Response(JSON.stringify(feed), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
};
