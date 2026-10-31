import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

import { FEED_BASES, emptyHubRoutes } from './feeds.mjs';
import { lastmod } from './lastmod.mjs';
import { liveTopicMap } from './machine-text.mjs';

async function frontmatterEntries(dir) {
  const files = (await readdir(dir).catch(() => [])).filter((file) => /\.mdx?$/.test(file));
  const entries = [];
  for (const file of files) {
    const text = await readFile(join(dir, file), 'utf8');
    const raw = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
    if (!raw) continue;
    entries.push({ slug: file.replace(/\.mdx?$/, ''), data: yaml.load(raw) });
  }
  return entries;
}

const isLiveFrontmatter = (data) => !data?.draft && !data?.noindex;

const TAG_INDEX_ROUTE = '/blog/tags';
const COLLECTION_OWNED_ROUTES = new Set([...Object.values(FEED_BASES).map((base) => `/${base}`), TAG_INDEX_ROUTE]);

export async function collectionLastmods(dataDir) {
  const lastmods = {};
  for (const [kind, base] of Object.entries(FEED_BASES)) {
    for (const { slug, data } of await frontmatterEntries(join(dataDir, kind))) {
      const modified = lastmod(data);
      if (modified) lastmods[`/${base}/${slug}`] = modified;
    }
  }
  return lastmods;
}

export async function hubLastmods(dataDir) {
  const hubs = {};
  for (const [kind, base] of Object.entries(FEED_BASES)) {
    const dates = (await frontmatterEntries(join(dataDir, kind)))
      .filter(({ data }) => isLiveFrontmatter(data))
      .map(({ data }) => lastmod(data))
      .filter(Boolean)
      .sort();
    if (dates.length > 0) hubs[`/${base}`] = dates.at(-1);
  }
  return hubs;
}

export async function taxonomyLastmods(dataDir) {
  const posts = (await frontmatterEntries(join(dataDir, 'post')))
    .filter(({ data }) => isLiveFrontmatter(data))
    .map(({ data }) => ({ category: data.category, tags: data.tags, updated: lastmod(data) }));

  const lastmods = {};
  for (const [slug, updated] of liveTopicMap(posts, 'category')) {
    if (updated) lastmods[`/blog/category/${slug}`] = updated;
  }
  const tagMap = liveTopicMap(posts, 'tags');
  for (const [slug, updated] of tagMap) {
    if (updated) lastmods[`/blog/tag/${slug}`] = updated;
  }
  const newestTag = [...tagMap.values()].filter(Boolean).sort().at(-1);
  if (newestTag) lastmods[TAG_INDEX_ROUTE] = newestTag;

  return lastmods;
}

export async function noindexEntryRoutes(dataDir) {
  const routes = [];
  for (const [kind, base] of Object.entries(FEED_BASES)) {
    for (const { slug, data } of await frontmatterEntries(join(dataDir, kind))) {
      if (!data?.draft && data?.noindex) routes.push(`/${base}/${slug}`);
    }
  }
  return routes;
}

export async function noindexCategoryRoutes(dataDir, categorySlugs) {
  const posts = (await frontmatterEntries(join(dataDir, 'post'))).filter(({ data }) => !data?.draft);
  const withPosts = new Set(posts.map(({ data }) => data.category));
  return categorySlugs.filter((slug) => !withPosts.has(slug)).map((slug) => `/blog/category/${slug}`);
}

export const noindexHubRoutes = (dataDir) =>
  emptyHubRoutes(async (kind) =>
    (await frontmatterEntries(join(dataDir, kind))).filter(({ data }) => isLiveFrontmatter(data))
  );

export function staticPageLastmods(pages) {
  const lastmods = {};
  for (const page of pages) {
    const modified = lastmod(page);
    if (!modified) throw new Error(`static page ${page.path} carries no updatedDate`);
    lastmods[page.path] = modified;
  }
  return lastmods;
}

export async function siteLastmods({ dataDir, staticPages }) {
  const pagesDatedByCatalog = staticPages.filter((page) => !COLLECTION_OWNED_ROUTES.has(page.path));

  return {
    ...(await collectionLastmods(dataDir)),
    ...staticPageLastmods(pagesDatedByCatalog),
    ...(await hubLastmods(dataDir)),
    ...(await taxonomyLastmods(dataDir)),
  };
}
