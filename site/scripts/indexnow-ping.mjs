import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { diffRoutes, discoverRoutes } from './gate.mjs';
import { brandFromDisk } from '../src/utils/brand.mjs';

const DEFAULT_HOST = brandFromDisk().name;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

export function changedRoutes(before, after) {
  const { added, removed } = diffRoutes(before, after);
  return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

export async function pingIndexNow({ host, key, urls, fetchImpl = fetch }) {
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: urls.map((path) => `https://${host}${path}`),
    }),
  });
  return { ok: response.ok, status: response.status };
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
  const previous = await readRoutes(previousPath);
  const { added, removed, changed } = changedRoutes(previous ?? [], routes);

  if (!changed) return { action: 'skipped', reason: 'unchanged' };
  if (dryRun) return { action: 'dry-run', urls: routes, added, removed };

  const key = await publishedKey(distDir);
  if (!key) return { action: 'skipped', reason: 'missing-key', added, removed };

  if (!(await keyCheck({ host, key }))) {
    return { action: 'skipped', reason: 'key-not-served', added, removed };
  }

  const result = await pingIndexNow({ host, key, urls: routes, fetchImpl });
  if (!result.ok) return { action: 'error', ...result };

  await writeFile(previousPath, `${JSON.stringify(routes, null, 2)}\n`);
  return { action: 'pinged', ...result, added, removed, count: routes.length };
}

async function readRoutes(previousPath) {
  try {
    return JSON.parse(await readFile(previousPath, 'utf8'));
  } catch {
    return null;
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
        `indexnow: dry-run — would ping ${result.urls.length} url(s); added ${result.added.length}, removed ${result.removed.length}`
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

if (import.meta.filename === process.argv[1]) {
  await main(process.argv.slice(2));
}
