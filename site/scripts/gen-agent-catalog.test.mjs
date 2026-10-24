import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { KINDS, shardHref } from '../public/search/shards.mjs';
import { brandFromDisk } from '../src/utils/brand.mjs';
import { LLMS_COLLECTIONS } from '../src/utils/llms-collections.mjs';
import { discoverEntries, main, renderAiCatalog, renderApiCatalog } from './gen-agent-catalog.mjs';

const SITE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = fileURLToPath(new URL('./gen-agent-catalog.mjs', import.meta.url));
const BUILD_ORIGIN = `https://${brandFromDisk(join(SITE_ROOT, 'src', 'config.yaml')).name}`;
const ORIGIN = 'https://catalog.example';
const OPENAPI_TYPE = 'application/vnd.oai.openapi+json;version=3.1';
const API_CATALOG = '/.well-known/api-catalog';
const AI_CATALOG = '/.well-known/ai-catalog.json';

const ENTRY_POINTS = [
  API_CATALOG,
  '/feed.json',
  '/llms-full.txt',
  '/llms.txt',
  '/llms/faq.txt',
  '/llms/post.txt',
  '/openapi.json',
  '/search-index-faq.json',
  '/search-index-post.json',
  '/sitemap-index.xml',
];

const NOT_ENTRY_POINTS = [
  '/.well-known/security.txt',
  '/_headers',
  '/about.md',
  '/gate-routes.json',
  '/index.html',
  '/llms/post-1.txt',
  '/robots.txt',
  '/rss.xml',
  '/search-index-unlisted.json',
  '/sitemap-0.xml',
];

const BUILT_BEFORE_THE_SCRIPT = [...ENTRY_POINTS.filter((path) => path !== API_CATALOG), ...NOT_ENTRY_POINTS];

function bodyFor(path) {
  if (path.endsWith('.json') || path === API_CATALOG) return '[]';
  if (path.endsWith('.xml')) return '<sitemapindex/>';
  return '# fixture\n';
}

async function fixtureDist(paths) {
  const dist = await mkdtemp(join(tmpdir(), 'agent-catalog-'));
  for (const path of paths) {
    await mkdir(dirname(join(dist, path)), { recursive: true });
    await writeFile(join(dist, path), bodyFor(path));
  }
  return dist;
}

async function withDist(paths, run) {
  const dist = await fixtureDist(paths);
  try {
    return await run(dist);
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
}

const quiet = (t) => t.mock.method(console, 'log', () => {});
const readText = (dist, path) => readFile(join(dist, path), 'utf8');
const readJson = async (dist, path) => JSON.parse(await readText(dist, path));
const isFile = (path) =>
  stat(path).then(
    (info) => info.isFile(),
    () => false
  );
const pathsOf = (entries) => entries.map(({ path }) => path);
const entryUrls = ({ entries }) => entries.map(({ url }) => url);
const linkHrefs = ({ linkset }) =>
  linkset.flatMap((context) =>
    Object.values(context)
      .filter(Array.isArray)
      .flatMap((links) => links.map(({ href }) => href))
  );
const manifestsOf = async (dist) => [await readText(dist, API_CATALOG), await readText(dist, AI_CATALOG)];
const catalogOf = async (dist) => renderAiCatalog({ origin: ORIGIN, entries: await discoverEntries(dist) });

test('the api catalog anchors at the origin it is handed and links the OpenAPI description and a documentation page', () => {
  for (const origin of [ORIGIN, 'https://other.example']) {
    const { linkset } = renderApiCatalog({ origin });

    assert.equal(linkset.length, 1);
    const [context] = linkset;
    assert.deepEqual(Object.keys(context), ['anchor', 'service-desc', 'service-doc']);
    assert.equal(context.anchor, origin);
    assert.deepEqual(context['service-desc'], [{ href: `${origin}/openapi.json`, type: OPENAPI_TYPE }]);
    assert.deepEqual(context['service-doc'], [{ href: `${origin}/llms.txt`, type: 'text/plain' }]);
  }
});

test('discovery lists the machine entry points the tree holds and no other file', async () => {
  await withDist([...ENTRY_POINTS, ...NOT_ENTRY_POINTS], async (dist) => {
    assert.deepEqual(pathsOf(await discoverEntries(dist)).sort(), [...ENTRY_POINTS].sort());
  });
});

test('removing any one shipped file removes its entry and no other', async () => {
  await withDist(ENTRY_POINTS, async (dist) => {
    for (const path of ENTRY_POINTS) {
      await rm(join(dist, path));
      const expected = ENTRY_POINTS.filter((other) => other !== path).sort();

      assert.deepEqual(pathsOf(await discoverEntries(dist)).sort(), expected, `after removing ${path}`);
      await writeFile(join(dist, path), bodyFor(path));
    }
  });
});

test('a collection file or search shard the build names but the tree lacks never reaches the manifest', async () => {
  const named = [...LLMS_COLLECTIONS.map(({ file }) => file), ...Object.keys(KINDS).map((kind) => shardHref(kind))];
  const absent = named.filter((path) => !ENTRY_POINTS.includes(path));
  const present = named.filter((path) => ENTRY_POINTS.includes(path));
  assert.ok(absent.length > 0 && present.length > 0, 'the tree must hold some build-named files and miss others');

  await withDist(ENTRY_POINTS, async (dist) => {
    const text = JSON.stringify(await catalogOf(dist));

    for (const path of absent) assert.ok(!text.includes(path), `${path} is not in the tree, yet the manifest names it`);
    for (const path of present) assert.ok(text.includes(path), `${path} is in the tree, yet the manifest omits it`);
  });
});

test('a search shard that ships empty is still listed, because the manifest follows the files and not their content', async () => {
  await withDist(['/search-index-case.json'], async (dist) => {
    assert.equal(await readText(dist, '/search-index-case.json'), '[]');
    assert.deepEqual(pathsOf(await discoverEntries(dist)), ['/search-index-case.json']);
  });
});

test('a tree with no machine files yields a manifest with no entries and no placeholder', async () => {
  await withDist(['/index.html', '/robots.txt'], async (dist) => {
    assert.deepEqual((await catalogOf(dist)).entries, []);
  });
});

test('the capability manifest carries the spec version, a host name and entries holding only what the spec asks for and a description', async () => {
  await withDist(ENTRY_POINTS, async (dist) => {
    const catalog = await catalogOf(dist);

    assert.deepEqual(Object.keys(catalog), ['specVersion', 'host', 'entries']);
    assert.equal(catalog.specVersion, '1.0');
    assert.deepEqual(catalog.host, { displayName: 'catalog.example' });
    assert.equal(catalog.entries.length, ENTRY_POINTS.length);
    for (const entry of catalog.entries) {
      assert.deepEqual(Object.keys(entry), ['identifier', 'displayName', 'type', 'url', 'description']);
      assert.match(entry.identifier, /^urn:air:catalog\.example:[a-z0-9-]+:[a-z0-9-]+$/);
      assert.match(entry.type, /^[a-z]+\/[a-z0-9.+-]+(?:;version=[0-9.]+)?$/);
      assert.ok(entry.displayName.length > 0 && entry.description.length > 0);
    }
    const identifiers = catalog.entries.map(({ identifier }) => identifier);
    assert.equal(new Set(identifiers).size, identifiers.length);
  });
});

test('each entry names the media type its file is served with, and the OpenAPI entry agrees with the api catalog', async () => {
  await withDist(ENTRY_POINTS, async (dist) => {
    const { entries } = await catalogOf(dist);
    const typeOf = (path) => entries.find(({ url }) => url === `${ORIGIN}${path}`).type;

    assert.equal(typeOf('/openapi.json'), OPENAPI_TYPE);
    assert.equal(typeOf('/openapi.json'), renderApiCatalog({ origin: ORIGIN }).linkset[0]['service-desc'][0].type);
    assert.equal(typeOf(API_CATALOG), 'application/linkset+json');
    assert.equal(typeOf('/feed.json'), 'application/feed+json');
    assert.equal(typeOf('/sitemap-index.xml'), 'application/xml');
    assert.equal(typeOf('/search-index-faq.json'), 'application/json');
    for (const path of ['/llms.txt', '/llms-full.txt', '/llms/faq.txt']) assert.equal(typeOf(path), 'text/plain');
  });
});

test('entries sort by identifier whatever order discovery hands them over', async () => {
  await withDist(ENTRY_POINTS, async (dist) => {
    const entries = await discoverEntries(dist);
    const forward = renderAiCatalog({ origin: ORIGIN, entries });
    const backward = renderAiCatalog({ origin: ORIGIN, entries: [...entries].reverse() });
    const identifiers = forward.entries.map(({ identifier }) => identifier);

    assert.equal(JSON.stringify(backward), JSON.stringify(forward));
    assert.deepEqual(identifiers, [...identifiers].sort());
  });
});

test('main writes both manifests into a tree that has no .well-known directory yet', async (t) => {
  quiet(t);
  await withDist(['/llms.txt', '/openapi.json'], async (dist) => {
    assert.ok(!(await readdir(dist)).includes('.well-known'));

    await main(dist);

    assert.deepEqual((await readdir(join(dist, '.well-known'))).sort(), ['ai-catalog.json', 'api-catalog']);
  });
});

test('every URL in both manifests is absolute, shares the site origin and names a file in the tree', async (t) => {
  quiet(t);
  await withDist(BUILT_BEFORE_THE_SCRIPT, async (dist) => {
    await main(dist);
    const apiCatalog = await readJson(dist, API_CATALOG);
    const aiCatalog = await readJson(dist, AI_CATALOG);
    const urls = [...linkHrefs(apiCatalog), ...entryUrls(aiCatalog)];

    assert.equal(apiCatalog.linkset[0].anchor, BUILD_ORIGIN);
    assert.equal(urls.length, 2 + ENTRY_POINTS.length);
    for (const url of urls) {
      const { origin, pathname } = new URL(url);
      assert.equal(origin, BUILD_ORIGIN, url);
      assert.ok(await isFile(join(dist, pathname)), `${url} names no file in the tree`);
    }
  });
});

test('files that are not public machine entry points never reach either manifest', async (t) => {
  quiet(t);
  await withDist(BUILT_BEFORE_THE_SCRIPT, async (dist) => {
    await main(dist);
    const text = (await manifestsOf(dist)).join('\n');

    for (const path of NOT_ENTRY_POINTS) assert.ok(!text.includes(path), `${path} leaked into a manifest`);
  });
});

test('the capability manifest lists the api catalog the same run wrote and never lists itself', async (t) => {
  quiet(t);
  await withDist(BUILT_BEFORE_THE_SCRIPT, async (dist) => {
    await main(dist);
    await main(dist);
    const urls = entryUrls(await readJson(dist, AI_CATALOG));

    assert.ok(urls.includes(`${BUILD_ORIGIN}${API_CATALOG}`));
    assert.ok(!urls.includes(`${BUILD_ORIGIN}${AI_CATALOG}`));
  });
});

test('runs over the same files write byte-identical manifests, on one tree and on two', async (t) => {
  quiet(t);
  const snapshots = [];
  for (let tree = 0; tree < 2; tree += 1) {
    await withDist(BUILT_BEFORE_THE_SCRIPT, async (dist) => {
      await main(dist);
      snapshots.push(await manifestsOf(dist));
      await main(dist);
      snapshots.push(await manifestsOf(dist));
    });
  }

  assert.equal(snapshots.length, 4);
  for (const snapshot of snapshots) assert.deepEqual(snapshot, snapshots[0]);
});

test('both manifests are plain JSON: parse and stringify give back the same document and the same bytes', async (t) => {
  quiet(t);
  await withDist(BUILT_BEFORE_THE_SCRIPT, async (dist) => {
    await main(dist);

    for (const path of [API_CATALOG, AI_CATALOG]) {
      const text = await readText(dist, path);
      assert.equal(`${JSON.stringify(JSON.parse(text), null, 2)}\n`, text);
    }
  });
  const catalogs = [renderApiCatalog({ origin: ORIGIN }), await withDist(ENTRY_POINTS, catalogOf)];

  for (const catalog of catalogs) assert.deepEqual(JSON.parse(JSON.stringify(catalog)), catalog);
});

test('the command line entry writes both manifests for the site origin', async () => {
  await withDist(BUILT_BEFORE_THE_SCRIPT, async (dist) => {
    const run = spawnSync(process.execPath, [SCRIPT, dist], { cwd: SITE_ROOT, encoding: 'utf8' });

    assert.equal(run.status, 0, run.stderr);
    assert.equal((await readJson(dist, API_CATALOG)).linkset[0].anchor, BUILD_ORIGIN);
    assert.equal((await readJson(dist, AI_CATALOG)).entries.length, ENTRY_POINTS.length);
  });
});
