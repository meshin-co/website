import { lastmod } from './lastmod.mjs';
import { brandFromDisk, contactEmail } from './brand.mjs';

const BRAND = brandFromDisk();

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

export const STATIC_PAGE_CATALOG = [
  {
    path: '/',
    title: 'Home',
    updatedDate: '2026-10-25',
    description:
      'Fractional Chief AI Officer for 30–300 person companies: governance that passes enterprise procurement, and agentic systems shipped to production with evals.',
  },
  {
    path: '/blog/tags',
    title: 'Tags',
    description: 'The tags used across the writing, with how many articles carry each one.',
  },
  {
    path: '/about',
    title: 'About Dmitri Meshin',
    updatedDate: '2026-10-02',
    description:
      'Dmitri Meshin is a platform engineer working as a Fractional Chief AI Officer for companies of 30 to 300 people. Remote worldwide.',
  },
  {
    path: '/approach',
    title: 'How a Fractional AI Officer works',
    updatedDate: '2026-10-02',
    description:
      'How a Fractional AI Officer works: the six things that decide whether an AI initiative reaches production, and the order I work through them.',
  },
  {
    path: '/pricing',
    title: 'Pricing: what a Fractional Chief AI Officer costs',
    updatedDate: '2026-10-02',
    description:
      'Fractional Chief AI Officer cost: two-week Assessment, 90-Day Sprint or monthly Retainer. Fixed, no hourly billing, every fee in writing before work starts.',
  },
  {
    path: '/faq',
    title: 'Fractional Chief AI Officer questions',
    description:
      'Fractional Chief AI Officer questions answered: what the role does, what each offer produces, and how AI risk gets recorded and signed off.',
  },
  {
    path: '/contact',
    title: 'Contact: book an AI leadership call',
    updatedDate: '2026-10-25',
    description: `Book an AI leadership call: a 30-minute fit call, or email ${contactEmail(BRAND)}. Remote worldwide, on site when the trip is worth it.`,
  },
  {
    path: '/ai-policy',
    title: 'AI acceptable use policy',
    updatedDate: '2026-10-25',
    description:
      'My own acceptable use policy for AI systems: what data may reach a vendor, what may not, and who decides.',
  },
  {
    path: '/security',
    title: 'Security practices',
    updatedDate: '2026-10-02',
    description: `Security practices for ${BRAND.name}: how this site is built and served, how client data is handled, and where to report a vulnerability.`,
  },
  {
    path: '/now',
    title: 'What I am working on now',
    updatedDate: '2026-10-03',
    description:
      'What I am working on now: a dated log of what I am building and studying, newest first. A line is added when something happens and never edited after.',
  },
  {
    path: '/imprint',
    title: 'Imprint',
    updatedDate: '2026-10-17',
    description: `Imprint for ${BRAND.name}: who is responsible for this site, how to reach them by email, where they work from, and what it is hosted on.`,
  },
  {
    path: '/privacy',
    title: 'Privacy policy',
    updatedDate: '2026-10-17',
    description: `Privacy policy for ${BRAND.name}: what this site collects, which is almost nothing, and what happens to an email you send me.`,
  },
  {
    path: '/terms',
    title: 'Terms',
    updatedDate: '2026-10-25',
    description: 'What this site is, why no price appears on it, and which terms actually govern an engagement.',
  },
  {
    path: '/search',
    title: 'Search',
    description: 'Search the writing, glossary, services and case studies on this site.',
  },
  {
    path: '/styleguide',
    title: 'Styleguide',
    description: 'Every component in every state, both themes. Internal reference page.',
  },
  {
    path: '/404',
    title: 'Page not found',
    description: `This page does not exist on ${BRAND.name}. Start from the home page.`,
  },
];

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

export const HUB_PAGES = [
  {
    base: '/blog',
    title: 'AI governance writing',
    description:
      'AI governance writing: notes on getting AI systems past security review and into production, written for founders and boards.',
  },
  {
    base: '/faq',
    title: 'Fractional Chief AI Officer questions',
    description:
      'Fractional Chief AI Officer questions answered: what the role does, what each offer produces, and how AI risk gets recorded and signed off.',
  },
  {
    base: '/glossary',
    title: 'AI governance glossary',
    description:
      'An AI governance glossary: plain definitions of the terms, standards and laws that come up in security reviews and board meetings.',
  },
  {
    base: '/resources',
    title: 'AI governance templates and checklists',
    description:
      'AI governance templates, each described on its own page: what is inside, how to use it and where its content comes from.',
  },
  {
    base: '/services',
    title: 'Fractional AI leadership services',
    description:
      'Fractional AI leadership services in three offers: a two-week assessment, a 90-day production sprint or a retainer, run by a Fractional Chief AI Officer.',
  },
  {
    base: '/case-studies',
    title: 'Fractional Chief AI Officer case study',
    description:
      'I have not published a Fractional Chief AI Officer case study yet. Client case studies appear here only once a client agrees in writing.',
  },
];

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
