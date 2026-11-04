import { KINDS } from '../public/search/shards.mjs';
import { indexDocuments, listedPaths } from './collection-gate.mjs';
import { META_TAG, declaredUrl, linkTags, attributeOf } from './head-tags.mjs';
import { deriveRouteKinds } from './route-kinds.mjs';
import { FEED_WINDOW } from '../src/utils/feeds.mjs';
import { OG_HEIGHT, OG_WIDTH, markdownPath } from '../src/utils/machine-links.mjs';
import { sidecarFileForRoute } from '../src/utils/machine-text.mjs';
import { manifestPath } from '../src/utils/search-index.mjs';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PAGE_SHARD = 'page';
const KIND_ORDER = ['entry', 'hub', 'page', 'tag-index', 'archive', 'pagination', 'exception', 'withheld'];
const PAGE_SURFACES = ['sitemap', 'sidecar', 'llms-index', 'search-shard', 'og-image'];

export const OWED = {
  entry: [
    'sitemap',
    'sidecar',
    'sidecar-link',
    'llms-collection',
    'collection-feed',
    'feed-link',
    'search-shard',
    'og-image',
  ],
  hub: ['sitemap', 'sidecar', 'sidecar-link', 'llms-index', 'feed-link', 'search-shard', 'og-image'],
  page: PAGE_SURFACES,
  'tag-index': PAGE_SURFACES,
  archive: ['sitemap', 'search-shard', 'og-image'],
  pagination: [],
  exception: [],
  withheld: [],
};

export const CONDITIONAL = {
  'llms-index': 'an entry of a collection that llms.txt lists inline',
  'merged-feed': 'the newest entry of a collection',
};

const memo = (read) => {
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) cache.set(key, read(key));
    return cache.get(key);
  };
};

const pathOfUrl = (url, site) => {
  const { pathname } = new URL(url.trim(), site);
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
};

export const guidPaths = (xml, site) =>
  [...xml.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map(([, url]) => pathOfUrl(url, site));

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const newestFirst = (lastmods) => (a, b) => compare(lastmods.get(b) ?? '', lastmods.get(a) ?? '') || compare(a, b);

function routesBeyondFeedWindow(derivedRoutes, lastmods) {
  const entries = [...derivedRoutes.values()].filter(({ kind }) => kind === 'entry');
  return new Set(
    [...Map.groupBy(entries, ({ collection }) => collection).values()].flatMap((collection) =>
      collection
        .map(({ route }) => route)
        .sort(newestFirst(lastmods))
        .slice(FEED_WINDOW)
    )
  );
}

function readSurfaces({ site, texts, shipped, sitemapLastmods, collections, inlineKinds }, derived) {
  const listing = (file) => new Set(texts[file] === undefined ? [] : listedPaths(file, texts[file], site));
  const documents = indexDocuments(texts);
  const llmsCollections = {};
  for (const file of Object.keys(texts)) {
    const kind = /^llms\/(.+?)(?:-\d+)?\.txt$/.exec(file)?.[1];
    if (kind !== undefined) llmsCollections[kind] = new Set([...(llmsCollections[kind] ?? []), ...listing(file)]);
  }
  const feedHeads = new Map(
    collections.map(({ kind, base }) => [kind, guidPaths(texts[`${base}/rss.xml`] ?? '', site)[0]])
  );

  return {
    texts,
    shipped: new Set(shipped),
    lastmods: sitemapLastmods,
    llmsIndex: listing('llms.txt'),
    llmsCollections,
    feed: memo((base) => new Set(guidPaths(texts[`${base}/rss.xml`] ?? '', site))),
    merged: new Set(guidPaths(texts['rss.xml'] ?? '', site)),
    shard: memo(
      (kind) => new Set(documents.filter((document) => document.kind === KINDS[kind]?.label).map(({ href }) => href))
    ),
    feedHeads,
    inlineKinds: new Set(inlineKinds),
    beyondFeedWindow: routesBeyondFeedWindow(derived.routes, sitemapLastmods),
  };
}

const phrase = (file, ctx, listed) =>
  ctx.texts[file.slice(1)] === undefined ? `${file} did not ship` : `${file} ${listed}`;

const hasLink = (html, test) => linkTags(html).some(test);

function pngDefect(head) {
  if (head === undefined) return 'could not be read';
  if (PNG_SIGNATURE.some((byte, index) => head[index] !== byte)) return 'is not a PNG';
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const [width, height] = [view.getUint32(16), view.getUint32(20)];
  return width === OG_WIDTH && height === OG_HEIGHT ? null : `is ${width}x${height}, not ${OG_WIDTH}x${OG_HEIGHT}`;
}

function ogAbsence({ route }, ctx, { site, htmlByRoute, imageHeads }) {
  const declared = declaredUrl(htmlByRoute[route] ?? '', META_TAG, 'property', 'og:image', 'content');
  if (declared === undefined) return 'its head declares no og:image';
  const url = new URL(declared, site);
  if (url.origin !== new URL(site).origin) return `its og:image ${declared} is off this site and cannot be checked`;
  const file = decodeURI(url.pathname.slice(1));
  if (!ctx.shipped.has(file)) return `its og:image ${url.pathname} is not a file this build ships`;
  if (!file.endsWith('.png')) return null;
  const defect = pngDefect(imageHeads[file]);
  return defect === null ? null : `its og:image ${url.pathname} ${defect}`;
}

const shardKind = ({ kind, collection }) => (kind === 'entry' ? collection : PAGE_SHARD);

export const SURFACES = {
  sitemap: {
    label: 'a sitemap entry with a lastmod',
    artifact: () => '/sitemap-0.xml',
    absence: ({ route }, ctx) => {
      if (!ctx.lastmods.has(route)) return '/sitemap-0.xml does not list it';
      return ctx.lastmods.get(route) ? null : '/sitemap-0.xml lists it with no lastmod';
    },
  },
  sidecar: {
    label: 'a markdown sidecar',
    artifact: ({ route }) => `/${sidecarFileForRoute(route)}`,
    absence: ({ route }, ctx) =>
      ctx.shipped.has(sidecarFileForRoute(route)) ? null : `/${sidecarFileForRoute(route)} did not ship`,
  },
  'sidecar-link': {
    label: 'a markdown alternate link',
    artifact: ({ route }) => route,
    absence: ({ route }, _ctx, { htmlByRoute }) => {
      const href = markdownPath(route);
      const found = hasLink(
        htmlByRoute[route] ?? '',
        (tag) => attributeOf(tag, 'type') === 'text/markdown' && attributeOf(tag, 'href') === href
      );
      return found ? null : `its head has no <link rel="alternate" type="text/markdown" href="${href}">`;
    },
  },
  'llms-index': {
    label: 'a line in llms.txt',
    artifact: () => '/llms.txt',
    absence: ({ route }, ctx) => (ctx.llmsIndex.has(route) ? null : phrase('/llms.txt', ctx, 'does not list it')),
  },
  'llms-collection': {
    label: 'a place in its llms collection file',
    artifact: ({ collection }) => `/llms/${collection}.txt`,
    absence: ({ route, collection }, ctx) =>
      ctx.llmsCollections[collection]?.has(route)
        ? null
        : phrase(`/llms/${collection}.txt`, ctx, 'and its shards do not list it'),
  },
  'collection-feed': {
    label: 'an item in its collection feed',
    artifact: ({ base }) => `/${base}/rss.xml`,
    absence: ({ route, base }, ctx) =>
      ctx.feed(base).has(route) ? null : phrase(`/${base}/rss.xml`, ctx, 'carries no guid for it'),
  },
  'feed-link': {
    label: 'a link to its collection feed',
    artifact: ({ route }) => route,
    absence: ({ route, base }, _ctx, { htmlByRoute }) => {
      const found = hasLink(
        htmlByRoute[route] ?? '',
        (tag) => attributeOf(tag, 'rel') === 'alternate' && attributeOf(tag, 'href') === `/${base}/rss.xml`
      );
      return found ? null : `its head has no <link rel="alternate"> to /${base}/rss.xml`;
    },
  },
  'merged-feed': {
    label: 'a place in the merged feed',
    artifact: () => '/rss.xml',
    absence: ({ route, collection }, ctx) =>
      ctx.merged.has(route) ? null : `it is the newest ${collection} entry and /rss.xml carries no item for it`,
  },
  'search-shard': {
    label: 'a search entry',
    artifact: () => manifestPath,
    absence: (info, ctx) =>
      ctx.shard(shardKind(info)).has(info.route) ? null : phrase(manifestPath, ctx, 'holds no entry for it'),
  },
  'og-image': {
    label: 'a social card',
    artifact: ({ route }) => route,
    absence: ogAbsence,
  },
};

export const SURFACE_IDS = Object.keys(SURFACES);

export function owedFor(info, ctx) {
  const surfaces = [...OWED[info.kind]];
  if (info.kind !== 'entry') return surfaces;
  if (ctx.inlineKinds.has(info.collection)) surfaces.push('llms-index');
  if (ctx.feedHeads.get(info.collection) === info.route) surfaces.push('merged-feed');
  if (!ctx.beyondFeedWindow?.has(info.route)) return surfaces;
  return surfaces.filter((surface) => surface !== 'collection-feed');
}

const emptyTally = () => Object.fromEntries(SURFACE_IDS.map((surface) => [surface, { owed: 0, present: 0 }]));

function ledgerOf(derived, tally, declared) {
  const kinds = Object.fromEntries(KIND_ORDER.map((kind) => [kind, 0]));
  for (const { kind } of derived.routes.values()) kinds[kind] += 1;
  const sum = (field) => Object.values(tally).reduce((total, cell) => total + cell[field], 0);
  const byRoute = (a, b) => (a.route ?? a.collection).localeCompare(b.route ?? b.collection);
  return {
    routes: derived.routes.size,
    kinds,
    cells: { owed: sum('owed'), present: sum('present') },
    surfaces: tally,
    exceptions: [...declared.exceptions].sort(byRoute),
    emptyCollections: [...declared.emptyCollections].sort(byRoute),
  };
}

export function routeParity(input) {
  const derived = deriveRouteKinds(input);
  const ctx = readSurfaces(input, derived);
  const tally = emptyTally();
  const findings = [...derived.findings];

  for (const info of [...derived.routes.values()].sort((a, b) => a.route.localeCompare(b.route))) {
    for (const surface of owedFor(info, ctx)) {
      const { label, artifact, absence } = SURFACES[surface];
      tally[surface].owed += 1;
      const missing = absence(info, ctx, input);
      if (missing === null) {
        tally[surface].present += 1;
        continue;
      }
      findings.push({
        rule: 'route-surface-missing',
        text: `${info.route} is owed ${label}: ${missing}`,
        subjects: [info.route, artifact(info)],
      });
    }
  }

  const ledger = ledgerOf(derived, tally, input.declared);
  if (ledger.cells.owed === 0) {
    findings.push({
      rule: 'examined-nothing',
      text: 'route parity examined nothing: no route in the build is owed a surface, so none was checked',
      subjects: [],
    });
  }
  return { findings, ledger };
}

const counted = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const named = (names) => (names.length === 0 ? '' : ` (${names.join(', ')})`);

export function parityLines({ routes, kinds, cells, exceptions, emptyCollections }) {
  const shapes = KIND_ORDER.map((kind) => `${kinds[kind]} ${kind}`).join(', ');
  const derived = `machine: route parity derived ${routes} routes (${shapes}) and checked ${cells.owed} owed cells across ${SURFACE_IDS.length} surfaces, ${cells.present} present`;
  const declared = `machine: route parity declares ${counted(exceptions.length, 'exception')}${named(exceptions.map(({ route }) => route))} and ${counted(emptyCollections.length, 'empty collection')}${named(emptyCollections.map(({ collection }) => collection))}`;
  return [derived, declared];
}
