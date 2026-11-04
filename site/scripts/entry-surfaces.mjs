import { entryRoute } from './entry-files.mjs';
import { BOUNDED_INLINE_COLLECTIONS } from './machine.mjs';
import { deriveRouteKinds } from './route-kinds.mjs';
import { SURFACES, guidPaths, owedFor } from './route-parity.mjs';
import { FEED_BASES } from '../src/utils/feeds.mjs';
import { ogImagePath } from '../src/utils/machine-links.mjs';

const CARD = 'og-image';
const COLLECTION_FEED = 'collection-feed';
const COLLECTIONS = Object.entries(FEED_BASES).map(([kind, base]) => ({ kind, base }));
const NOTHING_DECLARED = { exceptions: [], noindexRoutes: new Set(), emptyCollections: [] };

const withoutTrailingSlashes = (origin) => origin.replace(/\/+$/, '');
const firstOfEach = (surface, at, all) => all.findIndex(({ path }) => path === surface.path) === at;

function describeRoute(route) {
  const { routes } = deriveRouteKinds({
    routes: [route],
    htmlByRoute: {},
    collections: COLLECTIONS,
    declared: NOTHING_DECLARED,
  });
  return routes.get(route);
}

const addressOf = (id, info) => (id === CARD ? ogImagePath(info.collection, info.id) : SURFACES[id].artifact(info));

function feedHeadsOf(info, { site, read }) {
  const feedFile = SURFACES[COLLECTION_FEED].artifact(info).slice(1);
  return new Map([[info.collection, guidPaths(read(feedFile) ?? '', site)[0]]]);
}

export function surfacesOf({ format, slug, origin, read = () => undefined }) {
  const info = describeRoute(entryRoute({ format, slug }));
  const site = withoutTrailingSlashes(origin);
  const owed = owedFor(info, {
    inlineKinds: new Set(BOUNDED_INLINE_COLLECTIONS),
    feedHeads: feedHeadsOf(info, { site, read }),
  });
  const surfaces = owed.map((id) => ({ kind: id, label: SURFACES[id].label, path: addressOf(id, info) }));
  return [{ kind: 'page', label: 'the page', path: info.route }, ...surfaces]
    .filter(firstOfEach)
    .map(({ kind, label, path }) => ({ kind, label, url: `${site}${path}` }));
}
