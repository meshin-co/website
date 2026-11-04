import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { discoverRoutes, isNoindex } from './gate.mjs';
import {
  COLLECTION_FEED_MAX_BYTES,
  FEED_BASES,
  FEED_WINDOW,
  MERGED_FEED_MAX_BYTES,
  MERGED_FEED_WINDOW,
} from '../src/utils/feeds.mjs';
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
import { dateAgreementFailures } from './date-agreement.mjs';
import { recordGateFindings } from './gate-findings.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { LLMS_COLLECTIONS, LLMS_FILE_MAX_BYTES, LLMS_FULL_MAX_BYTES } from '../src/utils/llms-collections.mjs';
import { llmsCollectionText, llmsCorpusGaps } from './llms-corpus.mjs';
import { createFailureLog } from './machine-failures.mjs';
import { collectionEmptinessFindings } from './route-kinds.mjs';
import { EMPTY_COLLECTIONS } from '../src/utils/route-exceptions.mjs';

const NON_PUBLIC = new Set(['author', 'speaking']);
const FEED_FLOOR = 5;
export const LLMS_TXT_MAX_BYTES = 8 * 1024;
export const BOUNDED_INLINE_COLLECTIONS = ['service'];
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

export function lastmodExpectationGaps(expectedLastmodCount) {
  return expectedLastmodCount === 0
    ? ['the build derives no expected sitemap lastmod, so no sitemap entry was checked for one']
    : [];
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
  const gaps = [];
  for (const route of sidecarCandidateRoutes(routes)) {
    const text = sidecarTextByRoute[route];
    if (!text) continue;

    const { title, source, updated, body } = parseSidecar(text);
    const expectedSource = absoluteUrl(site, route);
    if (!title) gaps.push(`sidecar for ${route} carries no title`);
    if (source !== expectedSource) {
      gaps.push(`sidecar for ${route} canonical is ${source || '(missing)'}, expected ${expectedSource}`);
    }
    if (!updated) gaps.push(`sidecar for ${route} carries no updated date`);
    if (!body) gaps.push(`sidecar for ${route} body is empty`);
  }
  return gaps;
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

export function sitemapLastmods(xml) {
  const lastmods = new Map();
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    if (loc) lastmods.set(toPath(loc), /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1] ?? null);
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

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function feedWindowRoutes(routes, lastmods) {
  const stampOf = (route) => lastmods.get(route) ?? '';
  return [...routes].sort((a, b) => compareText(stampOf(b), stampOf(a)) || compareText(a, b)).slice(0, FEED_WINDOW);
}

export function feedCoverageFailures(
  collections,
  { perCollectionFeeds, mergedFeed, jsonFeedItems, liveRoutesByKind, lastmods }
) {
  const gaps = [];
  const mergedPaths = itemPaths(mergedFeed);

  for (const collection of collections) {
    const base = COLLECTION_BASES[collection];
    const feedPaths = itemPaths(perCollectionFeeds[collection] ?? '');
    const live = liveRoutesByKind[collection] ?? [];
    for (const route of feedWindowRoutes(live, lastmods)) {
      if (!feedPaths.includes(route)) gaps.push(`/${base}/rss.xml omits ${route}`);
    }
    if (feedPaths.length > FEED_WINDOW) {
      gaps.push(`/${base}/rss.xml carries ${feedPaths.length} items, window is ${FEED_WINDOW}`);
    }

    const floor = Math.min(FEED_FLOOR, live.length);
    const present = mergedPaths.filter((path) => path.startsWith(`/${base}/`)).length;
    if (present < floor) {
      gaps.push(`merged rss.xml carries ${present} ${collection} entries, floor is ${floor}`);
    }
  }

  if (mergedPaths.length > MERGED_FEED_WINDOW) {
    gaps.push(`merged rss.xml carries ${mergedPaths.length} items, window is ${MERGED_FEED_WINDOW}`);
  }

  const jsonPaths = jsonFeedItems.map(toPath);
  const mirrored =
    jsonPaths.length === mergedPaths.length && jsonPaths.every((path, index) => path === mergedPaths[index]);
  if (!mirrored) gaps.push('feed.json does not mirror rss.xml item-for-item');

  return gaps;
}

export function feedSizeFindings(collections, { perCollectionFeeds, mergedFeed, feedJson }) {
  const collectionFeeds = collections
    .filter((collection) => COLLECTION_BASES[collection])
    .map((collection) => ({
      file: `${COLLECTION_BASES[collection]}/rss.xml`,
      text: perCollectionFeeds[collection] ?? '',
      maxBytes: COLLECTION_FEED_MAX_BYTES,
    }));
  const mergedFeeds = [
    { file: 'rss.xml', text: mergedFeed, maxBytes: MERGED_FEED_MAX_BYTES },
    { file: 'feed.json', text: feedJson, maxBytes: MERGED_FEED_MAX_BYTES },
  ];
  return [...collectionFeeds, ...mergedFeeds].flatMap(({ file, text, maxBytes }) =>
    sizeGuardFailure(file, Buffer.byteLength(text, 'utf8'), maxBytes).map((message) => ({
      text: message,
      subjects: [`/${file}`],
    }))
  );
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
  const failures = createFailureLog();

  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  for (const finding of humansTxtFindings(await readFile(join(distDir, 'humans.txt'), 'utf8'), {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  })) {
    failures.add(finding.rule, `${finding.rule} ${finding.detail}`, ['/humans.txt']);
  }

  const liveByKind = await liveRoutesByKind(distDir, collections, routes);
  const emptyKinds = emptyCollections(collections, liveByKind);
  const withheldHubs = emptyKinds.map((kind) => `/${COLLECTION_BASES[kind]}`);

  const llmsTxt = await readFile(join(distDir, 'llms.txt'), 'utf8');
  for (const path of noindexStaticListings(llmsTxt)) {
    failures.add('llms-lists-noindex-page', `llms.txt lists noindex page ${path}`, ['/llms.txt', path]);
  }
  const llmsBytes = Buffer.byteLength(llmsTxt, 'utf8');
  failures.addAll('llms-size', sizeGuardFailure('llms.txt', llmsBytes, LLMS_TXT_MAX_BYTES), ['/llms.txt']);
  for (const collection of BOUNDED_INLINE_COLLECTIONS) {
    for (const gap of llmsRouteGaps(llmsTxt, liveByKind[collection] ?? [])) {
      failures.add('llms-omits-route', `llms.txt omits ${gap}`, ['/llms.txt', gap]);
    }
  }
  for (const route of llmsInlinedRoutes(llmsTxt, liveByKind, BOUNDED_INLINE_COLLECTIONS)) {
    failures.add('llms-lists-inline', inlineEntryText('llms.txt', route), ['/llms.txt', route]);
  }

  const noindexRoutes = await noindexRoutesOf(distDir, routes);
  const listed = parseListedRoutes(llmsTxt);
  const llmsFiles = await readLlmsFiles(distDir);
  for (const text of Object.values(llmsFiles)) {
    for (const route of parseListedRoutes(text)) listed.add(route);
  }
  const coverageRoutes = routes.filter((route) => !isTaxonomyRoute(route));
  for (const gap of indexableCoverageGaps({ routes: coverageRoutes, listed, noindexRoutes })) {
    failures.add('llms-omits-route', `llms.txt and /llms/ are missing indexable route ${gap}`, ['/llms.txt', gap]);
  }

  const llmsFull = await readFile(join(distDir, 'llms-full.txt'), 'utf8');
  const fullBytes = Buffer.byteLength(llmsFull, 'utf8');
  failures.addAll('llms-size', sizeGuardFailure('llms-full.txt', fullBytes, LLMS_FULL_MAX_BYTES), ['/llms-full.txt']);
  for (const route of llmsInlinedRoutes(llmsFull, liveByKind, [])) {
    failures.add('llms-lists-inline', inlineEntryText('llms-full.txt', route), ['/llms-full.txt', route]);
  }
  for (const [name, text] of Object.entries(llmsFiles)) {
    const file = `llms/${name}.txt`;
    failures.addAll('llms-size', sizeGuardFailure(file, Buffer.byteLength(text, 'utf8'), LLMS_FILE_MAX_BYTES), [
      `/${file}`,
    ]);
  }

  for (const collection of populatedCollections(collections, liveByKind)) {
    const text = llmsCollectionText(llmsFiles, collection);
    const surface = `/llms/${collection}.txt`;
    if (text === undefined) {
      failures.add('llms-file-missing', `no /llms/${collection}.txt full-text file`, [surface]);
      continue;
    }
    for (const gap of llmsRouteGaps(text, liveByKind[collection])) {
      failures.add('llms-omits-route', `/llms/${collection}.txt omits ${gap}`, [surface, gap]);
    }
  }
  failures.addAll(
    'llms-corpus',
    llmsCorpusGaps({ llmsTxt, llmsFullTxt: llmsFull, files: llmsFiles, collections: LLMS_COLLECTIONS })
  );

  const sitemap = await readFile(join(distDir, 'sitemap-0.xml'), 'utf8');
  const feedJson = await readFile(join(distDir, 'feed.json'), 'utf8');
  failures.addAll(
    'entry-coverage',
    entryCoverageFailures(collections, liveByKind, { 'llms.txt': llmsTxt, 'feed.json': feedJson, sitemap })
  );
  const emptiness = collectionEmptinessFindings({
    collections: collections.map((kind) => ({ kind, base: COLLECTION_BASES[kind] })),
    declared: { emptyCollections: EMPTY_COLLECTIONS },
    liveEntries: liveByKind,
  });
  for (const finding of emptiness) failures.add('empty-collection-surface', finding.text, finding.subjects);
  const declaredEmpty = emptyKinds.filter((kind) => EMPTY_COLLECTIONS.some(({ collection }) => collection === kind));
  console.log(
    `machine: ${declaredEmpty.length} of ${collections.length} collections have no live entry and are declared empty with a reason${declaredEmpty.length > 0 ? ` (${declaredEmpty.join(', ')})` : ''}; entry coverage is vacuous for them by declaration`
  );
  for (const gap of sitemapNoindexLeaks(sitemap, noindexRoutes)) {
    failures.add('sitemap-lists-noindex-route', `sitemap lists noindex route ${gap}`, ['/sitemap-0.xml', gap]);
  }

  const expectedLastmods = await siteLastmods({
    dataDir: 'src/data',
    staticPages: publicIndexableStaticPages(),
  });
  for (const gap of lastmodCoverageGaps(sitemap, Object.keys(expectedLastmods))) {
    failures.add('sitemap-lastmod-missing', `sitemap has no lastmod for ${gap}`, ['/sitemap-0.xml', gap]);
  }

  const offeredRoutes = routes.filter((route) => !withheldHubs.includes(route));
  const sidecarTextByRoute = {};
  for (const route of sidecarCandidateRoutes(offeredRoutes)) {
    sidecarTextByRoute[route] = await readFile(join(distDir, sidecarFileForRoute(route)), 'utf8').catch(() => null);
  }

  for (const gap of sidecarGaps(offeredRoutes, sidecarTextByRoute)) {
    failures.add('sidecar-missing', `no markdown sidecar for ${gap}`, [gap]);
  }
  failures.addAll('sidecar-content', sidecarContentGaps(offeredRoutes, sidecarTextByRoute, { site: SITE_ORIGIN }));

  const htmlByRoute = {};
  for (const route of routes) htmlByRoute[route] = await routeHtml(distDir, route);
  failures.addAll('canonical-mismatch', canonicalGaps(htmlByRoute, { site: SITE_ORIGIN }));
  const datedStaticRoutes = publicIndexableStaticPages()
    .filter((page) => page.updatedDate)
    .map((page) => page.path);
  failures.addAll('sitemap-lastmod-missing', lastmodExpectationGaps(Object.keys(expectedLastmods).length));
  failures.addAll(
    'date-agreement',
    dateAgreementFailures({
      lastmods: sitemapLastmods(sitemap),
      htmlByRoute,
      sidecarTextByRoute,
      staticRoutes: datedStaticRoutes,
    })
  );
  failures.addAll(
    'empty-collection-surface',
    await collectionGateFailures(distDir, { kinds: emptyKinds, routes, htmlByRoute, site: SITE_ORIGIN })
  );

  const hubRoutes = [...new Set(Object.values(COLLECTION_BASES))]
    .map((base) => `/${base}`)
    .filter((route) => !withheldHubs.includes(route));
  const hubHtml = {};
  for (const route of hubRoutes) hubHtml[route] = await routeHtml(distDir, route);
  for (const gap of hubFeedLinkGaps(hubRoutes, hubHtml)) {
    failures.add('hub-feed-link-missing', `${gap} does not advertise its own collection feed <link>`, [gap]);
  }

  for (const gap of feedBaseGaps(collections)) {
    failures.add('feed-base-missing', `${gap} has no FEED_BASES entry; skipping its feed coverage check`);
  }
  const perCollectionFeeds = {};
  for (const collection of collections) {
    const base = COLLECTION_BASES[collection];
    perCollectionFeeds[collection] = base ? await readFile(join(distDir, base, 'rss.xml'), 'utf8').catch(() => '') : '';
  }
  const mergedFeed = await readFile(join(distDir, 'rss.xml'), 'utf8').catch(() => '');
  const jsonFeedItems = JSON.parse(await readFile(join(distDir, 'feed.json'), 'utf8'))?.items?.map((item) => item.url);

  failures.addAll(
    'feed-coverage',
    feedCoverageFailures(collections, {
      perCollectionFeeds,
      mergedFeed,
      jsonFeedItems,
      liveRoutesByKind: await liveRoutesByKind(distDir, collections, routes),
      lastmods: sitemapLastmods(sitemap),
    })
  );
  for (const { text, subjects } of feedSizeFindings(collections, { perCollectionFeeds, mergedFeed, feedJson })) {
    failures.add('feed-size', text, subjects);
  }

  const { STATIC_PAGE_CATALOG, HUB_PAGES } = await import('../src/data/static-pages.mjs');
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
    failures.add(finding.rule, `${finding.route} ${finding.rule} [${finding.detail}]`, [finding.route]);

  await machineFileFailures(failures, distDir, htmlByRoute);

  console.log(
    `machine: ${collections.length} public collections, ${routes.length} routes, ${catalog.length} catalog entries, ${datedStaticRoutes.length} static routes checked for one date`
  );
  for (const text of failures.texts()) console.error(`MACHINE ${text}`);
  recordGateFindings({ gate: 'gate:machine', findings: failures.records() });
  if (failures.size > 0) process.exitCode = 1;
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

async function readLlmsFiles(distDir) {
  const files = {};
  for (const name of await readdir(join(distDir, 'llms')).catch(() => [])) {
    files[name.replace(/\.txt$/, '')] = await readFile(join(distDir, 'llms', name), 'utf8');
  }
  return files;
}

function inlineEntryText(file, route) {
  return `${file} lists ${route} inline, entries of an unbounded collection belong in /llms/`;
}

async function machineFileFailures(failures, distDir, htmlByRoute) {
  const shipped = await shippedMachineFiles(distDir);
  const referenced = shipped.filter((file) => REFERENCED_MACHINE_FILE.test(file));
  const headerGuarded = [...referenced, ...shipped.filter((file) => HEADER_GUARDED_MACHINE_FILE.test(file))];
  const headersText = await readFile(join(distDir, '_headers'), 'utf8').catch(() => '');
  const machineTexts = {};
  for (const file of referenced) machineTexts[file] = await readFile(join(distDir, file.slice(1)), 'utf8');
  failures.addAll('machine-header', machineHeaderGaps(headersText, headerGuarded));
  for (const file of unreferencedMachineFiles(referenced, { ...htmlByRoute, ...machineTexts })) {
    failures.add('machine-file-unreferenced', `${file} is shipped but nothing references it`, [file]);
  }
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
