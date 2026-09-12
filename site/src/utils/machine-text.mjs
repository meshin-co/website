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

function renderLink({ title, url, description }) {
  return `- [${title}](${url}): ${description}`;
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

function renderEntry({ title, url, summary, body }) {
  return [`# ${title}`, url, summary, '', stripMarkdown(body ?? '')].join('\n');
}

export function renderLlmsFull({ site, entries }) {
  const body = entries.filter(isLive).map(renderEntry).join('\n\n---\n\n');
  const blocks = body ? [`# ${site}`, body] : [`# ${site}`];
  return `${blocks.join('\n\n')}\n`;
}

function toFeedItem(entry) {
  return {
    id: entry.id ?? entry.url,
    url: entry.url,
    title: entry.title,
    summary: entry.summary,
    content_text: stripMarkdown(entry.body ?? ''),
    date_published: new Date(entry.publishDate).toISOString(),
    date_modified: new Date(entry.updatedDate ?? entry.publishDate).toISOString(),
    tags: entry.tags ?? [],
  };
}

function byNewestFirst(a, b) {
  return a.date_published < b.date_published ? 1 : a.date_published > b.date_published ? -1 : 0;
}

export function buildFeedItems(entries) {
  return entries.filter(isLive).map(toFeedItem).sort(byNewestFirst);
}

export const STATIC_PAGES = [
  {
    path: '/',
    title: 'Home',
    description:
      'Fractional AI leadership for 30–300 person companies: governance that passes enterprise procurement, and agentic systems shipped to production with evals and observability.',
  },
  {
    path: '/approach',
    title: 'How I work',
    description:
      'The six things that decide whether an AI initiative reaches production, and the order I work through them.',
  },
  {
    path: '/pricing',
    title: 'Pricing',
    description:
      'A two-week Assessment, a 90-Day Production Sprint, and a monthly Fractional CAIO Retainer. Fixed structures, no hourly billing.',
  },
  {
    path: '/faq',
    title: 'Questions and answers',
    description:
      'What a Fractional Chief AI Officer does, what each offer produces, and how AI risk gets recorded and signed off.',
  },
  {
    path: '/about',
    title: 'About Dmitri Meshin',
    description:
      'Platform engineer working as a Fractional Chief AI Officer for companies of 30 to 300 people. Remote worldwide.',
  },
  {
    path: '/contact',
    title: 'Contact',
    description:
      'Book a 30-minute fit call or email hello@meshin.co. Remote worldwide, on site when it earns the trip.',
  },
];

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
