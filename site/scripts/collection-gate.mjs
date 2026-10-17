import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { FEED_BASES } from '../src/utils/feeds.mjs';
import { LLMS_COLLECTIONS } from '../src/utils/llms-collections.mjs';
import { isNoindex } from './gate.mjs';

const OFFERING_SURFACE =
  /^(?:llms(?:-full)?\.txt|llms\/[^/]+\.txt|feed\.json|(?:[^/]+\/)?rss\.xml|sitemap[^/]*\.xml|search-index-[^/]+\.json)$/;
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

function listOf(file, value) {
  if (!Array.isArray(value)) throw new Error(`collection-gate: ${file} does not hold the list this guard reads`);
  return value;
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
  if (file.endsWith('.json')) return listOf(file, parseJson(file, text)).map((entry) => entry.href);
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

export function listedPaths(file, text, site) {
  return urlsOf(file, text)
    .map((url) => sitePath(url, site))
    .filter((path) => path !== null);
}

function ownedBy(hub, kind) {
  const fullText = new RegExp(`^/llms/${kind}(?:-\\d+)?\\.txt$`);
  return (path) => path === hub || path === `${hub}.md` || path.startsWith(`${hub}/`) || fullText.test(path);
}

export function emptyCollectionFindings({ kinds, routes, htmlByRoute, shipped, texts, site }) {
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
    for (const [file, text] of Object.entries(texts)) {
      for (const path of new Set(listedPaths(file, text, site))) {
        if (owns(path)) findings.push(`/${file} lists ${path} ${because}`);
      }
    }
    const title = LLMS_COLLECTIONS.find(({ name }) => name === kind)?.title;
    if (title !== undefined && texts['llms-full.txt']?.split('\n').includes(`## ${title}`)) {
      findings.push(`/llms-full.txt carries the heading "${title}" ${because}`);
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
  for (const file of shipped.filter((name) => OFFERING_SURFACE.test(name))) {
    texts[file] = await readFile(join(distDir, file), 'utf8');
  }
  return { shipped, texts };
}

export async function collectionGateFailures(distDir, { kinds, routes, htmlByRoute, site }) {
  if (kinds.length === 0) return [];
  const { shipped, texts } = await readCollectionSurfaces(distDir);
  return emptyCollectionFindings({ kinds, routes, htmlByRoute, shipped, texts, site });
}
