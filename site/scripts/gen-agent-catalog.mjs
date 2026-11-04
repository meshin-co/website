import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { LLMS_COLLECTIONS } from '../src/utils/llms-collections.mjs';
import { manifestPath } from '../src/utils/search-index.mjs';
import { OPENAPI_MEDIA_TYPE } from './gen-openapi.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const SITE_ORIGIN = `https://${brandFromDisk().name}`;

const ARD_SPEC_VERSION = '1.0';
const LLMS_TXT_PATH = '/llms.txt';
const SERVICE_DOC_PATH = LLMS_TXT_PATH;
const OPENAPI_PATH = '/openapi.json';
const API_CATALOG_PATH = '/.well-known/api-catalog';
const AI_CATALOG_PATH = '/.well-known/ai-catalog.json';

const LINKSET_MEDIA_TYPE = 'application/linkset+json';
const TEXT_MEDIA_TYPE = 'text/plain';
const JSON_MEDIA_TYPE = 'application/json';

const SINGLE_FILE_ENTRIES = [
  {
    path: LLMS_TXT_PATH,
    namespace: 'llms',
    name: 'index',
    displayName: 'LLM index',
    type: TEXT_MEDIA_TYPE,
    description: 'Plain-text map of the site for language models: offers, pages, hubs, full-text files and feeds.',
  },
  {
    path: '/llms-full.txt',
    namespace: 'llms',
    name: 'full',
    displayName: 'Full text index',
    type: TEXT_MEDIA_TYPE,
    description:
      'Index of the full-text collection files: one line per collection with its entry count, no entry text.',
  },
  {
    path: OPENAPI_PATH,
    namespace: 'api',
    name: 'openapi',
    displayName: 'OpenAPI description',
    type: OPENAPI_MEDIA_TYPE,
    description: 'OpenAPI 3.1 description of the JSON resources this site serves.',
  },
  {
    path: API_CATALOG_PATH,
    namespace: 'api',
    name: 'catalog',
    displayName: 'API catalog',
    type: LINKSET_MEDIA_TYPE,
    description: 'RFC 9727 API catalog that links the OpenAPI description to its documentation.',
  },
  {
    path: '/sitemap-index.xml',
    namespace: 'sitemap',
    name: 'index',
    displayName: 'Sitemap index',
    type: 'application/xml',
    description: 'Sitemap index listing the XML sitemaps that cover every indexable page.',
  },
  {
    path: '/feed.json',
    namespace: 'feed',
    name: 'json',
    displayName: 'JSON Feed',
    type: 'application/feed+json',
    description: 'JSON Feed 1.1 of the newest entries across all collections, full text included.',
  },
  {
    path: manifestPath,
    namespace: 'search',
    name: 'manifest',
    displayName: 'Search index manifest',
    type: JSON_MEDIA_TYPE,
    description:
      'Entry point of the partitioned search index: its version, document count, page size and the last key of each term chunk. Term chunks and document pages are implementation files fetched by version and are not listed.',
  },
];

const COLLECTION_ENTRIES = LLMS_COLLECTIONS.map(({ name, title, file }) => ({
  path: file,
  namespace: 'llms',
  name,
  displayName: `Full text: ${title}`,
  type: TEXT_MEDIA_TYPE,
  description: `Full body text of every live entry in ${title.toLowerCase()}. A collection over its entry cap is an index of numbered shard files.`,
}));

const MACHINE_ENTRY_POINTS = [...SINGLE_FILE_ENTRIES, ...COLLECTION_ENTRIES];

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const urlOf = (origin, path) => new URL(path, origin).href;
const serialize = (document) => `${JSON.stringify(document, null, 2)}\n`;
const isFile = (path) =>
  stat(path).then(
    (info) => info.isFile(),
    () => false
  );

export function renderApiCatalog({ origin }) {
  return {
    linkset: [
      {
        anchor: origin,
        'service-desc': [{ href: urlOf(origin, OPENAPI_PATH), type: OPENAPI_MEDIA_TYPE }],
        'service-doc': [{ href: urlOf(origin, SERVICE_DOC_PATH), type: TEXT_MEDIA_TYPE }],
      },
    ],
  };
}

export function renderAiCatalog({ origin, entries }) {
  const { hostname } = new URL(origin);
  return {
    specVersion: ARD_SPEC_VERSION,
    host: { displayName: hostname },
    entries: entries
      .map(({ path, namespace, name, displayName, type, description }) => ({
        identifier: `urn:air:${hostname}:${namespace}:${name}`,
        displayName,
        type,
        url: urlOf(origin, path),
        description,
      }))
      .sort((a, b) => compare(a.identifier, b.identifier)),
  };
}

export async function discoverEntries(distDir) {
  const shipped = await Promise.all(MACHINE_ENTRY_POINTS.map(({ path }) => isFile(join(distDir, path))));
  return MACHINE_ENTRY_POINTS.filter((_, index) => shipped[index]);
}

async function writeManifest(distDir, path, document) {
  const file = join(distDir, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, serialize(document));
}

export async function main(distDir) {
  await writeManifest(distDir, API_CATALOG_PATH, renderApiCatalog({ origin: SITE_ORIGIN }));
  const entries = await discoverEntries(distDir);
  await writeManifest(distDir, AI_CATALOG_PATH, renderAiCatalog({ origin: SITE_ORIGIN, entries }));
  console.log(`${API_CATALOG_PATH} and ${AI_CATALOG_PATH} written: ${entries.length} capability entries`);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2] ?? 'dist');
}
