import { gzipSync } from 'node:zlib';
import { readdir, readFile, writeFile } from 'node:fs/promises';
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

export async function measureRoute(distDir, route) {
  const html = await readFile(await routeFile(distDir, route), 'utf8');
  let js = 0;
  let css = 0;
  for (const asset of assetsOfPage(html)) {
    const bytes = gzipBytes(await readFile(join(distDir, asset.slice(1))));
    if (asset.endsWith('.css')) css += bytes;
    else js += bytes;
  }
  return { route, js, css, page: gzipBytes(Buffer.from(html)) + js + css, noindex: isNoindex(html) };
}

async function main(distDir, budgetPath) {
  const budgets = JSON.parse(await readFile(budgetPath, 'utf8'));
  const routes = await discoverRoutes(distDir);
  const measured = [];
  for (const route of routes) measured.push(await measureRoute(distDir, route));

  const findings = measured.flatMap((row) => overBudget(row, budgets));
  await writeFile(join(distDir, 'gate-routes.json'), `${JSON.stringify({ routes, measured }, null, 2)}\n`);

  for (const row of measured) console.log(`${row.route} js=${row.js} css=${row.css} page=${row.page}`);
  if (findings.length > 0) {
    for (const finding of findings) console.error(`OVER BUDGET ${finding}`);
    process.exitCode = 1;
  }
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist', process.argv[3] ?? 'budgets.json');
}
