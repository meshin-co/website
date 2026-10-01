import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ASSET_REF = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
const LOCAL_ASSET = /^\/[^/].*\.(css|js|mjs)$/;
const META_ROBOTS = /<meta[^>]+name=["']robots["'][^>]*>/i;

export function isNoindex(html) {
  const tag = html.match(META_ROBOTS)?.[0] ?? '';
  return /content=["'][^"']*\bnoindex\b/i.test(tag);
}

export async function discoverRoutes(distDir) {
  const entries = await readdir(distDir, { withFileTypes: true, recursive: true });
  const routes = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => relative(distDir, join(entry.parentPath, entry.name)))
    .map((file) => `/${file.split(sep).join('/')}`)
    .map((route) => route.replace(/\/index\.html$/, '').replace(/\.html$/, ''))
    .map((route) => route || '/');
  return [...new Set(routes)].sort();
}

const DEVELOPMENT_ONLY_ROUTES = new Set(['/styleguide']);

export function lighthouseSet(measured) {
  const byParent = new Map();
  for (const row of measured.filter((row) => !DEVELOPMENT_ONLY_ROUTES.has(row.route))) {
    const parent = row.route === '/' ? '' : row.route.slice(0, row.route.lastIndexOf('/'));
    byParent.set(parent, [...(byParent.get(parent) ?? []), row]);
  }

  const selected = new Set();
  for (const [parent, children] of byParent) {
    const isFamily = parent !== '' && children.length > 1;
    const chosen = isFamily
      ? [children.reduce((heaviest, row) => (row.page > heaviest.page ? row : heaviest))]
      : children;
    for (const row of chosen) selected.add(row.route);
  }
  return [...selected];
}

export function diffRoutes(before, after) {
  const added = after.filter((route) => !before.includes(route));
  const removed = before.filter((route) => !after.includes(route));
  return { added, removed, ok: removed.length === 0 };
}

export function assetsOfPage(html) {
  const assets = new Set();
  for (const [, href] of html.matchAll(ASSET_REF)) {
    if (LOCAL_ASSET.test(href)) assets.add(href);
  }
  return [...assets];
}

export function overBudget(measured, budgets) {
  const { routes = {}, ...defaults } = budgets;
  const limits = { ...defaults, ...(routes[measured.route] ?? {}) };
  return Object.entries(limits)
    .filter(([key, limit]) => measured[key] > limit)
    .map(([key, limit]) => `${measured.route} ${key} ${measured[key]} > ${limit}`);
}

const gzipBytes = (buffer) => gzipSync(buffer, { level: 9 }).length;

async function routeFile(distDir, route) {
  const candidates = route === '/' ? ['index.html'] : [`${route.slice(1)}/index.html`, `${route.slice(1)}.html`];
  for (const candidate of candidates) {
    const path = join(distDir, candidate);
    if (
      await readFile(path).then(
        () => true,
        () => false
      )
    )
      return path;
  }
  throw new Error(`gate: no built html for route ${route}`);
}

export async function fontBytes(distDir) {
  const dir = join(distDir, '_astro', 'fonts');
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter((entry) => entry.isFile() && /\.woff2?$/.test(entry.name));
  const sizes = await Promise.all(files.map((entry) => stat(join(dir, entry.name)).then(({ size }) => size)));
  return sizes.reduce((total, size) => total + size, 0);
}

export async function measureRoute(distDir, route, fonts) {
  const html = await readFile(await routeFile(distDir, route), 'utf8');
  let js = 0;
  let css = 0;
  for (const asset of assetsOfPage(html)) {
    const bytes = gzipBytes(await readFile(join(distDir, asset.slice(1))));
    if (asset.endsWith('.css')) css += bytes;
    else js += bytes;
  }
  return {
    route,
    js,
    css,
    page: gzipBytes(Buffer.from(html)) + js + css,
    fonts: fonts ?? (await fontBytes(distDir)),
    noindex: isNoindex(html),
  };
}

export async function main(distDir, budgetPath) {
  const budgets = JSON.parse(await readFile(budgetPath, 'utf8'));
  const routes = await discoverRoutes(distDir);
  const fonts = await fontBytes(distDir);
  const measured = [];
  for (const route of routes) measured.push(await measureRoute(distDir, route, fonts));

  const findings = measured.flatMap((row) => overBudget(row, budgets));
  if (budgets.fonts !== undefined && fonts === 0) {
    findings.push(`fonts measured 0 bytes in ${distDir}/_astro/fonts, so the fonts budget proved nothing`);
  }
  await writeFile(
    join(distDir, 'gate-routes.json'),
    `${JSON.stringify({ routes, measured, lighthouseRoutes: lighthouseSet(measured), overBudget: findings }, null, 2)}\n`
  );

  for (const row of measured)
    console.log(`${row.route} js=${row.js} css=${row.css} page=${row.page} fonts=${row.fonts}`);
  if (findings.length > 0) {
    for (const finding of findings) console.error(`OVER BUDGET ${finding}`);
    process.exitCode = 1;
  }
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist', process.argv[3] ?? 'budgets.json');
}
