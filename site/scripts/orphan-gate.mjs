import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { contentRegion } from './content-html.mjs';
import { isNoindex } from './gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { extractGraphs } from './jsonld-gate.mjs';

const SITE_ORIGIN = `https://${brandFromDisk().name}`;

export const EXEMPT_ROUTES = [
  {
    route: '/',
    reason: 'home is the crawl entry point; the sitemap and every crawler start here',
  },
  {
    route: '/styleguide',
    reason:
      'internal design reference, noindex, deliberately unlinked; reachable only by a contributor typing the URL directly',
  },
];

const ANCHOR_TAG = /<a\b[^>]*>/gi;
const HREF_ATTR = /\bhref\s*=\s*"([^"]*)"|\bhref\s*=\s*'([^']*)'/i;
const REL_ATTR = /\brel\s*=\s*"([^"]*)"|\brel\s*=\s*'([^']*)'/i;

export function extractHrefs(html) {
  const hrefs = [];
  for (const match of html.matchAll(ANCHOR_TAG)) {
    const tag = match[0];
    const hrefMatch = HREF_ATTR.exec(tag);
    if (!hrefMatch) continue;
    const relMatch = REL_ATTR.exec(tag);
    hrefs.push({ href: hrefMatch[1] ?? hrefMatch[2], rel: (relMatch && (relMatch[1] ?? relMatch[2])) || '' });
  }
  return hrefs;
}

function normalizeHref(href) {
  if (!href) return null;
  let path = href.trim();
  if (path.startsWith('#')) return null;
  if (/^(mailto|tel):/i.test(path)) return null;
  if (/^https?:\/\//i.test(path)) {
    if (!path.startsWith(SITE_ORIGIN)) return null;
    path = path.slice(SITE_ORIGIN.length) || '/';
  }
  if (!path.startsWith('/')) return null;
  path = path.split('#')[0].split('?')[0];
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

function inboundMap(pages, hrefsOf) {
  const inbound = new Map();
  for (const page of pages) {
    for (const link of hrefsOf(page)) {
      if (/\bnofollow\b/i.test(link.rel ?? '')) continue;
      const target = normalizeHref(link.href);
      if (!target || target === page.route) continue;
      if (!inbound.has(target)) inbound.set(target, new Set());
      inbound.get(target).add(page.route);
    }
  }
  return inbound;
}

export const collectInboundLinks = (pages) => inboundMap(pages, (page) => page.hrefs);

export const collectBodyLinks = (pages) =>
  inboundMap(
    pages.filter((page) => page.indexable && !page.collection),
    (page) => page.bodyHrefs
  );

export function findOrphans({ routes, inbound, exempt }) {
  return routes.filter((route) => !exempt.has(route) && !inbound.get(route)?.size);
}

export const NAVIGATIONAL_ROUTES = [
  {
    route: '/imprint',
    reason:
      'the legal imprint is a navigational trust page; the footer is its path and no sentence sends a reader there',
  },
  {
    route: '/privacy',
    reason:
      'the privacy notice is a navigational trust page; the footer is its path and no sentence sends a reader there',
  },
  {
    route: '/terms',
    reason: 'the terms are a navigational trust page; the footer is its path and no sentence sends a reader there',
  },
];

export const bodyLinkScope = (pages, exempt) =>
  pages.filter((page) => page.indexable && !page.collection && !exempt.has(page.route));

const listed = (routes) =>
  routes.length > 3 ? `${routes.slice(0, 3).join(', ')} and ${routes.length - 3} more` : routes.join(', ');

const linksTo = (hrefs, route) =>
  hrefs.some((link) => !/\bnofollow\b/i.test(link.rel ?? '') && normalizeHref(link.href) === route);

function describeInbound(route, pages) {
  const linking = pages.filter((page) => page.route !== route && linksTo(page.hrefs, route));
  const inBody = linking.filter((page) => linksTo(page.bodyHrefs, route));
  const hubs = inBody.filter((page) => page.indexable && page.collection).map((page) => page.route);
  const hidden = inBody.filter((page) => !page.indexable).map((page) => page.route);
  const chrome = linking.length - inBody.length;

  return [
    hubs.length > 0 && `hub listing ${listed(hubs.sort())}`,
    hidden.length > 0 && `${listed(hidden.sort())} (noindex)`,
    chrome > 0 && `the header, footer or breadcrumb of ${chrome} ${chrome === 1 ? 'page' : 'pages'}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export function findChromeOnly({ pages, inbound, bodyInbound, exempt }) {
  return bodyLinkScope(pages, exempt)
    .filter((page) => inbound.get(page.route)?.size > 0 && !bodyInbound.get(page.route)?.size)
    .map((page) => ({ route: page.route, via: describeInbound(page.route, pages) }));
}

const ERROR_PAGE_ROUTE = '/404';

const routeOfFile = (routePath) => {
  const route = `/${routePath.slice(0, -'.html'.length)}`;
  return route === '/index' ? '/' : route;
};

function declaresCollectionPage(route, html) {
  let graphs;
  try {
    graphs = extractGraphs(html);
  } catch (error) {
    throw new Error(`orphans: ${route} carries an ld+json block that does not parse`, { cause: error });
  }
  return graphs.some((graph) =>
    (graph['@graph'] ?? [graph]).some((node) => [node['@type']].flat().includes('CollectionPage'))
  );
}

export async function discoverPages(distDir) {
  const entries = await readdir(distDir, { withFileTypes: true, recursive: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));

  const pages = [];
  for (const file of files) {
    const route = routeOfFile(relative(distDir, file).split(sep).join('/'));
    if (route === ERROR_PAGE_ROUTE) continue;
    const html = await readFile(file, 'utf8');
    pages.push({
      route,
      hrefs: extractHrefs(html),
      bodyHrefs: extractHrefs(contentRegion(html)),
      collection: declaresCollectionPage(route, html),
      indexable: !isNoindex(html),
    });
  }
  return pages;
}

async function main(distDir) {
  const pages = await discoverPages(distDir);
  const routes = pages.map((page) => page.route);
  const inbound = collectInboundLinks(pages);
  const exempt = new Set(EXEMPT_ROUTES.map((entry) => entry.route));
  const orphans = findOrphans({ routes, inbound, exempt });

  console.log(`orphans: ${orphans.length} of ${routes.length} routes have zero inbound links`);
  for (const route of orphans) console.log(`  ${route}`);

  const bodyExempt = new Set([...exempt, ...NAVIGATIONAL_ROUTES.map((entry) => entry.route)]);
  const chromeOnly = findChromeOnly({ pages, inbound, bodyInbound: collectBodyLinks(pages), exempt: bodyExempt });

  console.log(
    `chrome-only: ${chromeOnly.length} of ${bodyLinkScope(pages, bodyExempt).length} routes that must earn a body link are linked only from header, footer, breadcrumb or hub listings`
  );
  for (const { route, via } of chromeOnly) console.log(`  ${route} is linked only from ${via}`);

  if (orphans.length > 0 || chromeOnly.length > 0) process.exitCode = 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2] ?? 'dist');
}
