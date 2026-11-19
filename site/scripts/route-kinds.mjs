import { FEED_BASES, SERIES_COLLECTIONS } from '../src/utils/feeds.mjs';
import { isNoindex } from './gate.mjs';

export const RESERVED_LEAF_SLUGS = new Set(['tags', 'tag', 'page', 'category']);

export const SERIES_BASES = new Set([...SERIES_COLLECTIONS].map((kind) => FEED_BASES[kind]));

const ARCHIVE_SLUGS = new Set(['tag', 'category']);
const REGISTER = 'site/src/utils/route-exceptions.mjs';

function seriesShape(base, [name, version, ...deeper]) {
  if (version === undefined) return { shape: 'series', base, id: name };
  if (deeper.length > 0) return { shape: 'page' };
  return { shape: 'entry', base, id: `${name}/${version}` };
}

export function routeShape(route, bases, seriesBases = SERIES_BASES) {
  const parts = route.split('/').filter(Boolean);
  if (parts.length >= 2 && parts.at(-2) === 'page' && /^\d+$/.test(parts.at(-1))) return { shape: 'pagination' };

  const [base, second] = parts;
  if (!bases.has(base)) return { shape: 'page' };
  if (parts.length === 1) return { shape: 'hub', base };
  if (seriesBases.has(base)) return seriesShape(base, parts.slice(1));
  if (parts.length === 2 && second === 'tags') return { shape: 'tag-index', base };
  if (parts.length === 2 && !RESERVED_LEAF_SLUGS.has(second)) return { shape: 'entry', base, id: second };
  if (parts.length === 3 && ARCHIVE_SLUGS.has(second)) return { shape: 'archive', base };
  return { shape: 'page' };
}

const finding = (rule, text, subjects) => ({ rule, text, subjects });

const undeclaredNoindex = (route) =>
  finding(
    'route-noindex-undeclared',
    `${route} is noindex in the build and nothing declares it; declare it in ${REGISTER} with a reason, or mark the entry noindex in its frontmatter`,
    [route]
  );

function classify(entry, { exceptionRoutes, declaredNoindex, liveCount, collectionOf, findings }) {
  const { route, shape, noindex } = entry;

  if (exceptionRoutes.has(route)) {
    if (noindex) return 'exception';
    findings.push(
      finding(
        'route-exception-stale',
        `${route} is a declared exception but its page is indexable; remove it from ${REGISTER} or mark the page noindex`,
        [route]
      )
    );
  }
  if (shape === 'pagination') return 'pagination';

  if (!noindex) {
    const declared = (shape === 'entry' || shape === 'archive') && declaredNoindex.has(route);
    if (declared) {
      findings.push(
        finding('route-noindex-missing', `${route} is declared noindex by its source but its built page is indexable`, [
          route,
        ])
      );
    }
    return shape;
  }

  if (shape === 'hub') {
    const collection = collectionOf.get(entry.base);
    if (liveCount(collection) > 0) {
      findings.push(
        finding(
          'route-noindex-undeclared',
          `${route} is noindex in the build but the ${collection} collection has live entries`,
          [route]
        )
      );
    }
  } else if (!((shape === 'entry' || shape === 'archive') && declaredNoindex.has(route))) {
    findings.push(undeclaredNoindex(route));
  }
  return 'withheld';
}

export function collectionEmptinessFindings({ collections, declared, liveEntries }) {
  const known = new Set(collections.map(({ kind }) => kind));
  const declaredEmpty = new Set(declared.emptyCollections.map(({ collection }) => collection));
  const hubOf = (kind) => {
    const { base } = collections.find((collection) => collection.kind === kind);
    return base === undefined ? [] : ['/' + base];
  };
  const findings = [];

  for (const { kind } of collections) {
    const live = liveEntries[kind].length;
    if (live === 0 && !declaredEmpty.has(kind)) {
      findings.push(
        finding(
          'collection-empty-undeclared',
          `collection ${kind} has no live entry in the build and is not declared empty; if that is intended, declare it in ${REGISTER} with a reason`,
          hubOf(kind)
        )
      );
    }
    if (live > 0 && declaredEmpty.has(kind)) {
      findings.push(
        finding(
          'collection-empty-stale',
          `collection ${kind} is declared empty but holds ${live} live ${live === 1 ? 'entry' : 'entries'}; remove it from ${REGISTER}`,
          hubOf(kind)
        )
      );
    }
  }
  for (const collection of declaredEmpty) {
    if (known.has(collection)) continue;
    findings.push(
      finding(
        'collection-empty-stale',
        `collection ${collection} is declared empty but the site has no such collection; remove it from ${REGISTER}`,
        []
      )
    );
  }
  return findings;
}

function exceptionFindings({ routes, declared }) {
  const built = new Set(routes);
  return declared.exceptions
    .filter(({ route }) => !built.has(route))
    .map(({ route }) =>
      finding(
        'route-exception-stale',
        `${route} is a declared exception but no page built at that route; remove it from ${REGISTER}`,
        [route]
      )
    );
}

export function deriveRouteKinds({ routes, htmlByRoute, collections, declared }) {
  const bases = new Set(collections.map(({ base }) => base));
  const seriesBases = new Set(collections.filter(({ kind }) => SERIES_COLLECTIONS.has(kind)).map(({ base }) => base));
  const collectionOf = new Map(collections.map(({ kind, base }) => [base, kind]));
  const exceptionRoutes = new Set(declared.exceptions.map(({ route }) => route));
  const shaped = routes.map((route) => ({
    route,
    ...routeShape(route, bases, seriesBases),
    noindex: isNoindex(htmlByRoute[route] ?? ''),
  }));

  const liveEntries = Object.fromEntries(collections.map(({ kind }) => [kind, []]));
  for (const { route, shape, base, noindex } of shaped) {
    if (shape === 'entry' && !noindex) liveEntries[collectionOf.get(base)].push(route);
  }
  for (const list of Object.values(liveEntries)) list.sort();

  const findings = [...exceptionFindings({ routes, declared })];
  const context = {
    exceptionRoutes,
    declaredNoindex: declared.noindexRoutes,
    liveCount: (collection) => liveEntries[collection].length,
    collectionOf,
    findings,
  };
  const derived = new Map();
  for (const entry of shaped) {
    const kind = classify(entry, context);
    const collection = entry.base === undefined ? undefined : collectionOf.get(entry.base);
    derived.set(entry.route, {
      route: entry.route,
      kind,
      shape: entry.shape,
      base: entry.base,
      id: entry.id,
      collection,
    });
  }
  findings.push(...collectionEmptinessFindings({ collections, declared, liveEntries }));
  return { routes: derived, findings, liveEntries };
}
