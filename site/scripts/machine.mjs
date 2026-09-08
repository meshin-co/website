import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { discoverRoutes } from './gate.mjs';

const NON_PUBLIC = new Set(['faq', 'author', 'speaking']);

export const COLLECTION_BASES = {
  post: 'blog',
  service: 'services',
  resource: 'resources',
  glossary: 'glossary',
  case: 'case-studies',
};

export function publicCollections(configSource) {
  const block = configSource.match(/export const collections = \{([^}]*)\}/s);
  if (!block) throw new Error('machine: no collections export in the content config');

  return [...block[1].matchAll(/^\s*([A-Za-z][\w]*)\s*:/gm)]
    .map(([, name]) => name)
    .filter((name) => !NON_PUBLIC.has(name));
}

export function missingFromGenerator(text, collections) {
  return collections.filter((collection) => !text.includes(`/${COLLECTION_BASES[collection]}/`));
}

export function sidecarGaps(routes, builtFiles) {
  const built = new Set(builtFiles.map((file) => `/${file.replace(/^\//, '')}`));
  const bases = new Set(Object.values(COLLECTION_BASES));

  return routes
    .filter((route) => {
      const parts = route.split('/').filter(Boolean);
      return parts.length === 2 && bases.has(parts[0]);
    })
    .map((route) => `${route}.md`)
    .filter((sidecar) => !built.has(sidecar));
}

async function main(distDir) {
  const collections = publicCollections(await readFile('src/content.config.ts', 'utf8'));
  const routes = await discoverRoutes(distDir);
  const failures = [];

  for (const generator of ['llms.txt', 'llms-full.txt', 'feed.json']) {
    const text = await readFile(join(distDir, generator), 'utf8');
    for (const missing of missingFromGenerator(text, collections)) {
      failures.push(`${generator} covers no ${missing} entry`);
    }
  }

  const sitemap = await readFile(join(distDir, 'sitemap-0.xml'), 'utf8');
  for (const missing of missingFromGenerator(sitemap, collections)) {
    failures.push(`sitemap covers no ${missing} entry`);
  }

  const sidecars = await Promise.all(
    routes.map(async (route) => {
      const candidate = `${route.slice(1)}.md`;
      return readFile(join(distDir, candidate)).then(
        () => candidate,
        () => null
      );
    })
  );

  for (const gap of sidecarGaps(routes, sidecars.filter(Boolean))) failures.push(`no markdown sidecar for ${gap}`);

  console.log(`machine: ${collections.length} public collections, ${routes.length} routes`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`MACHINE ${failure}`);
    process.exitCode = 1;
  }
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist');
}
