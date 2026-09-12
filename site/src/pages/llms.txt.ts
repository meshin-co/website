import { getCollection } from 'astro:content';

import { SITE, METADATA } from 'astrowind:config';
import { absoluteUrl, publicIndexableStaticPages, renderLlmsTxt } from '~/utils/machine-text.mjs';
import {
  COLLECTION_NAMES,
  LLMS_COLLECTIONS,
  latestUpdated,
  llmsFeedPointers,
  toLlmsEntry,
} from '~/utils/llms-collections.mjs';

export const prerender = true;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

export const GET = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');

  const sections: { title: string; items: { url: string }[] }[] = [];
  const freshnessByCollection: (string | null)[] = [];

  for (const { name, base, title } of LLMS_COLLECTIONS) {
    const entries = await getCollection(name as Parameters<typeof getCollection>[0], isLive);
    const mapped = entries.map(toLlmsEntry());
    freshnessByCollection.push(latestUpdated(mapped));
    sections.push({
      title,
      items: mapped.map((entry) => ({
        title: entry.title,
        description: entry.description,
        updated: entry.updated,
        url: absoluteUrl(site, `${base}/${entry.id}`),
      })),
    });
  }

  const mergedFreshness = latestUpdated(freshnessByCollection.map((updated) => ({ updated })));
  sections.push({
    title: 'Feeds',
    items: llmsFeedPointers().map((feed, index) => ({
      title: feed.title,
      description: feed.description,
      updated: index === 0 ? mergedFreshness : freshnessByCollection[index - 1],
      url: absoluteUrl(site, feed.url),
    })),
  });

  sections.push({
    title: 'Pages',
    items: publicIndexableStaticPages().map(({ path, title, description }) => ({
      title,
      description,
      url: absoluteUrl(site, path),
    })),
  });

  const body = renderLlmsTxt({ site: SITE.name, tagline: METADATA.description, sections });

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
