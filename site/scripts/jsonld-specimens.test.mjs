import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';

import { brandFromDisk } from '../src/utils/brand.mjs';
import {
  breadcrumbNode,
  graph,
  orgNode,
  personNode,
  profilePageNode,
  webPageNode,
  websiteNode,
} from '../src/utils/jsonld.mjs';
import { jsonldSpecimens } from './jsonld-specimens.mjs';
import { FAMILIES } from './mutation-smoke.mjs';
import { SPECIMENS, proveWithSpecimen } from './mutation-specimens.mjs';

const exec = promisify(execFile);
const REAL_GATE = join(import.meta.dirname, 'jsonld-gate.mjs');
const ORIGIN = `https://${brandFromDisk().name}`;
const GATE = 'gate:jsonld';
const DATE = '2026-01-01T00:00:00.000Z';
const NAMES = [
  'jsonldBreadcrumbsInASecondScript',
  'jsonldGateThatReadNothing',
  'jsonldIdDeclaredTwice',
  'jsonldNodeWithoutId',
  'jsonldReferenceResolvesNowhere',
  'jsonldRouteWithoutAGraph',
];
const PAGES = ['about.html', 'now.html', '404.html', 'search.html', 'styleguide.html'];

const scenes = [];
afterEach(async () => {
  for (const scene of scenes.splice(0)) await rm(scene, { recursive: true, force: true });
});

const run = async (command, args, cwd) => {
  try {
    const { stdout, stderr } = await exec(command, args, { cwd });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code, output: `${error.stdout}${error.stderr}` };
  }
};

const pageOf = (nodes) =>
  `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(graph(nodes))}</script></head><body></body></html>`;

const crumbs = (name, path) => [
  { name: 'Home', path: '/' },
  { name, path },
];
const shared = () => [orgNode(ORIGIN), personNode(ORIGIN), websiteNode(ORIGIN)];

const aboutPage = () =>
  pageOf([...shared(), profilePageNode(ORIGIN, DATE), breadcrumbNode(ORIGIN, crumbs('About', '/about'))]);
const nowPage = () =>
  pageOf([...shared(), webPageNode(ORIGIN, '/now', DATE, 'Now'), breadcrumbNode(ORIGIN, crumbs('Now', '/now'))]);
const graphlessPage = '<!doctype html><html><head><meta name="robots" content="noindex"></head><body></body></html>';

async function world(gateCommand) {
  const site = await mkdtemp(join(tmpdir(), 'jsonld-specimens-'));
  scenes.push(site);
  await mkdir(join(site, 'dist'));
  await writeFile(join(site, 'dist/about.html'), aboutPage());
  await writeFile(join(site, 'dist/now.html'), nowPage());
  for (const exempt of ['404', 'search', 'styleguide'])
    await writeFile(join(site, `dist/${exempt}.html`), graphlessPage);
  const command = gateCommand ?? `node ${REAL_GATE} dist`;
  await writeFile(join(site, 'package.json'), JSON.stringify({ scripts: { [GATE]: command } }));
  return site;
}

const snapshot = async (site) => {
  const files = await readdir(join(site, 'dist'));
  return Promise.all(files.sort().map(async (file) => [file, await readFile(join(site, 'dist', file), 'utf8')]));
};

test('the module names the six ways the one-graph rule breaks, and the smoke spreads them', () => {
  assert.deepEqual(Object.keys(jsonldSpecimens({})).sort(), NAMES);
  for (const name of NAMES) assert.equal(Object.hasOwn(SPECIMENS, name), true, name);
});

test('every specimen runs gate:jsonld and names the finding it expects', () => {
  for (const name of NAMES) {
    assert.equal(SPECIMENS[name].gate, GATE, name);
    assert.match(SPECIMENS[name].token, /^JSONLD \S+/, name);
    assert.equal(typeof SPECIMENS[name].plant, 'function', name);
  }
});

test('the smoke manifest holds one specimen family per specimen, in the order the module lists them', () => {
  const named = FAMILIES.filter((entry) => entry.kind === 'specimen' && NAMES.includes(entry.specimen));
  assert.deepEqual(
    named.map((entry) => entry.id),
    [
      'jsonld-breadcrumbs-in-a-second-script',
      'jsonld-node-without-an-id',
      'jsonld-id-declared-twice',
      'jsonld-reference-resolves-nowhere',
      'jsonld-route-without-a-graph',
      'jsonld-gate-that-read-nothing',
    ]
  );
  const ids = FAMILIES.map((entry) => entry.id);
  assert.equal(ids[ids.indexOf('jsonld-property-completeness') + 1], 'jsonld-breadcrumbs-in-a-second-script');
});

test('the pristine world is green for the real gate, graph-less exempt pages included', async () => {
  const site = await world();
  for (const page of PAGES) assert.ok((await readdir(join(site, 'dist'))).includes(page), page);

  const green = await run('npm', ['run', GATE], site);

  assert.equal(green.code, 0, green.output);
});

for (const name of NAMES) {
  test(`${name} turns gate:jsonld red and the restore turns it green again`, async () => {
    const site = await world();
    const before = await snapshot(site);
    const green = await run('npm', ['run', GATE], site);
    assert.equal(green.code, 0, green.output);

    const restore = await SPECIMENS[name].plant(site);
    const planted = await run('npm', ['run', GATE], site);
    await restore();

    assert.notEqual(planted.code, 0, planted.output);
    assert.ok(planted.output.includes(SPECIMENS[name].token), planted.output);
    assert.deepEqual(await snapshot(site), before);
    assert.equal((await run('npm', ['run', GATE], site)).code, 0);
  });

  test(`${name} is proven by the smoke's own procedure`, async () => {
    const site = await world();

    const result = await proveWithSpecimen(SPECIMENS[name], { copySite: site, run });

    assert.equal(result.ok, true, result.reason);
  });

  test(`a gate:jsonld that stays green turns the ${name} family red, so the family is load-bearing`, async () => {
    const site = await world('node -e 0');

    const result = await proveWithSpecimen(SPECIMENS[name], { copySite: site, run });

    assert.equal(result.ok, false);
    assert.match(result.reason, /stayed green on the specimen/);
  });
}

test('a specimen whose anchor is missing throws instead of planting nothing', async () => {
  const site = await world();
  await writeFile(join(site, 'dist/about.html'), graphlessPage);
  await writeFile(join(site, 'dist/now.html'), graphlessPage);

  for (const name of NAMES.filter((candidate) => candidate !== 'jsonldGateThatReadNothing')) {
    await assert.rejects(async () => SPECIMENS[name].plant(site), name);
  }
});

test('the second-script specimen moves the breadcrumb into its own script right after the first', async () => {
  const site = await world();

  const restore = await SPECIMENS.jsonldBreadcrumbsInASecondScript.plant(site);
  const planted = await readFile(join(site, 'dist/about.html'), 'utf8');
  await restore();

  const scripts = [...planted.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, body]) =>
    JSON.parse(body)
  );
  assert.equal(scripts.length, 2);
  assert.deepEqual(
    scripts[1]['@graph'].map((node) => node['@type']),
    ['BreadcrumbList']
  );
  assert.equal(scripts[1]['@context'], scripts[0]['@context']);
  assert.equal(
    scripts[0]['@graph'].some((node) => node['@type'] === 'BreadcrumbList'),
    false
  );
  assert.match(planted, /<\/script><script type="application\/ld\+json">/);
});

test('the empty-dist specimen leaves an empty directory while planted and the real one back after', async () => {
  const site = await world();

  const restore = await SPECIMENS.jsonldGateThatReadNothing.plant(site);
  const planted = await readdir(join(site, 'dist'));
  await restore();

  assert.deepEqual(planted, []);
  assert.ok((await readdir(join(site, 'dist'))).includes('about.html'));
});
