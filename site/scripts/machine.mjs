import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { discoverRoutes, isNoindex } from './gate.mjs';
import { FEED_BASES } from '../src/utils/feeds.mjs';
import {
  absoluteUrl,
  NOINDEX_STATIC_PAGES,
  publicIndexableStaticPages,
  sidecarFileForRoute,
  sidecarRoutes,
} from '../src/utils/machine-text.mjs';
import { siteLastmods } from '../src/utils/sitemap-lastmod.mjs';
import { brandFromDisk } from '../src/utils/brand.mjs';

import { catalogDriftFindings } from './catalog-drift.mjs';
import { collectionGateFailures } from './collection-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { LLMS_FULL_MAX_BYTES, LLMS_COLLECTIONS } from '../src/utils/llms-collections.mjs';
import { llmsCorpusGaps } from './llms-corpus.mjs';

const NON_PUBLIC = new Set(['author', 'speaking']);
const FEED_FLOOR = 5;
export const LLMS_TXT_MAX_BYTES = 8 * 1024;
const BOUNDED_INLINE_COLLECTIONS = ['service'];
const SITE_ORIGIN = `https://${brandFromDisk().name}`;
const REFERENCED_MACHINE_FILE = /^\/(?:llms(?:-full)?\.txt|llms\/[^/]+\.txt|feed\.json|(?:[^/]+\/)?rss\.xml)$/;
const HEADER_GUARDED_MACHINE_FILE = /^\/(?:search-index-[^/]+\.json|.+\.md)$/;
const REQUIRED_ROBOTS_VALUE = 'noindex';

const patternMatcher = (pattern) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

const mentionsPath = (text, path) =>
  new RegExp(`(?:^|["'(\\s<]|https?://[^/\\s"')<>]+)${path.replace(/[.]/g, '\\.')}(?=$|["')\\s<>#?])`, 'm').test(text);

export const COLLECTION_BASES = FEED_BASES;

export function publicCollections(configSource) {
  const block = configSource.match(/export const collections = \{([^}]*)\}/s);
  if (!block) throw new Error('machine: no collections export in the content config');

  return [...block[1].matchAll(/^\s*([A-Za-z][\w]*)\s*:/gm)]
    .map(([, name]) => name)
    .filter((name) => !NON_PUBLIC.has(name));
}

export function feedBaseGaps(collections) {
  return collections.filter((collection) => !COLLECTION_BASES[collection]);
}

export function missingFromGenerator(text, collections) {
  return collections.filter((collection) => !text.includes(`/${COLLECTION_BASES[collection]}/`));
}

export function populatedCollections(collections, liveRoutesByKind) {
  return collections.filter((collection) => (liveRoutesByKind[collection] ?? []).length > 0);
}

export function emptyCollections(collections, liveRoutesByKind) {
  return collections.filter((collection) => (liveRoutesByKind[collection] ?? []).length === 0);
}

const COVERAGE_GENERATORS = ['feed.json', 'sitemap'];

export function entryCoverageFailures(collections, liveRoutesByKind, generatorTexts) {
  const populated = populatedCollections(collections, liveRoutesByKind);
  if (populated.length === 0) return ['no public collection has a live entry, so generator coverage was not checked'];
  return COVERAGE_GENERATORS.flatMap((generator) =>
    missingFromGenerator(generatorTexts[generator], populated).map(
      (missing) => `${generator} covers no ${missing} entry`
    )
  );
}

export function sizeGuardFailure(label, bytes, maxBytes) {
  return bytes > maxBytes ? [`${label} is ${bytes} bytes, over the ${maxBytes} byte guard`] : [];
}

function parseListedRoutes(text) {
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

function noindexStaticListings(text) {
  return [...NOINDEX_STATIC_PAGES].filter((path) => text.includes(`(${path})`));
}

const RESERVED_LEAF_SLUGS = new Set(['tags', 'tag', 'page', 'category']);

export function sidecarCandidateRoutes(routes) {
  const bases = new Set(Object.values(COLLECTION_BASES));
  const collectionLeaves = routes.filter((route) => {
    const parts = route.split('/').filter(Boolean);
    return parts.length === 2 && bases.has(parts[0]) && !RESERVED_LEAF_SLUGS.has(parts[1] ?? '');
  });
  const staticAndHubs = sidecarRoutes()
    .map((page) => page.path)
    .filter((path) => routes.includes(path));
  return [...collectionLeaves, ...staticAndHubs];
}

export function sidecarGaps(routes, sidecarTextByRoute) {
  return sidecarCandidateRoutes(routes)
    .filter((route) => !sidecarTextByRoute[route])
    .map((route) => `/${sidecarFileForRoute(route)}`);
}

function parseSidecar(text) {
  return {
    title: /^# (.+)$/m.exec(text)?.[1]?.trim() ?? '',
    source: /^Source: (\S+)$/m.exec(text)?.[1] ?? '',
    updated: /^Updated: (\d{4}-\d{2}-\d{2})$/m.exec(text)?.[1] ?? '',
    body: text
      .split(/\n---\n\n/)
      .slice(1)
      .join('\n---\n\n')
      .trim(),
  };
}

export function sidecarContentGaps(routes, sidecarTextByRoute, { site }) {
  const failures = [];
  for (const route of sidecarCandidateRoutes(routes)) {
    const text = sidecarTextByRoute[route];
    if (!text) continue;

    const { title, source, updated, body } = parseSidecar(text);
    const expectedSource = absoluteUrl(site, route);
    if (!title) failures.push(`sidecar for ${route} carries no title`);
    if (source !== expectedSource) {
      failures.push(`sidecar for ${route} canonical is ${source || '(missing)'}, expected ${expectedSource}`);
    }
    if (!updated) failures.push(`sidecar for ${route} carries no updated date`);
    if (!body) failures.push(`sidecar for ${route} body is empty`);
  }
  return failures;
}

const LINK_TAG = /<link\b[^>]*>/gi;

function hasCollectionFeedLink(html, base) {
  const href = `href="${base}/rss.xml"`;
  return [...html.matchAll(LINK_TAG)].some((tag) => /rel=["']alternate["']/.test(tag[0]) && tag[0].includes(href));
}

export function hubFeedLinkGaps(hubRoutes, htmlByRoute) {
  return hubRoutes.filter((route) => !hasCollectionFeedLink(htmlByRoute[route] ?? '', route));
}

const META_TAG = /<meta\b[^>]*>/gi;

const attributeOf = (tag, name) => new RegExp(`\\b${name}=["']([^"']*)["']`).exec(tag)?.[1];

function declaredUrl(html, pattern, identifyingAttribute, identity, valueAttribute) {
  const tag = [...html.matchAll(pattern)].find(([found]) => attributeOf(found, identifyingAttribute) === identity);
  return tag === undefined ? undefined : attributeOf(tag[0], valueAttribute);
}

export function canonicalGaps(htmlByRoute, { site }) {
  const gaps = [];
  for (const [route, html] of Object.entries(htmlByRoute)) {
    const expected = route === '/' ? site : `${site}${route}`;
    const declared = [
      ['canonical', declaredUrl(html, LINK_TAG, 'rel', 'canonical', 'href')],
      ['og:url', declaredUrl(html, META_TAG, 'property', 'og:url', 'content')],
    ];
    for (const [label, found] of declared) {
      if (found !== expected) gaps.push(`${route} ${label} is ${found ?? '(missing)'}, expected ${expected}`);
    }
  }
  return gaps;
}

function toPath(url) {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  return path === '' ? '/' : path;
}

function sitemapLastmods(xml) {
  const lastmods = new Map();
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    if (loc) lastmods.set(toPath(loc), /<lastmod>/.test(block));
  }
  return lastmods;
}

export function lastmodCoverageGaps(sitemapXml, routes) {
  const lastmods = sitemapLastmods(sitemapXml);
  return routes.filter((route) => !lastmods.get(route));
}

export function sitemapNoindexLeaks(sitemapXml, noindexRoutes) {
  const listed = sitemapLastmods(sitemapXml);
  return [...noindexRoutes].filter((route) => listed.has(route));
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
  const file = join(distDir, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
  return readFile(file, 'utf8').catch(() => '');
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

  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  for (const finding of humansTxtFindings(await readFile(join(distDir, 'humans.txt'), 'utf8'), {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  })) {
    failures.push(`${finding.rule} ${finding.detail}`);
  }

  const liveByKind = await liveRoutesByKind(distDir, collections, routes);
  const emptyKinds = emptyCollections(collections, liveByKind);
  const withheldHubs = emptyKinds.map((kind) => `/${COLLECTION_BASES[kind]}`);

  const llmsTxt = await readFile(join(distDir, 'llms.txt'), 'utf8');
  for (const path of noindexStaticListings(llmsTxt)) failures.push(`llms.txt lists noindex page ${path}`);
  failures.push(...sizeGuardFailure('llms.txt', Buffer.byteLength(llmsTxt, 'utf8'), LLMS_TXT_MAX_BYTES));
  for (const collection of BOUNDED_INLINE_COLLECTIONS) {
    for (const gap of llmsRouteGaps(llmsTxt, liveByKind[collection] ?? [])) failures.push(`llms.txt omits ${gap}`);
  }
  for (const route of llmsInlinedRoutes(llmsTxt, liveByKind, BOUNDED_INLINE_COLLECTIONS)) {
    failures.push(`llms.txt lists ${route} inline, entries of an unbounded collection belong in /llms/`);
  }

  const noindexRoutes = await noindexRoutesOf(distDir, routes);
  const listed = parseListedRoutes(llmsTxt);
  for (const name of await readdir(join(distDir, 'llms')).catch(() => [])) {
    for (const route of parseListedRoutes(await readFile(join(distDir, 'llms', name), 'utf8'))) listed.add(route);
  }
  const coverageRoutes = routes.filter((route) => !isTaxonomyRoute(route));
  for (const gap of indexableCoverageGaps({ routes: coverageRoutes, listed, noindexRoutes })) {
    failures.push(`llms.txt and /llms/ are missing indexable route ${gap}`);
  }

  const llmsFull = await readFile(join(distDir, 'llms-full.txt'), 'utf8');
  failures.push(...sizeGuardFailure('llms-full.txt', Buffer.byteLength(llmsFull, 'utf8'), LLMS_FULL_MAX_BYTES));
  for (const collection of collections) {
    for (const gap of llmsRouteGaps(llmsFull, liveByKind[collection])) failures.push(`llms-full.txt omits ${gap}`);
  }

  for (const collection of populatedCollections(collections, liveByKind)) {
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
  const feedJson = await readFile(join(distDir, 'feed.json'), 'utf8');
  failures.push(
    ...entryCoverageFailures(collections, liveByKind, { 'llms.txt': llmsTxt, 'feed.json': feedJson, sitemap })
  );
  if (emptyKinds.length > 0) {
    console.log(`machine: no live entry in ${emptyKinds.join(', ')}; entry coverage was not checked for it`);
  }
  for (const gap of sitemapNoindexLeaks(sitemap, noindexRoutes)) {
    failures.push(`sitemap lists noindex route ${gap}`);
  }

  const expectedLastmods = await siteLastmods({
    dataDir: 'src/data',
    staticPages: publicIndexableStaticPages(),
    cwd: process.cwd(),
  });
  for (const gap of lastmodCoverageGaps(sitemap, Object.keys(expectedLastmods))) {
    failures.push(`sitemap has no lastmod for ${gap}`);
  }

  const offeredRoutes = routes.filter((route) => !withheldHubs.includes(route));
  const sidecarTextByRoute = {};
  for (const route of sidecarCandidateRoutes(offeredRoutes)) {
    sidecarTextByRoute[route] = await readFile(join(distDir, sidecarFileForRoute(route)), 'utf8').catch(() => null);
  }

  for (const gap of sidecarGaps(offeredRoutes, sidecarTextByRoute)) failures.push(`no markdown sidecar for ${gap}`);
  for (const gap of sidecarContentGaps(offeredRoutes, sidecarTextByRoute, { site: SITE_ORIGIN })) failures.push(gap);

  const htmlByRoute = {};
  for (const route of routes) htmlByRoute[route] = await routeHtml(distDir, route);
  for (const gap of canonicalGaps(htmlByRoute, { site: SITE_ORIGIN })) failures.push(gap);
  failures.push(
    ...(await collectionGateFailures(distDir, { kinds: emptyKinds, routes, htmlByRoute, site: SITE_ORIGIN }))
  );

  const hubRoutes = [...new Set(Object.values(COLLECTION_BASES))]
    .map((base) => `/${base}`)
    .filter((route) => !withheldHubs.includes(route));
  const hubHtml = {};
  for (const route of hubRoutes) hubHtml[route] = await routeHtml(distDir, route);
  for (const gap of hubFeedLinkGaps(hubRoutes, hubHtml)) {
    failures.push(`${gap} does not advertise its own collection feed <link>`);
  }

  for (const gap of feedBaseGaps(collections)) {
    failures.push(`${gap} has no FEED_BASES entry; skipping its feed coverage check`);
  }
  const perCollectionFeeds = {};
  for (const collection of collections) {
    const base = COLLECTION_BASES[collection];
    perCollectionFeeds[collection] = base ? await readFile(join(distDir, base, 'rss.xml'), 'utf8').catch(() => '') : '';
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

  const { STATIC_PAGE_CATALOG, HUB_PAGES } = await import('../src/utils/machine-text.mjs');
  const catalog = [...STATIC_PAGE_CATALOG, ...HUB_PAGES.map((hub) => ({ ...hub, path: hub.base }))];
  const builtDescriptions = {};
  for (const entry of catalog) {
    const html = await readFile(
      join(distDir, entry.path === '/' ? 'index.html' : `${entry.path.slice(1)}.html`),
      'utf8'
    ).catch(() => null);
    if (html === null) continue;
    const tag =
      [...html.matchAll(/<meta\b[^>]*>/gi)].map(([found]) => found).find((found) => /name="description"/.test(found)) ??
      '';
    builtDescriptions[entry.path] = { description: /content="([^"]*)"/.exec(tag)?.[1] ?? '' };
  }
  for (const finding of catalogDriftFindings(catalog, builtDescriptions))
    failures.push(`${finding.route} ${finding.rule} [${finding.detail}]`);

  failures.push(...(await machineFileFailures(distDir, htmlByRoute, llmsTxt)));

  console.log(
    `machine: ${collections.length} public collections, ${routes.length} routes, ${catalog.length} catalog entries`
  );
  if (failures.length > 0) {
    for (const failure of failures) console.error(`MACHINE ${failure}`);
    process.exitCode = 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2] ?? 'dist');
}

export function humansTxtFindings(text, dependencies) {
  const line = /^Components:\s*(.+)$/m.exec(text);
  if (!line) {
    return [
      {
        rule: 'humans-components-missing',
        detail: 'humans.txt names no Components line, so its stack claim cannot be checked',
      },
    ];
  }

  const installed = new Set(Object.keys(dependencies).map((name) => name.toLowerCase().replace(/[^a-z]/g, '')));
  return line[1]
    .split(',')
    .map((component) => component.trim())
    .filter(Boolean)
    .filter((component) => !installed.has(component.toLowerCase().replace(/[^a-z]/g, '')))
    .map((component) => ({
      rule: 'humans-component-absent',
      detail: `humans.txt names ${component}, which is not a dependency of this project`,
    }));
}

function headerRules(text) {
  const rules = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: [] });
      continue;
    }
    const separator = line.indexOf(':');
    rules.at(-1)?.headers.push([line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()]);
  }
  return rules.filter(({ pattern }) => pattern.startsWith('/'));
}

export function machineHeaderGaps(headersText, files) {
  const rules = headerRules(headersText);
  const gaps = [];
  for (const file of files) {
    const values = rules
      .filter(({ pattern }) => patternMatcher(pattern).test(file))
      .flatMap(({ headers }) => headers.filter(([name]) => name === 'x-robots-tag').map(([, value]) => value));
    const different = values.find((value) => value !== REQUIRED_ROBOTS_VALUE);
    if (values.length === 0)
      gaps.push(`${file} carries no X-Robots-Tag rule, its siblings carry ${REQUIRED_ROBOTS_VALUE}`);
    else if (different !== undefined)
      gaps.push(`${file} carries X-Robots-Tag "${different}", its siblings carry ${REQUIRED_ROBOTS_VALUE}`);
  }
  return gaps;
}

export function unreferencedMachineFiles(files, referencingTexts) {
  const reached = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    const sources = Object.entries(referencingTexts).filter(
      ([source]) => !files.includes(source) || reached.has(source)
    );
    for (const file of files.filter((candidate) => !reached.has(candidate))) {
      if (sources.some(([source, text]) => source !== file && mentionsPath(text, file))) {
        reached.add(file);
        grew = true;
      }
    }
  }
  return files.filter((file) => !reached.has(file));
}

async function shippedMachineFiles(distDir) {
  const entries = await readdir(distDir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `/${relative(distDir, join(entry.parentPath, entry.name)).split(sep).join('/')}`);
}

async function llmsCorpusFailures(distDir, llmsTxt) {
  const files = {};
  for (const name of await readdir(join(distDir, 'llms')).catch(() => [])) {
    files[name.replace(/\.txt$/, '')] = await readFile(join(distDir, 'llms', name), 'utf8');
  }
  return llmsCorpusGaps({ llmsTxt, files, collections: LLMS_COLLECTIONS });
}

async function machineFileFailures(distDir, htmlByRoute, llmsTxt) {
  const shipped = await shippedMachineFiles(distDir);
  const referenced = shipped.filter((file) => REFERENCED_MACHINE_FILE.test(file));
  const headerGuarded = [...referenced, ...shipped.filter((file) => HEADER_GUARDED_MACHINE_FILE.test(file))];
  const headersText = await readFile(join(distDir, '_headers'), 'utf8').catch(() => '');
  const machineTexts = {};
  for (const file of referenced) machineTexts[file] = await readFile(join(distDir, file.slice(1)), 'utf8');
  return [
    ...machineHeaderGaps(headersText, headerGuarded),
    ...unreferencedMachineFiles(referenced, { ...htmlByRoute, ...machineTexts }).map(
      (file) => `${file} is shipped but nothing references it`
    ),
    ...(await llmsCorpusFailures(distDir, llmsTxt)),
  ];
}

export function llmsInlinedRoutes(llmsText, liveRoutesByKind, boundedCollections) {
  const listed = parseListedRoutes(llmsText);
  return Object.entries(liveRoutesByKind)
    .filter(([collection]) => !boundedCollections.includes(collection))
    .flatMap(([, routes]) => routes.filter((route) => listed.has(route)));
}

export function isTaxonomyRoute(route) {
  const [, second] = route.split('/').filter(Boolean);
  return RESERVED_LEAF_SLUGS.has(second ?? '');
}
