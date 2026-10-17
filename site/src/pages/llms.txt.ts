import { getCollection } from 'astro:content';

import { SITE, METADATA } from 'astrowind:config';
import { absoluteUrl, collectionHubs, publicIndexableStaticPages, renderLlmsTxt } from '~/utils/machine-text.mjs';
import {
  LLMS_COLLECTIONS,
  latestUpdated,
  llmsFeedPointers,
  llmsFullTextPointers,
  orderEntries,
  toLlmsEntry,
} from '~/utils/llms-collections.mjs';

export const prerender = true;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

const INLINE_COLLECTION = 'service';

const HUB_DESCRIPTIONS: Record<string, string> = {
  post: 'Every article, browsable by category and tag.',
  service: 'The three ways to work together: assessment, sprint, retainer.',
  resource: 'Open templates and checklists for AI governance.',
  glossary: 'Plain definitions of the AI governance terms used across the site.',
  case: 'Client case studies, listed once a client agrees in writing.',
};

export const GET = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');

  const sections: { title: string; items: { url: string }[] }[] = [];
  const freshnessByName: Record<string, string | null> = {};
  const entryCounts: Record<string, number> = {};

  for (const { name, base, title } of LLMS_COLLECTIONS) {
    const entries = await getCollection(name as Parameters<typeof getCollection>[0], isLive);
    const mapped = entries.map(toLlmsEntry());
    freshnessByName[name] = latestUpdated(mapped);
    entryCounts[name] = mapped.length;
    if (name !== INLINE_COLLECTION) continue;
    sections.push({
      title,
      items: orderEntries(mapped).map((entry) => ({
        title: entry.title,
        description: entry.description,
        updated: entry.updated,
        url: absoluteUrl(site, `${base}/${entry.id}`),
      })),
    });
  }

  sections.push({
    title: 'Pages',
    items: publicIndexableStaticPages().map(({ path, title, description }) => ({
      title,
      description,
      url: absoluteUrl(site, path),
    })),
  });

  const staticPaths = publicIndexableStaticPages().map((page) => page.path);
  const hubCandidates = LLMS_COLLECTIONS.filter(({ name }) => entryCounts[name] > 0).map(({ name, base, title }) => ({
    name,
    base,
    title,
    updated: freshnessByName[name],
  }));
  sections.push({
    title: 'Hubs',
    items: collectionHubs({ collections: hubCandidates, staticPaths }).map((hub: (typeof hubCandidates)[number]) => ({
      title: hub.title,
      description: HUB_DESCRIPTIONS[hub.name] ?? `${hub.title}, indexed on this site.`,
      updated: hub.updated,
      url: absoluteUrl(site, hub.base),
    })),
  });

  sections.push({
    title: 'Full text',
    items: llmsFullTextPointers(entryCounts).map((pointer) => ({
      title: pointer.title,
      description: pointer.description,
      url: absoluteUrl(site, pointer.url),
    })),
  });

  const mergedFreshness = latestUpdated(Object.values(freshnessByName).map((updated) => ({ updated })));
  sections.push({
    title: 'Feeds',
    items: llmsFeedPointers()
      .filter((feed) => !feed.name || entryCounts[feed.name] > 0)
      .map((feed) => ({
        title: feed.title,
        description: feed.description,
        updated: feed.name ? freshnessByName[feed.name] : mergedFreshness,
        url: absoluteUrl(site, feed.url),
      })),
  });

  const body = renderLlmsTxt({ site: SITE.name, tagline: METADATA.description, sections });

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
