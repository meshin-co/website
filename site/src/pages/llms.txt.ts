import { getCollection } from 'astro:content';

import { SITE, METADATA } from 'astrowind:config';
import { absoluteUrl, renderLlmsTxt, STATIC_PAGES } from '~/utils/machine-text.mjs';

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

const toItem = (site: string, base: string) => (entry: Entry) => ({
  title: entry.data.title,
  url: absoluteUrl(site, `${base}/${entry.id}`),
  description: entry.data.description,
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

  const sections = [
    { title: 'Offers', items: services.map(toItem(site, '/services')) },
    { title: 'Writing', items: posts.map(toItem(site, '/blog')) },
    { title: 'Resources', items: resources.map(toItem(site, '/resources')) },
    { title: 'Glossary', items: glossary.map(toItem(site, '/glossary')) },
    { title: 'Case studies', items: cases.map(toItem(site, '/case-studies')) },
    {
      title: 'About',
      items: STATIC_PAGES.map(({ path, title, description }) => ({ title, description, url: absoluteUrl(site, path) })),
    },
  ];

  const body = renderLlmsTxt({ site: SITE.name, tagline: METADATA.description, sections });

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
