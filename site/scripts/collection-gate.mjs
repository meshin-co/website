import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { INDEX_ROOT } from '../public/search/index-model.mjs';
import { FEED_BASES } from '../src/utils/feeds.mjs';
import { manifestPath, readIndexDocuments } from '../src/utils/search-index.mjs';
import { isNoindex } from './gate.mjs';

const OFFERING_SURFACE = /^(?:llms(?:-full)?\.txt|llms\/[^/]+\.txt|feed\.json|(?:[^/]+\/)?rss\.xml|sitemap[^/]*\.xml)$/;
const INDEX_PREFIX = `${INDEX_ROOT.slice(1)}/`;
const INDEX_MANIFEST = manifestPath.slice(1);
export const INDEX_DOCUMENT_FILE = new RegExp(`^${INDEX_PREFIX}(?:manifest|[^/]+/d/\\d+)\\.json$`);
const LINK_OPENING = /^\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/;
const BARE_URL = /^https?:\/\/\S+$/;
const XML_URL = /<(?:loc|link|guid)\b[^>]*>([^<]+)<\/(?:loc|link|guid)>/g;

function parseJson(file, text) {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`collection-gate: ${file} is not valid JSON`, { cause });
  }
}

const holdsNoList = (file) => new Error(`collection-gate: ${file} does not hold the list this guard reads`);

function listOf(file, value) {
  if (!Array.isArray(value)) throw holdsNoList(file);
  return value;
}

const isIndexFile = (file) => file.startsWith(INDEX_PREFIX);

const isWhole = (value, minimum) => Number.isInteger(value) && value >= minimum;

const pagesAreCounted = (manifest) => isWhole(manifest?.documents, 0) && isWhole(manifest.pageSize, 1);

function indexText(texts, file) {
  const text = texts[file];
  if (text === undefined) throw new Error(`collection-gate: ${file} is missing`);

  const value = parseJson(file, text);
  if (file !== INDEX_MANIFEST) listOf(file, value);
  else if (!pagesAreCounted(value)) throw holdsNoList(file);
  return text;
}

export function indexDocuments(texts) {
  if (!Object.keys(texts).some(isIndexFile)) return [];
  return readIndexDocuments((urlPath) => indexText(texts, urlPath.slice(1)));
}

function textUrls(text) {
  return text.split('\n').flatMap((line) => {
    const trimmed = line.trim().replace(/^- /, '');
    const url = LINK_OPENING.exec(trimmed)?.[1] ?? (BARE_URL.test(trimmed) ? trimmed : null);
    return url === null ? [] : [url];
  });
}

function urlsOf(file, text) {
  if (file.endsWith('.xml')) return [...text.matchAll(XML_URL)].map(([, url]) => url.trim().replaceAll('&amp;', '&'));
  if (file === 'feed.json') return listOf(file, parseJson(file, text).items).map((item) => item.url);
  return textUrls(text);
}

function sitePath(url, site) {
  try {
    const { origin, pathname } = new URL(url, site);
    if (origin !== new URL(site).origin) return null;
    return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  } catch {
    return null;
  }
}

const sitePaths = (urls, site) => urls.map((url) => sitePath(url, site)).filter((path) => path !== null);

export function listedPaths(file, text, site) {
  return sitePaths(urlsOf(file, text), site);
}

function surfaceListings(texts, site) {
  const files = Object.entries(texts).filter(([file]) => !isIndexFile(file));
  const indexed = indexDocuments(texts).map(({ href }) => href);
  return [
    ...files.map(([file, text]) => [file, listedPaths(file, text, site)]),
    [INDEX_MANIFEST, sitePaths(indexed, site)],
  ];
}

function ownedBy(hub, kind) {
  const fullText = new RegExp(`^/llms/${kind}(?:-\\d+)?\\.txt$`);
  return (path) => path === hub || path === `${hub}.md` || path.startsWith(`${hub}/`) || fullText.test(path);
}

export function emptyCollectionFindings({ kinds, routes, htmlByRoute, shipped, texts, site }) {
  if (kinds.length === 0) return [];
  const listings = surfaceListings(texts, site);
  return kinds.flatMap((kind) => {
    const base = FEED_BASES[kind];
    if (base === undefined) return [];
    const hub = `/${base}`;
    const owns = ownedBy(hub, kind);
    const because = `but ${hub} has no live ${kind} entry`;
    const findings = [];

    if (routes.includes(hub) && !isNoindex(htmlByRoute[hub] ?? '')) {
      findings.push(`${hub} is indexable but has no live ${kind} entry`);
    }
    for (const file of shipped) {
      if (!file.endsWith('.html') && owns(`/${file}`)) findings.push(`/${file} ships ${because}`);
    }
    for (const [file, paths] of listings) {
      for (const path of new Set(paths)) {
        if (owns(path)) findings.push(`/${file} lists ${path} ${because}`);
      }
    }
    return findings;
  });
}

export async function readCollectionSurfaces(distDir) {
  const entries = await readdir(distDir, { withFileTypes: true, recursive: true });
  const shipped = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(distDir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
  const texts = {};
  for (const file of shipped.filter((name) => OFFERING_SURFACE.test(name) || INDEX_DOCUMENT_FILE.test(name))) {
    texts[file] = await readFile(join(distDir, file), 'utf8');
  }
  return { shipped, texts };
}

export async function collectionGateFailures(distDir, { kinds, routes, htmlByRoute, site }) {
  if (kinds.length === 0) return [];
  const { shipped, texts } = await readCollectionSurfaces(distDir);
  return emptyCollectionFindings({ kinds, routes, htmlByRoute, shipped, texts, site });
}
