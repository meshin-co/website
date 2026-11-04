import { open, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { FEED_BASES } from '../src/utils/feeds.mjs';
import { EMPTY_COLLECTIONS, ROUTE_EXCEPTIONS } from '../src/utils/route-exceptions.mjs';
import { INDEX_DOCUMENT_FILE } from './collection-gate.mjs';
import { discoverRoutes } from './gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { BOUNDED_INLINE_COLLECTIONS, publicCollections, sitemapLastmods } from './machine.mjs';
import { parityLines, routeParity } from './route-parity.mjs';

const PNG_HEAD_BYTES = 24;
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const NOINDEX_FLAG = /^noindex:\s*true\s*$/m;
const ENTRY_FILE = /\.mdx?$/;

const missingIsEmpty = (error) => (error.code === 'ENOENT' ? [] : Promise.reject(error));

const slashed = (path) => path.split('\\').join('/');

async function readFiles(distDir, names) {
  const texts = {};
  for (const name of names) texts[name] = await readFile(join(distDir, name), 'utf8').catch(() => undefined);
  return Object.fromEntries(Object.entries(texts).filter(([, text]) => text !== undefined));
}

async function pngHead(file) {
  const handle = await open(file, 'r');
  try {
    const head = new Uint8Array(PNG_HEAD_BYTES);
    const { bytesRead } = await handle.read(head, 0, PNG_HEAD_BYTES, 0);
    return bytesRead === PNG_HEAD_BYTES ? head : head.slice(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function frontmatterNoindexRoutes(collections) {
  const routes = new Set();
  for (const { kind, base } of collections) {
    const files = await readdir(join('src', 'data', kind)).catch(missingIsEmpty);
    for (const file of files.filter((name) => ENTRY_FILE.test(name))) {
      const source = await readFile(join('src', 'data', kind, file), 'utf8');
      if (NOINDEX_FLAG.test(FRONTMATTER.exec(source)?.[1] ?? ''))
        routes.add('/' + base + '/' + file.replace(ENTRY_FILE, ''));
    }
  }
  return routes;
}

export async function readWorld(distDir) {
  const site = 'https://' + brandFromDisk().name;
  const kinds = publicCollections(await readFile('src/content.config.ts', 'utf8'));
  const collections = kinds.map((kind) => ({ kind, base: FEED_BASES[kind] }));
  const routes = await discoverRoutes(distDir);
  const entries = await readdir(distDir, { withFileTypes: true, recursive: true });
  const shipped = entries
    .filter((entry) => entry.isFile())
    .map((entry) => slashed(join(entry.parentPath, entry.name).slice(distDir.length + 1)));

  const htmlByRoute = {};
  for (const route of routes) {
    htmlByRoute[route] = await readFile(join(distDir, route === '/' ? 'index.html' : route.slice(1) + '.html'), 'utf8');
  }
  const named = [
    'sitemap-0.xml',
    'llms.txt',
    'rss.xml',
    ...collections.map(({ base }) => base + '/rss.xml'),
    ...shipped.filter((file) => /^llms\/[^/]+\.txt$/.test(file) || INDEX_DOCUMENT_FILE.test(file)),
  ];
  const texts = await readFiles(distDir, [...new Set(named)]);
  const imageHeads = {};
  for (const file of shipped.filter((name) => name.endsWith('.png')))
    imageHeads[file] = await pngHead(join(distDir, file));

  return {
    site,
    routes,
    htmlByRoute,
    collections,
    texts,
    shipped,
    imageHeads,
    sitemapLastmods: sitemapLastmods(texts['sitemap-0.xml'] ?? ''),
    inlineKinds: BOUNDED_INLINE_COLLECTIONS,
    declared: {
      exceptions: ROUTE_EXCEPTIONS,
      emptyCollections: EMPTY_COLLECTIONS,
      noindexRoutes: await frontmatterNoindexRoutes(collections),
    },
  };
}

async function main(distDir) {
  const { findings, ledger } = routeParity(await readWorld(distDir));
  for (const line of parityLines(ledger)) console.log(line);
  for (const { text } of findings) console.error('PARITY ' + text);
  if (findings.length > 0) process.exitCode = 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2] ?? 'dist');
}
