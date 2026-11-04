import { FEED_WINDOW } from '../../src/utils/feeds.mjs';
import { markdownPath } from '../../src/utils/machine-links.mjs';

export const SITE = 'https://example.test';

export const COLLECTIONS = [
  { kind: 'post', base: 'blog' },
  { kind: 'glossary', base: 'glossary' },
  { kind: 'case', base: 'case-studies' },
];

const ENTRIES = { post: ['first', 'second'], glossary: ['evals'] };
const PAGES = ['/', '/about'];
const EXCEPTIONS = ['/404', '/search'];
const HUBS = ['/blog', '/glossary'];
const WITHHELD_HUBS = ['/case-studies'];
const TAG_INDEX = '/blog/tags';
const ARCHIVES = ['/blog/tag/ai', '/blog/category/governance'];
const LASTMOD = '2026-10-01T00:00:00.000Z';
const DEFAULT_CARD = '/_astro/og-default.abc.jpg';

export const urlOf = (route) => (route === '/' ? SITE : SITE + route);
export const baseOf = (kind) => COLLECTIONS.find((collection) => collection.kind === kind).base;
export const entryRoutes = (kind, entries = ENTRIES) =>
  (entries[kind] ?? []).map((id) => '/' + baseOf(kind) + '/' + id);
export const allEntryRoutes = (entries = ENTRIES) => Object.keys(entries).flatMap((kind) => entryRoutes(kind, entries));

export function pngHead(width, height) {
  const head = new Uint8Array(24);
  head.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(head.buffer).setUint32(16, width);
  new DataView(head.buffer).setUint32(20, height);
  return head;
}

const cardOf = (kind, id) => '/og/' + kind + '/' + id + '.png';

function headOf(route, { noindex, markdown, feedBase, card = DEFAULT_CARD }) {
  const tags = [
    '<link href="' + urlOf(route) + '" rel="canonical">',
    '<meta content="' + urlOf(route) + '" property="og:url">',
    '<meta content="' + SITE + card + '" property="og:image">',
  ];
  if (noindex) tags.push('<meta content="noindex, follow" name="robots">');
  if (markdown) tags.push('<link href="' + markdownPath(route) + '" rel="alternate" type="text/markdown">');
  if (feedBase) tags.push('<link href="/' + feedBase + '/rss.xml" rel="alternate" type="application/rss+xml">');
  return '<!doctype html><html><head>' + tags.join('') + '</head><body></body></html>';
}

function htmlByRoute(entries) {
  const html = {};
  for (const route of [...PAGES, TAG_INDEX, ...ARCHIVES]) html[route] = headOf(route, {});
  for (const route of EXCEPTIONS) html[route] = headOf(route, { noindex: true });
  for (const route of HUBS) html[route] = headOf(route, { markdown: true, feedBase: route.slice(1) });
  for (const route of WITHHELD_HUBS) html[route] = headOf(route, { noindex: true });
  for (const kind of Object.keys(entries)) {
    for (const id of entries[kind]) {
      const route = '/' + baseOf(kind) + '/' + id;
      html[route] = headOf(route, { markdown: true, feedBase: baseOf(kind), card: cardOf(kind, id) });
    }
  }
  return html;
}

const bullet = (route) => '- [' + route + '](' + urlOf(route) + '): a page of the example site';
const block = (route) => '# ' + route + '\n\n' + LASTMOD + '\n\n[' + urlOf(route) + '](' + urlOf(route) + ')\n\nBody.';
const section = (routes) => '# example.test\n\n## Entries\n\n' + routes.map(block).join('\n\n---\n\n') + '\n';
export const feedOf = (routes) =>
  '<?xml version="1.0"?><rss><channel><link>' +
  SITE +
  '</channel>' +
  routes
    .map(
      (route) => '<item><link>' + urlOf(route) + '</link><guid isPermaLink="true">' + urlOf(route) + '</guid></item>'
    )
    .join('') +
  '</channel></rss>';
const shard = (routes) =>
  JSON.stringify(routes.map((route) => ({ href: route, title: route, description: '', kind: 'x', text: '' })));

const entriesText = (count) => count + (count === 1 ? ' entry' : ' entries');
const pointerLine = (kind, count) =>
  '- [' + kind + '](' + SITE + '/llms/' + kind + '.txt): ' + entriesText(count) + ', full body text of each.';
const pointerIndex = (entries) =>
  '# example.test\n\n## Collections\n\n' +
  Object.keys(entries)
    .filter((kind) => entries[kind].length > 0)
    .map((kind) => pointerLine(kind, entries[kind].length))
    .join('\n') +
  '\n';

function llmsFilesOf(kind, routes, shardSize) {
  const file = 'llms/' + kind + '.txt';
  if (shardSize === undefined || routes.length <= shardSize) return { [file]: section(routes) };
  const parts = Array.from({ length: Math.ceil(routes.length / shardSize) }, (_, at) =>
    routes.slice(at * shardSize, (at + 1) * shardSize)
  );
  const shardFiles = parts.map((_, at) => 'llms/' + kind + '-' + (at + 1) + '.txt');
  const lines = shardFiles.map(
    (name, at) => '- [Entries](' + SITE + '/' + name + '): ' + entriesText(parts[at].length)
  );
  return {
    [file]: '# example.test\n\n## Parts\n\n' + lines.join('\n') + '\n',
    ...Object.fromEntries(shardFiles.map((name, at) => [name, section(parts[at])])),
  };
}

function textsOf({ inlineKinds, entries, shardSize }) {
  const inlined = inlineKinds.flatMap((kind) => entryRoutes(kind, entries));
  const listed = [...PAGES, ...HUBS, TAG_INDEX, ...inlined];
  const texts = {
    'sitemap-0.xml':
      '<urlset>' +
      [...PAGES, ...HUBS, TAG_INDEX, ...ARCHIVES, ...allEntryRoutes(entries)]
        .map((route) => '<url><loc>' + urlOf(route) + '</loc><lastmod>' + LASTMOD + '</lastmod></url>')
        .join('') +
      '</urlset>',
    'llms.txt': '# example.test\n\n## Pages\n\n' + listed.map(bullet).join('\n') + '\n',
    'llms-full.txt': pointerIndex(entries),
    'rss.xml': feedOf(allEntryRoutes(entries)),
    'search-index-page.json': shard([...PAGES, ...HUBS, TAG_INDEX, ...ARCHIVES]),
    'search-index-case.json': shard([]),
  };
  for (const kind of Object.keys(entries)) {
    const routes = entryRoutes(kind, entries);
    Object.assign(texts, llmsFilesOf(kind, routes, shardSize));
    texts[baseOf(kind) + '/rss.xml'] = feedOf(routes.slice(0, FEED_WINDOW));
    texts['search-index-' + kind + '.json'] = shard(routes);
  }
  return texts;
}

function shippedFiles(entries) {
  const sidecars = [...PAGES, ...HUBS, TAG_INDEX, ...allEntryRoutes(entries)].map((route) =>
    route === '/' ? 'index.md' : route.slice(1) + '.md'
  );
  const cards = Object.keys(entries).flatMap((kind) => entries[kind].map((id) => cardOf(kind, id).slice(1)));
  return [...sidecars, ...cards, DEFAULT_CARD.slice(1)];
}

export function buildWorld({ inlineKinds = [], entries: replaced = {}, shardSize } = {}) {
  const entries = { ...ENTRIES, ...replaced };
  const shipped = shippedFiles(entries);
  const lastmods = new Map(
    [...PAGES, ...HUBS, TAG_INDEX, ...ARCHIVES, ...allEntryRoutes(entries)].map((route) => [route, LASTMOD])
  );
  return {
    site: SITE,
    routes: [
      ...PAGES,
      ...EXCEPTIONS,
      ...HUBS,
      ...WITHHELD_HUBS,
      TAG_INDEX,
      ...ARCHIVES,
      ...allEntryRoutes(entries),
    ].sort(),
    htmlByRoute: htmlByRoute(entries),
    collections: COLLECTIONS,
    texts: textsOf({ inlineKinds, entries, shardSize }),
    shipped,
    imageHeads: Object.fromEntries(
      shipped.filter((file) => file.endsWith('.png')).map((file) => [file, pngHead(1200, 630)])
    ),
    sitemapLastmods: lastmods,
    inlineKinds,
    declared: {
      exceptions: EXCEPTIONS.map((route) => ({ route, reason: 'A page that is deliberately outside the index.' })),
      emptyCollections: [{ collection: 'case', reason: 'No client has agreed to a case study yet.' }],
      noindexRoutes: new Set(),
    },
  };
}
