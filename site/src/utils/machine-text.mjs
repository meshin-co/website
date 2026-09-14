import { lastmod } from './lastmod.mjs';

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

export function renderLlmsFull({ site, sections }) {
  const blocks = sections.map(renderCollectionSection);
  return `# ${site}\n\n${blocks.join('\n\n')}\n`;
}

function toFeedItem(entry) {
  return {
    id: entry.id ?? entry.url,
    url: entry.url,
    title: entry.title,
    summary: entry.summary,
    content_text: stripMarkdown(entry.body ?? ''),
    date_published: lastmod(entry),
    date_modified: new Date(entry.updatedDate ?? entry.publishDate).toISOString(),
    tags: entry.tags ?? [],
    kind: entry.kind ?? null,
  };
}

function byNewestFirst(a, b) {
  return a.date_published < b.date_published ? 1 : a.date_published > b.date_published ? -1 : 0;
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
    file: 'src/pages/index.astro',
    description:
      'Fractional AI leadership for 30–300 person companies: governance that passes enterprise procurement, and agentic systems shipped to production with evals and observability.',
  },
  {
    path: '/blog/tags',
    title: 'Writing topics',
    file: 'src/pages/blog/tags.astro',
    description: 'Every topic tag used across the writing, each with its own page.',
  },
  {
    path: '/about',
    title: 'About Dmitri Meshin',
    file: 'src/pages/about.astro',
    description:
      'Platform engineer working as a Fractional Chief AI Officer for companies of 30 to 300 people. Remote worldwide.',
  },
  {
    path: '/approach',
    title: 'How I work',
    file: 'src/pages/approach.astro',
    description:
      'The six things that decide whether an AI initiative reaches production, and the order I work through them.',
  },
  {
    path: '/pricing',
    title: 'Pricing',
    file: 'src/pages/pricing.astro',
    description:
      'A two-week Assessment, a 90-Day Production Sprint, and a monthly Fractional CAIO Retainer. Fixed structures, no hourly billing.',
  },
  {
    path: '/faq',
    title: 'Questions and answers',
    file: 'src/pages/faq.astro',
    description:
      'What a Fractional Chief AI Officer does, what each offer produces, and how AI risk gets recorded and signed off.',
  },
  {
    path: '/contact',
    title: 'Contact',
    file: 'src/pages/contact.astro',
    description:
      'Book a 30-minute fit call or email hello@meshin.co. Remote worldwide, on site when it earns the trip.',
  },
  {
    path: '/ai-policy',
    title: 'AI policy',
    file: 'src/pages/ai-policy.astro',
    description:
      'My own acceptable-use policy for AI systems: what data may reach a vendor, what may not, and who decides.',
  },
  {
    path: '/security',
    title: 'Security',
    file: 'src/pages/security.astro',
    description: 'How this site is built and served, how client data is handled, and where to report a vulnerability.',
  },
  {
    path: '/now',
    title: 'Now',
    file: 'src/pages/now.astro',
    description: 'What I am working on this month, what I am reading, and how much capacity is actually free.',
  },
  {
    path: '/imprint',
    title: 'Imprint',
    file: 'src/pages/imprint.astro',
    description: 'Who is responsible for this site, how to reach them, and what it is hosted on.',
  },
  {
    path: '/privacy',
    title: 'Privacy',
    file: 'src/pages/privacy.astro',
    description: 'What this site collects, which is almost nothing, and what happens to an email you send me.',
  },
  {
    path: '/terms',
    title: 'Terms',
    file: 'src/pages/terms.astro',
    description: 'What this site is, what the published prices mean, and which terms actually govern an engagement.',
  },
  {
    path: '/search',
    title: 'Search',
    file: 'src/pages/search.astro',
    description: 'Search the writing, glossary, services and case studies on this site.',
  },
  {
    path: '/styleguide',
    title: 'Styleguide',
    file: 'src/pages/styleguide.astro',
    description: 'Every component in every state, both themes. Internal reference page.',
  },
  {
    path: '/404',
    title: 'Not found',
    file: 'src/pages/404.astro',
    description: 'This page does not exist on meshin.co. Start from the home page.',
  },
];

export const NOINDEX_STATIC_PAGES = new Set(['/search', '/styleguide', '/404']);

export function publicIndexableStaticPages() {
  return STATIC_PAGE_CATALOG.filter((page) => !NOINDEX_STATIC_PAGES.has(page.path));
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

export function collectionHubs({ collections, staticPaths }) {
  const covered = staticPaths instanceof Set ? staticPaths : new Set(staticPaths);
  return collections.filter((collection) => !covered.has(collection.base));
}

export const HUB_PAGES = [
  {
    base: '/blog',
    title: 'Writing',
    description:
      'Notes on getting AI systems past security review and into production, written for founders and boards.',
  },
  {
    base: '/faq',
    title: 'Questions and answers',
    description:
      'What a Fractional Chief AI Officer does, what each offer produces, and how AI risk gets recorded and signed off.',
  },
  {
    base: '/glossary',
    title: 'AI governance glossary',
    description: 'Plain definitions of the AI governance terms that come up in security reviews and board meetings.',
  },
  {
    base: '/resources',
    title: 'Resources',
    description:
      'Open templates and checklists for AI governance: register, acceptable-use policy, data classification, vendor questionnaire.',
  },
  {
    base: '/services',
    title: 'Services',
    description:
      'Three ways to work with a Fractional Chief AI Officer: a two-week assessment, a 90-day production sprint, a retainer.',
  },
  {
    base: '/case-studies',
    title: 'Case studies',
    description: 'One entry, not a client case: only.help, my own product, built with the method I use for clients.',
  },
];

export function sidecarFileForRoute(route) {
  return route === '/' ? 'index.md' : `${route.slice(1)}.md`;
}

export function sidecarRoutes({ staticPages = publicIndexableStaticPages(), hubs = HUB_PAGES } = {}) {
  const staticPaths = staticPages.map((page) => page.path);
  const hubPages = collectionHubs({ collections: hubs, staticPaths }).map((hub) => ({
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
