import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { diffRoutes, discoverRoutes } from './gate.mjs';
import { brandFromDisk } from '../src/utils/brand.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const DEFAULT_HOST = brandFromDisk().name;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BUILD_HASHED_ASSET = /\/_astro\/[^"'\s)<>,]+/g;
const ASSET_CONTENT_HASH = /\.[A-Za-z0-9_-]{8,}(?=\.[a-z0-9]+$)/;
const SCOPE_HASH = /astro-cid-[a-z0-9]+/g;

export function pageFingerprint(html) {
  const stable = html
    .replace(BUILD_HASHED_ASSET, (asset) => asset.replace(ASSET_CONTENT_HASH, ''))
    .replace(SCOPE_HASH, 'astro-cid');
  return createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

function pageFiles(distDir, route) {
  if (route === '/') return [join(distDir, 'index.html')];
  const path = route.slice(1);
  return [join(distDir, `${path}.html`), join(distDir, path, 'index.html')];
}

async function readPage(distDir, route) {
  const pages = [];
  for (const file of pageFiles(distDir, route)) {
    try {
      pages.push(await readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return pages.join('\n');
}

export async function pageDigests(distDir, routes) {
  const digests = {};
  for (const route of routes) digests[route] = pageFingerprint(await readPage(distDir, route));
  return digests;
}

export function changedRoutes(before, after) {
  const { added, removed } = diffRoutes(Object.keys(before), Object.keys(after));
  const edited = Object.keys(after).filter((route) => route in before && before[route] !== after[route]);
  return { added, removed, edited, changed: added.length + removed.length + edited.length > 0 };
}

export const URLS_PER_REQUEST = 1000;

export async function pingIndexNow({ host, key, urls, fetchImpl = fetch }) {
  let status = 200;
  for (let from = 0; from < urls.length; from += URLS_PER_REQUEST) {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls.slice(from, from + URLS_PER_REQUEST).map((path) => `https://${host}${path}`),
      }),
    });
    status = response.status;
    if (!response.ok) return { ok: false, status };
  }
  return { ok: true, status };
}

const KEY_FILE = /^[A-Za-z0-9-]{8,128}\.txt$/;

export async function publishedKey(distDir) {
  for (const name of await readdir(distDir)) {
    if (!KEY_FILE.test(name)) continue;
    const key = name.slice(0, -4);
    if ((await readFile(join(distDir, name), 'utf8')).trim() === key) return key;
  }
  return null;
}

export async function keyIsServed({ host, key, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(`https://${host}/${key}.txt`);
    if (!response.ok) return false;
    return (await response.text()).trim() === key;
  } catch {
    return false;
  }
}

export async function run({
  distDir,
  previousPath,
  dryRun = false,
  host = DEFAULT_HOST,
  fetchImpl = fetch,
  keyCheck = keyIsServed,
}) {
  const routes = await discoverRoutes(distDir);
  const digests = await pageDigests(distDir, routes);
  const previous = await readAnnounced(previousPath);
  const { added, removed, edited, changed } = changedRoutes(previous, digests);

  if (!changed) return { action: 'skipped', reason: 'unchanged' };

  const announce = [...added, ...edited].sort();
  if (dryRun) return { action: 'dry-run', urls: announce, added, removed, edited };

  if (announce.length === 0) {
    await writeFile(previousPath, `${JSON.stringify(digests, null, 2)}\n`);
    return { action: 'recorded', reason: 'only-removals', added, removed, edited };
  }

  const key = await publishedKey(distDir);
  if (!key) return { action: 'skipped', reason: 'missing-key', added, removed, edited };

  if (!(await keyCheck({ host, key }))) {
    return { action: 'skipped', reason: 'key-not-served', added, removed, edited };
  }

  const result = await pingIndexNow({ host, key, urls: announce, fetchImpl });
  if (!result.ok) return { action: 'error', ...result };

  await writeFile(previousPath, `${JSON.stringify(digests, null, 2)}\n`);
  return { action: 'pinged', ...result, added, removed, edited, count: announce.length };
}

async function readAnnounced(previousPath) {
  try {
    const stored = JSON.parse(await readFile(previousPath, 'utf8'));
    return stored !== null && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

async function main(argv) {
  const previousIndex = argv.indexOf('--previous');
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const result = await run({
    distDir: positional[0] ?? 'dist',
    previousPath: previousIndex === -1 ? '.indexnow-routes.json' : argv[previousIndex + 1],
    dryRun: argv.includes('--dry-run'),
  });

  switch (result.action) {
    case 'skipped':
      console.log(`indexnow: skipped (${result.reason})`);
      break;
    case 'dry-run':
      console.log(
        `indexnow: dry-run — would ping ${result.urls.length} url(s); added ${result.added.length}, removed ${result.removed.length}, edited ${result.edited.length}`
      );
      break;
    case 'error':
      console.error(`indexnow: ping failed with status ${result.status}`);
      process.exitCode = 1;
      break;
    default:
      console.log(`indexnow: pinged ${result.count} url(s), status ${result.status}`);
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv.slice(2));
}
