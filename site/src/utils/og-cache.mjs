import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * @param {{ collection: string, id: string, title: string, updatedDate?: Date | string }} entry
 * @returns {string}
 */
export function ogCacheKey({ collection, id, title, updatedDate }) {
  const date = updatedDate instanceof Date ? updatedDate.toISOString() : (updatedDate ?? '');
  return createHash('sha1')
    .update(JSON.stringify([collection, id, title, date]))
    .digest('hex');
}

export function findOgCacheDir(start = process.cwd()) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, '.git'))) return join(dir, '.og-cache');
    const parent = dirname(dir);
    if (parent === dir) return join(start, '.og-cache');
    dir = parent;
  }
}

export function readOgImage(cacheDir, slug, key) {
  try {
    const manifest = JSON.parse(readFileSync(join(cacheDir, 'manifest.json'), 'utf8'));
    if (manifest[slug] !== key) return null;
    const file = join(cacheDir, `${key}.png`);
    if (!existsSync(file)) return null;
    return readFileSync(file);
  } catch {
    return null;
  }
}

export function writeOgImage(cacheDir, slug, key, png) {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, `${key}.png`), png);
  let manifest = {};
  try {
    manifest = JSON.parse(readFileSync(join(cacheDir, 'manifest.json'), 'utf8'));
  } catch {}
  manifest[slug] = key;
  writeFileSync(join(cacheDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
