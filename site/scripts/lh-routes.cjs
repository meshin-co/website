const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative, sep } = require('node:path');

const UNAUDITED_ROUTES = new Set(['/styleguide']);
const NOINDEX_BY_DESIGN = [
  '/404',
  '/search',
  '/blog/category/executive',
  '/case-studies',
  '/blog/page/*',
  '/blog/category/*/page/*',
  '/blog/tag/*/page/*',
];
const SEO_AUDITS_EXCEPT_CRAWLABLE = [
  'document-title',
  'meta-description',
  'http-status-code',
  'link-text',
  'crawlable-anchors',
  'robots-txt',
  'image-alt',
  'hreflang',
  'canonical',
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOINDEX_ROUTE_PATTERN = NOINDEX_BY_DESIGN.map((entry) => escapeRegExp(entry).replace(/\\\*/g, '[^/]+')).join('|');
const NOINDEX_ROUTE_MATCHER = new RegExp(`^(?:${NOINDEX_ROUTE_PATTERN})$`);

function canonicalRoute(route) {
  return route.length > 1 && route.endsWith('/') ? route.slice(0, -1) : route;
}

const ROBOTS_NOINDEX = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i;

function builtPage(distDir, route) {
  const base = canonicalRoute(route).slice(1);
  for (const candidate of [join(distDir, `${base}.html`), join(distDir, base, 'index.html')]) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
  }
  return null;
}

function isNoindexByDesign(route, distDir) {
  const html = distDir ? builtPage(distDir, route) : null;
  if (html !== null) return ROBOTS_NOINDEX.test(html);
  return NOINDEX_ROUTE_MATCHER.test(canonicalRoute(route));
}

function discoverBuiltRoutes(distDir) {
  if (!existsSync(distDir)) return [];
  const entries = readdirSync(distDir, { withFileTypes: true, recursive: true });
  const routes = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => relative(distDir, join(entry.parentPath, entry.name)))
    .map((file) => `/${file.split(sep).join('/')}`)
    .map((route) => route.replace(/\/index\.html$/, '').replace(/\.html$/, ''))
    .map((route) => route || '/');
  return [...new Set(routes)].sort();
}

function routeFilePath(distDir, route) {
  const path = join(distDir, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
  return existsSync(path) ? path : null;
}

function builtByteSize(distDir, route) {
  const path = routeFilePath(distDir, route);
  return path ? statSync(path).size : 0;
}

function familyOf(route) {
  return route === '/' ? '' : route.slice(0, route.lastIndexOf('/'));
}

function heaviestOf(distDir, routes) {
  let heaviest = routes[0];
  let heaviestSize = builtByteSize(distDir, heaviest);
  for (const route of routes.slice(1)) {
    const size = builtByteSize(distDir, route);
    if (size > heaviestSize) {
      heaviest = route;
      heaviestSize = size;
    }
  }
  return heaviest;
}

function auditableRoutes(distDir) {
  const routes = discoverBuiltRoutes(distDir).filter((route) => !UNAUDITED_ROUTES.has(route));
  const byFamily = new Map();
  for (const route of routes) {
    const family = familyOf(route);
    byFamily.set(family, [...(byFamily.get(family) ?? []), route]);
  }
  const selected = [];
  for (const [family, members] of byFamily) {
    selected.push(...(family !== '' && members.length > 1 ? [heaviestOf(distDir, members)] : members));
  }
  return selected.sort();
}

function resolveOnlyRoutesPath(env) {
  return env.LH_ONLY_ROUTES ? env.LH_ONLY_ROUTES : null;
}

function readTouchedRoutes(path) {
  if (!existsSync(path)) {
    throw new Error(`lh-routes: LH_ONLY_ROUTES names ${path}, which does not exist`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`lh-routes: LH_ONLY_ROUTES file ${path} is not valid JSON (${error.message})`, { cause: error });
  }
  if (!Array.isArray(parsed) || !parsed.every((route) => typeof route === 'string')) {
    throw new Error(`lh-routes: LH_ONLY_ROUTES file ${path} must contain a JSON array of route strings`);
  }
  return parsed;
}

function resolveAuditPlan({ distDir, env }) {
  const full = auditableRoutes(distDir);
  const onlyRoutesPath = resolveOnlyRoutesPath(env);
  if (!onlyRoutesPath) return { mode: 'full', expected: full, touchedCount: null };

  const touched = readTouchedRoutes(onlyRoutesPath);
  const touchedSet = new Set(touched);
  const expected = discoverBuiltRoutes(distDir).filter(
    (route) => touchedSet.has(route) && !UNAUDITED_ROUTES.has(route)
  );
  return { mode: 'content', expected, touchedCount: touched.length };
}

if (require.main === module && process.argv[2] === '--count') {
  const distDir = process.argv[3] || process.env.LH_DIST_DIR || 'dist';
  console.log(resolveAuditPlan({ distDir, env: process.env }).expected.length);
}

module.exports = {
  UNAUDITED_ROUTES,
  NOINDEX_BY_DESIGN,
  NOINDEX_ROUTE_PATTERN,
  SEO_AUDITS_EXCEPT_CRAWLABLE,
  canonicalRoute,
  isNoindexByDesign,
  discoverBuiltRoutes,
  auditableRoutes,
  resolveOnlyRoutesPath,
  readTouchedRoutes,
  resolveAuditPlan,
};
