import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { discoverRoutes, isNoindex } from './gate.mjs';
import { FEED_BASES } from '../src/utils/feeds.mjs';
import { NOINDEX_STATIC_PAGES } from '../src/utils/machine-text.mjs';

const NON_PUBLIC = new Set(['author', 'speaking']);
const FEED_FLOOR = 5;

export const COLLECTION_BASES = FEED_BASES;

export function publicCollections(configSource) {
  const block = configSource.match(/export const collections = \{([^}]*)\}/s);
  if (!block) throw new Error('machine: no collections export in the content config');

  return [...block[1].matchAll(/^\s*([A-Za-z][\w]*)\s*:/gm)]
    .map(([, name]) => name)
    .filter((name) => !NON_PUBLIC.has(name));
}

export function missingFromGenerator(text, collections) {
  return collections.filter((collection) => !text.includes(`/${COLLECTION_BASES[collection]}/`));
}
export function llmsIndexGaps(text, collections) {
  return collections.filter((collection) => !text.includes(`/llms/${collection}.txt`));
}

export function parseListedRoutes(text) {
  const listed = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/^- /, '');
    const link = /^\[[^\]]*\]\((https?:\/\/[^)]+)\)/.exec(trimmed);
    const url = link ? link[1] : /^https?:\/\/\S+$/.test(trimmed) ? trimmed : null;
    if (url) listed.add(new URL(url).pathname);
  }
  return listed;
}

export function llmsRouteGaps(text, routes) {
  const listed = parseListedRoutes(text);
  return routes.filter((route) => !listed.has(route));
}

export function indexableCoverageGaps({ routes, listed, noindexRoutes }) {
  const listedSet = listed instanceof Set ? listed : new Set(listed);
  const noindexSet = noindexRoutes instanceof Set ? noindexRoutes : new Set(noindexRoutes);
  return routes.filter((route) => !noindexSet.has(route) && !listedSet.has(route));
}

export function noindexStaticListings(text) {
  return [...NOINDEX_STATIC_PAGES].filter((path) => text.includes(`(${path})`));
}

export function sidecarGaps(routes, builtFiles) {
  const built = new Set(builtFiles.map((file) => `/${file.replace(/^\//, '')}`));
  const bases = new Set(Object.values(COLLECTION_BASES));

  const reserved = new Set(['tags', 'tag', 'page', 'category']);
  return routes
    .filter((route) => {
      const parts = route.split('/').filter(Boolean);
      return parts.length === 2 && bases.has(parts[0]) && !reserved.has(parts[1] ?? '');
    })
    .map((route) => `${route}.md`)
    .filter((sidecar) => !built.has(sidecar));
}

function toPath(url) {
  return url.replace(/^https?:\/\/[^/]+/, '');
}

function itemPaths(feedXml) {
  return [...feedXml.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map(([, url]) => toPath(url));
}

export function feedCoverageFailures(collections, { perCollectionFeeds, mergedFeed, jsonFeedItems, liveRoutesByKind }) {
  const failures = [];
  const mergedPaths = itemPaths(mergedFeed);

  for (const collection of collections) {
    const base = COLLECTION_BASES[collection];
    const feedPaths = itemPaths(perCollectionFeeds[collection] ?? '');
    for (const route of liveRoutesByKind[collection] ?? []) {
      if (!feedPaths.includes(route)) failures.push(`/${base}/rss.xml omits ${route}`);
    }

    const floor = Math.min(FEED_FLOOR, (liveRoutesByKind[collection] ?? []).length);
    const present = mergedPaths.filter((path) => path.startsWith(`/${base}/`)).length;
    if (present < floor) {
      failures.push(`merged rss.xml carries ${present} ${collection} entries, floor is ${floor}`);
    }
  }

  const jsonPaths = jsonFeedItems.map(toPath);
  const mirrored =
    jsonPaths.length === mergedPaths.length && jsonPaths.every((path, index) => path === mergedPaths[index]);
  if (!mirrored) failures.push('feed.json does not mirror rss.xml item-for-item');

  return failures;
}

async function routeHtml(distDir, route) {
  const withoutSlash = route.slice(1);
  for (const candidate of [join(distDir, withoutSlash, 'index.html'), join(distDir, `${withoutSlash}.html`)]) {
    const html = await readFile(candidate, 'utf8').catch(() => null);
    if (html !== null) return html;
  }
  return '';
}

async function noindexRoutesOf(distDir, routes) {
  const noindex = new Set();
  for (const route of routes) {
    if (isNoindex(await routeHtml(distDir, route))) noindex.add(route);
  }
  return noindex;
}

async function liveRoutesByKind(distDir, collections, routes) {
  const byKind = {};
  for (const collection of collections) {
    const base = COLLECTION_BASES[collection];
    const reserved = new Set(['tags', 'tag', 'page', 'category']);
    const candidates = routes.filter((route) => {
      const parts = route.split('/').filter(Boolean);
      return parts.length === 2 && parts[0] === base && !reserved.has(parts[1] ?? '');
    });
    const live = [];
    for (const route of candidates) {
      if (!isNoindex(await routeHtml(distDir, route))) live.push(route);
    }
    byKind[collection] = live;
  }
  return byKind;
}

async function main(distDir) {
  const collections = publicCollections(await readFile('src/content.config.ts', 'utf8'));
  const routes = await discoverRoutes(distDir);
  const failures = [];

  const liveByKind = await liveRoutesByKind(distDir, collections, routes);
  for (const generator of ['llms.txt', 'feed.json']) {
    const text = await readFile(join(distDir, generator), 'utf8');
    for (const missing of missingFromGenerator(text, collections)) {
      failures.push(`${generator} covers no ${missing} entry`);
    }
  }

  const llmsTxt = await readFile(join(distDir, 'llms.txt'), 'utf8');
  for (const path of noindexStaticListings(llmsTxt)) failures.push(`llms.txt lists noindex page ${path}`);
  for (const collection of collections) {
    for (const gap of llmsRouteGaps(llmsTxt, liveByKind[collection])) failures.push(`llms.txt omits ${gap}`);
  }

  const noindexRoutes = await noindexRoutesOf(distDir, routes);
  for (const gap of indexableCoverageGaps({ routes, listed: parseListedRoutes(llmsTxt), noindexRoutes })) {
    failures.push(`llms.txt is missing indexable route ${gap}`);
  }

  const llmsIndex = await readFile(join(distDir, 'llms-full.txt'), 'utf8');
  for (const gap of llmsIndexGaps(llmsIndex, collections)) {
    failures.push(`llms-full.txt lists no /llms/${gap}.txt`);
  }

  for (const collection of collections) {
    const file = await readFile(join(distDir, 'llms', `${collection}.txt`), 'utf8').catch(() => null);
    if (file === null) {
      failures.push(`no /llms/${collection}.txt full-text file`);
      continue;
    }
    for (const gap of llmsRouteGaps(file, liveByKind[collection])) {
      failures.push(`/llms/${collection}.txt omits ${gap}`);
    }
  }

  const sitemap = await readFile(join(distDir, 'sitemap-0.xml'), 'utf8');
  for (const missing of missingFromGenerator(sitemap, collections)) {
    failures.push(`sitemap covers no ${missing} entry`);
  }

  const sidecars = await Promise.all(
    routes.map(async (route) => {
      const candidate = `${route.slice(1)}.md`;
      return readFile(join(distDir, candidate)).then(
        () => candidate,
        () => null
      );
    })
  );

  for (const gap of sidecarGaps(routes, sidecars.filter(Boolean))) failures.push(`no markdown sidecar for ${gap}`);

  const perCollectionFeeds = {};
  for (const collection of collections) {
    perCollectionFeeds[collection] = await readFile(
      join(distDir, COLLECTION_BASES[collection], 'rss.xml'),
      'utf8'
    ).catch(() => '');
  }
  const mergedFeed = await readFile(join(distDir, 'rss.xml'), 'utf8').catch(() => '');
  const jsonFeedItems = JSON.parse(await readFile(join(distDir, 'feed.json'), 'utf8'))?.items?.map((item) => item.url);

  failures.push(
    ...feedCoverageFailures(collections, {
      perCollectionFeeds,
      mergedFeed,
      jsonFeedItems,
      liveRoutesByKind: await liveRoutesByKind(distDir, collections, routes),
    })
  );

  console.log(`machine: ${collections.length} public collections, ${routes.length} routes`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`MACHINE ${failure}`);
    process.exitCode = 1;
  }
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist');
}
