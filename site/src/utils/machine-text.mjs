import { lastmod } from './lastmod.mjs';
import { HUB_PAGES, STATIC_PAGE_CATALOG } from '../data/static-pages.mjs';

export function absoluteUrl(site, path) {
  return path === '/' ? `${site}/` : `${site}${path}`;
}

export function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const toIso = (value) => (typeof value === 'string' ? value : value.toISOString());

function renderLink({ title, url, description, updated }) {
  const date = updated ? ` (updated ${toIso(updated)})` : '';
  return `- [${title}](${url})${date}: ${description}`;
}

function renderSection({ title, items }) {
  return [`## ${title}`, '', ...items.map(renderLink)].join('\n');
}

export function renderLlmsTxt({ site, tagline, sections }) {
  const populated = sections.filter((section) => section.items.length > 0);
  const blocks = [`# ${site}`, `> ${tagline}`, ...populated.map(renderSection)];
  return `${blocks.join('\n\n')}\n`;
}

function isLive(entry) {
  return !entry.draft && !entry.noindex;
}

function renderEntry({ title, url, summary, body, updated }) {
  const head = [`# ${title}`, updated ? toIso(updated) : '', `[${url}](${url})`, summary].filter(Boolean).join('\n\n');
  return [head, stripMarkdown(body ?? '')].filter(Boolean).join('\n\n');
}

function renderCollectionSection({ title, entries }) {
  const body = entries.filter(isLive).map(renderEntry).join('\n\n---\n\n');
  return body ? `## ${title}\n\n${body}` : `## ${title}`;
}

export function renderLlmsCollection({ site, title, entries }) {
  return `# ${site}\n\n${renderCollectionSection({ title, entries })}\n`;
}

export const entryCount = (count) => `${count} ${count === 1 ? 'entry' : 'entries'}`;

export function renderLlmsIndex({ site, title, shards }) {
  const lines = shards.map(({ url, from, to, count }) => `- [Entries ${from}-${to}](${url}): ${entryCount(count)}`);
  return `# ${site}\n\n## ${title}\n\n${lines.join('\n')}\n`;
}

export function renderLlmsShard({ site, title, entries, from, to, nextUrl }) {
  const body = entries.filter(isLive).map(renderEntry).join('\n\n---\n\n');
  const closing = nextUrl ? `Next part: [${nextUrl}](${nextUrl})` : 'This is the last part.';
  return `# ${site}\n\n## ${title}, entries ${from}-${to}\n\n${body}\n\n---\n\n${closing}\n`;
}

export function renderLlmsFull({ site, sections, maxBytes = Infinity }) {
  const whole = `# ${site}\n\n${sections.map(renderCollectionSection).join('\n\n')}\n`;
  if (Buffer.byteLength(whole, 'utf8') <= maxBytes) return whole;

  const pointers = sections.map(
    ({ title, url, entries }) => `- [${title}](${url}): ${entries.length} entries, full body text of each.`
  );
  return `# ${site}\n\nThe corpus outgrew one file. Each collection carries the full body text of its entries.\n\n${pointers.join('\n')}\n`;
}

function toFeedItem(entry) {
  return {
    id: entry.id ?? entry.url,
    url: entry.url,
    title: entry.title,
    summary: entry.summary,
    content_text: stripMarkdown(entry.body ?? ''),
    date_published: new Date(entry.publishDate).toISOString(),
    date_modified: lastmod(entry),
    tags: entry.tags ?? [],
    kind: entry.kind ?? null,
  };
}

function byNewestFirst(a, b) {
  return a.date_modified < b.date_modified ? 1 : a.date_modified > b.date_modified ? -1 : 0;
}

export function buildFeedItems(entries) {
  return entries.filter(isLive).map(toFeedItem).sort(byNewestFirst);
}

function byLastmodDesc(a, b) {
  return Date.parse(lastmod(b) ?? '1970-01-01T00:00:00Z') - Date.parse(lastmod(a) ?? '1970-01-01T00:00:00Z');
}

export function mergeWithKindFloor(entries, { window = 50, floor = 5 } = {}) {
  const live = entries.filter(isLive);
  const byRecency = [...live].sort(byLastmodDesc);
  const counts = new Map();
  for (const entry of live) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);

  const reserved = [...counts.values()].reduce((sum, count) => sum + Math.min(floor, count), 0);
  const picked = byRecency.slice(0, Math.max(window - reserved, 0));
  const chosen = new Set(picked);

  for (const [kind, count] of counts) {
    const quota = Math.min(floor, count);
    let have = picked.filter((entry) => entry.kind === kind).length;
    for (const entry of byRecency) {
      if (have >= quota) break;
      if (entry.kind !== kind || chosen.has(entry)) continue;
      chosen.add(entry);
      picked.push(entry);
      have += 1;
    }
  }

  return picked.sort(byLastmodDesc);
}

export function toRssItems(items) {
  return items.map((item) => ({
    title: item.title,
    description: item.summary,
    link: item.url,
    pubDate: new Date(item.date_published),
    ...(item.kind ? { categories: [item.kind] } : {}),
    content: item.content_text,
  }));
}

export const NOINDEX_STATIC_PAGES = new Set(['/search', '/styleguide', '/404']);

export function publicIndexableStaticPages() {
  return STATIC_PAGE_CATALOG.filter((page) => !NOINDEX_STATIC_PAGES.has(page.path));
}

export function staticPageDate(path) {
  const page = STATIC_PAGE_CATALOG.find((candidate) => candidate.path === path);
  if (!page) throw new Error(`no static page at ${path} in STATIC_PAGE_CATALOG`);
  if (!page.updatedDate) throw new Error(`static page ${path} has no updatedDate in STATIC_PAGE_CATALOG`);
  return page.updatedDate;
}

export function renderSidecar({ title, url, description, updated, body }) {
  const head = [
    `# ${title}`,
    '',
    `> ${description}`,
    '',
    `Source: ${url}`,
    `Updated: ${updated.toISOString().slice(0, 10)}`,
    '',
    '---',
    '',
  ];
  return `${head.join('\n')}\n${body}`;
}

/** @param {{ collections: any[], staticPaths: string[], withheld?: string[] }} input */
export function collectionHubs({ collections, staticPaths, withheld = [] }) {
  const covered = new Set([...staticPaths, ...withheld]);
  return collections.filter((collection) => !covered.has(collection.base));
}

export function sidecarFileForRoute(route) {
  return route === '/' ? 'index.md' : `${route.slice(1)}.md`;
}

/** @param {{ staticPages?: string[], hubs?: any[], withheld?: string[] }} [input] */
export function sidecarRoutes({ staticPages = publicIndexableStaticPages(), hubs = HUB_PAGES, withheld = [] } = {}) {
  const staticPaths = staticPages.map((page) => page.path);
  const hubPages = collectionHubs({ collections: hubs, staticPaths, withheld }).map((hub) => ({
    path: hub.base,
    title: hub.title,
    description: hub.description,
  }));
  return [...staticPages, ...hubPages];
}

function newerUpdated(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

export function liveTopicMap(posts, key) {
  const map = new Map();
  for (const post of posts) {
    const value = post[key];
    const slugs = Array.isArray(value) ? value : [value];
    for (const slug of slugs) {
      if (!slug) continue;
      map.set(slug, newerUpdated(map.get(slug) ?? null, post.updated ?? null));
    }
  }
  return map;
}
