import { getCollection } from 'astro:content';

import { SITE, METADATA } from 'astrowind:config';
import {
  absoluteUrl,
  collectionHubs,
  liveTopicMap,
  publicIndexableStaticPages,
  renderLlmsTxt,
} from '~/utils/machine-text.mjs';
import { LLMS_COLLECTIONS, latestUpdated, llmsFeedPointers, toLlmsEntry } from '~/utils/llms-collections.mjs';
import { archiveTitleOf, categoryPillars } from '~/data/categories.mjs';
import { tagArchive, tagBySlug } from '~/data/tags.mjs';
import { lastmod } from '~/utils/lastmod.mjs';

export const prerender = true;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

const HUB_DESCRIPTIONS: Record<string, string> = {
  post: 'Every article, browsable by category and tag.',
  service: 'The three ways to work together: assessment, sprint, retainer.',
  resource: 'Open templates and checklists for AI governance.',
  glossary: 'Plain definitions of the AI governance terms used across the site.',
  case: 'Case studies of the method applied in production.',
};

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

  const staticPaths = publicIndexableStaticPages().map((page) => page.path);
  const hubCandidates = LLMS_COLLECTIONS.map(({ name, base, title }, index) => ({
    name,
    base,
    title,
    updated: freshnessByCollection[index],
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

  const posts = await getCollection('post', ({ data }) => !data.draft);
  const postFacts = posts.map((post) => ({
    category: post.data.category,
    tags: post.data.tags,
    updated: lastmod(post.data),
  }));

  const categoryItems = [...liveTopicMap(postFacts, 'category').entries()]
    .map(([slug, updated]) => {
      const pillar = categoryPillars[slug as keyof typeof categoryPillars];
      return {
        title: pillar ? archiveTitleOf(pillar) : slug,
        description: pillar?.description ?? `Articles in the ${slug} category.`,
        updated,
        url: absoluteUrl(site, `/blog/category/${slug}`),
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url));

  const tagItems = [...liveTopicMap(postFacts, 'tags').entries()]
    .map(([slug, updated]) => {
      const archive = tagBySlug[slug] ? tagArchive(tagBySlug[slug]) : null;
      return {
        title: archive?.title ?? slug,
        description: archive?.description ?? `All posts tagged ${slug}, newest first.`,
        updated,
        url: absoluteUrl(site, `/blog/tag/${slug}`),
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url));

  sections.push({ title: 'Topics', items: [...categoryItems, ...tagItems] });

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
