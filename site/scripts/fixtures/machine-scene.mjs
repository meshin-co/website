import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { brandFromDisk } from '../../src/utils/brand.mjs';
import { FEED_BASES } from '../../src/utils/feeds.mjs';
import { LLMS_COLLECTIONS } from '../../src/utils/llms-collections.mjs';
import {
  HUB_PAGES,
  NOINDEX_STATIC_PAGES,
  STATIC_PAGE_CATALOG,
  absoluteUrl,
  entryCount,
  publicIndexableStaticPages,
  sidecarFileForRoute,
} from '../../src/utils/machine-text.mjs';
import { siteLastmods } from '../../src/utils/sitemap-lastmod.mjs';
import { GATE_FINDINGS_VARIABLE } from '../gate-findings.mjs';

export const readText = (file) => readFileSync(file, 'utf8');

export function writeText(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

export const editText = (file, change) => writeText(file, change(readText(file)));

export const appendText = (file, extra) => editText(file, (text) => `${text}${extra}`);

export function editJson(file, change) {
  const document = JSON.parse(readText(file));
  change(document);
  writeText(file, JSON.stringify(document));
}

export function dropLines(file, needle) {
  const keep = (line) => !line.includes(needle);
  editText(file, (text) => text.split('\n').filter(keep).join('\n'));
}

export const removeFile = (file) => rmSync(file);

const SITE_ROOT = join(import.meta.dirname, '..', '..');
const MACHINE_SCRIPT = join(import.meta.dirname, '..', 'machine.mjs');
const FALLBACK_DAY = '2026-10-01';
const NOTE = 'a page of the synthetic site';
const NOINDEX_HEADER_PATTERNS = [
  '/rss.xml',
  '/*/rss.xml',
  '/feed.json',
  '/llms.txt',
  '/llms-full.txt',
  '/llms/*',
  '/search-index*',
  '/*.md',
];

export const HOST = brandFromDisk(join(SITE_ROOT, 'src', 'config.yaml')).name;
export const ORIGIN = `https://${HOST}`;

export const LIVE = {
  post: [
    { slug: 'first-post', title: 'First post', published: '2026-09-01', updated: '2026-10-01' },
    { slug: 'second-post', title: 'Second post', published: '2026-09-10', updated: '2026-10-05' },
  ],
  service: [{ slug: 'sprint', title: 'Sprint', published: '2026-09-01', updated: '2026-10-01' }],
  glossary: [{ slug: 'evals', title: 'Evals', published: '2026-09-02', updated: '2026-09-20' }],
};

const KINDS = Object.keys(FEED_BASES);
const LIVE_KINDS = Object.keys(LIVE);
const EMPTY_KINDS = KINDS.filter((kind) => !LIVE_KINDS.includes(kind));
const HUB_ROUTES = KINDS.map((kind) => `/${FEED_BASES[kind]}`);
const EMPTY_HUBS = EMPTY_KINDS.map((kind) => `/${FEED_BASES[kind]}`);

const instantOf = (day) => `${day}T00:00:00.000Z`;
const urlOf = (route) => (route === '/' ? ORIGIN : `${ORIGIN}${route}`);
const routeOf = (kind, entry) => `/${FEED_BASES[kind]}/${entry.slug}`;
const liveRoutes = (kind) => LIVE[kind].map((entry) => routeOf(kind, entry));
const titleOfKind = (kind) => LLMS_COLLECTIONS.find(({ name }) => name === kind).title;
const isNoindex = ({ route }) => NOINDEX_STATIC_PAGES.has(route) || EMPTY_HUBS.includes(route);
const htmlFileOf = (route) => (route === '/' ? 'index.html' : `${route.slice(1)}.html`);
const alternate = (type, href) => `<link rel="alternate" type="${type}" href="${href}">`;
const bullet = (title, route, text = NOTE) => `- [${title}](${absoluteUrl(ORIGIN, route)}): ${text}`;

function catalogPages() {
  const byRoute = new Map(STATIC_PAGE_CATALOG.map((page) => [page.path, { ...page, route: page.path }]));
  for (const { base, title, description } of HUB_PAGES) {
    if (!byRoute.has(base)) byRoute.set(base, { route: base, title, description });
  }
  return [...byRoute.values()];
}

function entryPages() {
  const pages = [];
  for (const kind of LIVE_KINDS) {
    for (const entry of LIVE[kind]) {
      pages.push({ route: routeOf(kind, entry), title: entry.title, description: NOTE });
    }
  }
  return pages;
}

function jsonLd(page) {
  const node = { '@id': `${urlOf(page.route)}#webpage`, '@type': 'WebPage' };
  node.dateModified = instantOf(page.updatedDate);
  return `<script type="application/ld+json">${JSON.stringify({ '@graph': [node] })}</script>`;
}

function pageHtml(page) {
  const head = [
    `<title>${page.title}</title>`,
    `<meta name="description" content="${page.description}">`,
    `<link rel="canonical" href="${urlOf(page.route)}">`,
    `<meta property="og:url" content="${urlOf(page.route)}">`,
  ];
  if (isNoindex(page)) head.push('<meta name="robots" content="noindex">');
  if (page.route === '/') {
    head.push(alternate('text/plain', '/llms.txt'), alternate('application/rss+xml', '/rss.xml'));
    head.push(alternate('application/feed+json', '/feed.json'));
  }
  if (HUB_ROUTES.includes(page.route) && !isNoindex(page)) {
    head.push(alternate('application/rss+xml', `${page.route}/rss.xml`));
  }
  if (page.updatedDate) head.push(jsonLd(page));
  const body = `<body><h1>${page.title}</h1></body>`;
  return `<!doctype html><html lang="en"><head>\n${head.join('\n')}\n</head>${body}</html>\n`;
}

function sidecarText({ route, title, description }, day) {
  const lines = [`# ${title}`, '', `> ${description}`, '', `Source: ${absoluteUrl(ORIGIN, route)}`];
  lines.push(`Updated: ${day}`, '', '---', '', `The text of ${title}.`, '');
  return lines.join('\n');
}

function entryBlock(kind, entry) {
  const url = urlOf(routeOf(kind, entry));
  const lines = [`# ${entry.title}`, '', instantOf(entry.updated), '', `[${url}](${url})`];
  return [...lines, '', `The text of ${entry.title}.`].join('\n');
}

function collectionSection(kind) {
  const blocks = LIVE[kind].map((entry) => entryBlock(kind, entry));
  return `## ${titleOfKind(kind)}\n\n${blocks.join('\n\n---\n\n')}`;
}

function llmsTxt(indexable) {
  const isHub = (page) => HUB_ROUTES.includes(page.route);
  const pagesOf = (selected) => selected.map((page) => bullet(page.title, page.route));
  const counted = (kind) => `${entryCount(LIVE[kind].length)}, full body text of each.`;
  const sections = [
    ['Offers', LIVE.service.map((entry) => bullet(entry.title, routeOf('service', entry)))],
    ['Pages', pagesOf(indexable.filter((page) => !isHub(page)))],
    ['Hubs', pagesOf(indexable.filter(isHub))],
    [
      'Full text',
      [
        bullet('Everything in full', '/llms-full.txt'),
        ...LIVE_KINDS.map((kind) => bullet(titleOfKind(kind), `/llms/${kind}.txt`, counted(kind))),
      ],
    ],
    [
      'Feeds',
      [
        bullet('All updates', '/rss.xml'),
        ...LIVE_KINDS.map((kind) => bullet(`${titleOfKind(kind)} feed`, `/${FEED_BASES[kind]}/rss.xml`)),
      ],
    ],
  ];
  const blocks = sections.map(([title, lines]) => `## ${title}\n\n${lines.join('\n')}`);
  return `# ${HOST}\n\n> A synthetic site.\n\n${blocks.join('\n\n')}\n`;
}

function rssFeed(routes) {
  const items = routes.map((route) => `<item><guid isPermaLink="true">${urlOf(route)}</guid></item>`);
  const head = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${HOST}</title>`;
  return `${head}\n${items.join('\n')}\n</channel></rss>\n`;
}

function sitemapXml(lastmods) {
  const routes = Object.keys(lastmods).sort();
  const urls = routes.map((route) => `<url><loc>${urlOf(route)}</loc><lastmod>${lastmods[route]}</lastmod></url>`);
  const head = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  return `${head}\n${urls.join('\n')}\n</urlset>\n`;
}

const headersText = () => NOINDEX_HEADER_PATTERNS.map((pattern) => `${pattern}\n  X-Robots-Tag: noindex\n`).join('\n');

function contentConfig() {
  const names = [...KINDS, 'author', 'speaking'];
  const lines = ["import { defineCollection } from 'astro:content';", '', 'export const collections = {'];
  return [...lines, ...names.map((name) => `  ${name}: ${name}Collection,`), '};', ''].join('\n');
}

function frontmatter(entry) {
  const lines = ['---', `title: ${entry.title}`, `publishDate: ${entry.published}`, `updatedDate: ${entry.updated}`];
  return [...lines, '---', '', `The text of ${entry.title}.`, ''].join('\n');
}

function writeSite(site) {
  const manifest = {
    name: 'machine-scene',
    dependencies: { astro: '7.0.0' },
    devDependencies: { tailwindcss: '4.0.0' },
  };
  writeText(join(site, 'src/config.yaml'), `site:\n  name: ${HOST}\n`);
  writeText(join(site, 'src/content.config.ts'), contentConfig());
  writeText(join(site, 'package.json'), JSON.stringify(manifest));
  for (const kind of LIVE_KINDS) {
    for (const entry of LIVE[kind]) writeText(join(site, `src/data/${kind}/${entry.slug}.md`), frontmatter(entry));
  }
}

function writeDist(dist, lastmods) {
  const at = (file) => join(dist, file);
  const catalog = catalogPages();
  const entries = entryPages();
  const indexable = catalog.filter((page) => !isNoindex(page));
  const dayOf = (route) => (lastmods[route] ?? instantOf(FALLBACK_DAY)).slice(0, 10);
  const everything = LIVE_KINDS.flatMap(liveRoutes);

  for (const page of [...catalog, ...entries]) writeText(at(htmlFileOf(page.route)), pageHtml(page));
  for (const page of [...indexable, ...entries]) {
    writeText(at(sidecarFileForRoute(page.route)), sidecarText(page, dayOf(page.route)));
  }

  writeText(at('humans.txt'), `/* TEAM */\nSite: ${ORIGIN}\n\n/* SITE */\nComponents: Astro, Tailwind CSS\n`);
  writeText(at('_headers'), headersText());
  writeText(at('sitemap-0.xml'), sitemapXml(lastmods));
  writeText(at('llms.txt'), llmsTxt(indexable));
  writeText(at('llms-full.txt'), `# ${HOST}\n\n${LIVE_KINDS.map(collectionSection).join('\n\n')}\n`);
  for (const kind of LIVE_KINDS) {
    writeText(at(`llms/${kind}.txt`), `# ${HOST}\n\n${collectionSection(kind)}\n`);
    writeText(at(`${FEED_BASES[kind]}/rss.xml`), rssFeed(liveRoutes(kind)));
  }
  writeText(at('rss.xml'), rssFeed(everything));
  const items = everything.map((route) => ({ url: urlOf(route) }));
  writeText(at('feed.json'), JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', items }));
  return [...catalog, ...entries].map((page) => page.route).sort();
}

export async function buildMachineScene() {
  const root = mkdtempSync(join(tmpdir(), 'machine-scene-'));
  const site = join(root, 'site');
  const dist = join(site, 'dist');

  writeSite(site);
  const staticPages = publicIndexableStaticPages();
  const lastmods = await siteLastmods({ dataDir: join(site, 'src', 'data'), staticPages });
  const routes = writeDist(dist, lastmods);

  return {
    root,
    site,
    dist,
    routes,
    emptyKinds: EMPTY_KINDS,
    collections: KINDS.length,
    catalogEntries: STATIC_PAGE_CATALOG.length + HUB_PAGES.length,
    datedStaticRoutes: staticPages.filter((page) => page.updatedDate).length,
    siteFile: (file) => join(site, file),
    distFile: (file) => join(dist, file),
  };
}

export function runMachine(scene, { findingsDir, env = {} } = {}) {
  const inherited = { ...process.env };
  delete inherited[GATE_FINDINGS_VARIABLE];
  const recorded = findingsDir === undefined ? {} : { [GATE_FINDINGS_VARIABLE]: findingsDir };
  return spawnSync(process.execPath, [MACHINE_SCRIPT, scene.dist], {
    cwd: scene.site,
    env: { ...inherited, ...recorded, ...env },
    encoding: 'utf8',
  });
}

export const removeScene = (scene) => rmSync(scene.root, { recursive: true, force: true });
