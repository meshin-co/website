import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { INDEX_ROOT } from '../public/search/index-model.mjs';
import { brandFromDisk } from '../src/utils/brand.mjs';
import { chunkPath, manifestPath, pagePath } from '../src/utils/search-index.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const OPENAPI_VERSION = '3.1.1';

export const OPENAPI_MEDIA_TYPE = `application/vnd.oai.openapi+json;version=${OPENAPI_VERSION.split('.').slice(0, 2).join('.')}`;
const DOCUMENT_VERSION = '1.0.0';
const OUTPUT_FILE = 'openapi.json';

const BUNDLER_OUTPUT_PREFIX = '/_astro/';
const DISCOVERY_DOCUMENTS_PREFIX = '/.well-known/';
const GATE_HARNESS_ARTIFACT = '/gate-routes.json';
const THIS_DOCUMENT = `/${OUTPUT_FILE}`;
const SEARCH_INDEX_VERSION_LENGTH = 10;
const SEARCH_INDEX_IMPLEMENTATION_FILE = new RegExp(`^${INDEX_ROOT}/[0-9a-f]{${SEARCH_INDEX_VERSION_LENGTH}}/`);

const FEED_ROUTE = '/feed.json';
const JSON_MEDIA_TYPE = 'application/json';
const JSON_FEED_MEDIA_TYPE = 'application/feed+json';

const SCHEMAS = {
  JsonFeed: {
    type: 'object',
    required: ['version', 'title', 'home_page_url', 'feed_url', 'items'],
    properties: {
      version: { type: 'string', description: 'URL of the JSON Feed version this document follows.' },
      title: { type: 'string' },
      home_page_url: { type: 'string', format: 'uri' },
      feed_url: { type: 'string', format: 'uri' },
      description: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: [
            'id',
            'url',
            'title',
            'summary',
            'content_text',
            'date_published',
            'date_modified',
            'tags',
            'kind',
          ],
          properties: {
            id: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            title: { type: 'string' },
            summary: { type: 'string' },
            content_text: { type: 'string', description: 'Plain text of the item body.' },
            date_published: { type: 'string', format: 'date-time' },
            date_modified: { type: 'string', format: 'date-time' },
            tags: { type: 'array', items: { type: 'string' } },
            kind: { type: 'string', description: 'Collection the item belongs to.' },
          },
        },
      },
    },
  },
  SearchIndexManifest: {
    type: 'object',
    required: ['version', 'documents', 'pageSize', 'lastKeys', 'kindRuns'],
    properties: {
      version: {
        type: 'string',
        description: `${SEARCH_INDEX_VERSION_LENGTH} hexadecimal characters naming the chunk and page directory.`,
      },
      documents: { type: 'integer', description: 'Number of documents in the index, numbered from 0.' },
      pageSize: { type: 'integer', description: 'Number of documents on every document page but the last.' },
      lastKeys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Last key of each term chunk, ascending. A word is in the first chunk that ends at or after it.',
      },
      kindRuns: {
        type: 'array',
        items: { type: 'array', prefixItems: [{ type: 'integer' }, { type: 'string' }], minItems: 2, maxItems: 2 },
        description:
          'Runs of consecutive documents of one kind, each as the number of its first document and the kind label.',
      },
    },
  },
};

const FEED_DESCRIPTOR = {
  summary: 'JSON Feed of recently modified published items',
  description: 'A JSON Feed 1.1 document. Items are ordered newest first by date_modified.',
  mediaTypes: [JSON_FEED_MEDIA_TYPE, JSON_MEDIA_TYPE],
  schema: 'JsonFeed',
};

const MANIFEST_DESCRIPTION = [
  'Entry point of the partitioned search index.',
  `Term chunks live at ${chunkPath('{version}', '{n}')} and document pages at ${pagePath('{version}', '{n}')}.`,
  'They are implementation files of the site search and are not listed in this document.',
].join(' ');

const MANIFEST_DESCRIPTOR = {
  summary: 'Search index manifest',
  description: MANIFEST_DESCRIPTION,
  mediaTypes: [JSON_MEDIA_TYPE],
  schema: 'SearchIndexManifest',
};

const DESCRIBED_ROUTES = new Map([
  [FEED_ROUTE, FEED_DESCRIPTOR],
  [manifestPath, MANIFEST_DESCRIPTOR],
]);

const plainJsonDescriptor = (route) => ({
  summary: `JSON document at ${route}`,
  description: 'A JSON document.',
  mediaTypes: [JSON_MEDIA_TYPE],
  schema: null,
});

const descriptorFor = (route) => DESCRIBED_ROUTES.get(route) ?? plainJsonDescriptor(route);

const capitalized = (word) => word[0].toUpperCase() + word.slice(1);

const operationIdFor = (route) => {
  const words = route.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return ['get', ...words.map(capitalized)].join('');
};

function pathItemFor(route, { summary, description, mediaTypes, schema }) {
  const body = () => (schema ? { schema: { $ref: `#/components/schemas/${schema}` } } : {});
  return {
    get: {
      summary,
      operationId: operationIdFor(route),
      responses: {
        200: { description, content: Object.fromEntries(mediaTypes.map((type) => [type, body()])) },
      },
    },
  };
}

function assertUniqueOperationIds(paths) {
  const routeByOperationId = new Map();
  for (const [route, { get }] of Object.entries(paths)) {
    const earlier = routeByOperationId.get(get.operationId);
    if (earlier) throw new Error(`gen-openapi: ${earlier} and ${route} both derive operationId ${get.operationId}`);
    routeByOperationId.set(get.operationId, route);
  }
}

export function renderOpenApi({ origin, routes }) {
  const { host } = new URL(origin);
  const described = [...routes].sort().map((route) => [route, descriptorFor(route)]);
  const paths = Object.fromEntries(described.map(([route, descriptor]) => [route, pathItemFor(route, descriptor)]));
  assertUniqueOperationIds(paths);
  const schemaNames = [...new Set(described.map(([, { schema }]) => schema).filter(Boolean))].sort();

  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: host,
      version: DOCUMENT_VERSION,
      description: `Read-only JSON resources that ${host} serves as static files.`,
    },
    servers: [{ url: origin }],
    paths,
    ...(schemaNames.length > 0
      ? {
          components: {
            schemas: Object.fromEntries(schemaNames.map((name) => [name, structuredClone(SCHEMAS[name])])),
          },
        }
      : {}),
  };
}

const routeOf = (distDir, { parentPath, name }) => `/${relative(distDir, join(parentPath, name)).split(sep).join('/')}`;

const isPublicInterface = (route) =>
  route.endsWith('.json') &&
  route !== GATE_HARNESS_ARTIFACT &&
  route !== THIS_DOCUMENT &&
  !route.startsWith(BUNDLER_OUTPUT_PREFIX) &&
  !route.startsWith(DISCOVERY_DOCUMENTS_PREFIX) &&
  !SEARCH_INDEX_IMPLEMENTATION_FILE.test(route);

export async function publicJsonRoutes(distDir) {
  const entries = await readdir(distDir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => routeOf(distDir, entry))
    .filter(isPublicInterface)
    .sort();
}

export async function main(distDir, brand = brandFromDisk()) {
  const routes = await publicJsonRoutes(distDir);
  if (routes.length === 0) throw new Error(`gen-openapi: no public JSON route found under ${distDir}`);

  const document = renderOpenApi({ origin: `https://${brand.name}`, routes });
  await writeFile(join(distDir, OUTPUT_FILE), `${JSON.stringify(document, null, 2)}\n`);
  console.log(`${OUTPUT_FILE} written: ${routes.length} paths`);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main(process.argv[2] ?? 'dist');
}
