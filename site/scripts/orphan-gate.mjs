import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

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

export function collectInboundLinks(pages) {
  const inbound = new Map();
  for (const page of pages) {
    for (const link of page.hrefs) {
      if (/\bnofollow\b/i.test(link.rel ?? '')) continue;
      const target = normalizeHref(link.href);
      if (!target || target === page.route) continue;
      if (!inbound.has(target)) inbound.set(target, new Set());
      inbound.get(target).add(page.route);
    }
  }
  return inbound;
}

export function findOrphans({ routes, inbound, exempt }) {
  return routes.filter((route) => !exempt.has(route) && !inbound.get(route)?.size);
}

const ERROR_PAGE_ROUTE = '/404';

const routeOfFile = (routePath) => {
  const route = `/${routePath.slice(0, -'.html'.length)}`;
  return route === '/index' ? '/' : route;
};

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
    pages.push({ route, hrefs: extractHrefs(html) });
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

  if (orphans.length > 0) process.exitCode = 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2] ?? 'dist');
}
