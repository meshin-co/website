import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  agentInterfaceFindings,
  contentSignalGaps,
  directiveTarget,
  headLinkGaps,
  linkHeaderGaps,
  linksetShapeGaps,
  linksetTargets,
  manifestEntryGaps,
  openApiCoverageGaps,
  shippedGaps,
} from './agent-interfaces-gate.mjs';

const ORIGIN = 'https://example.com';
const SIGNAL = 'Content-Signal: search=yes, ai-train=yes, ai-input=yes';

const robots = (groups = ['*', 'GPTBot']) =>
  [
    ...groups.map((agent) => `User-agent: ${agent}\n${SIGNAL}\nAllow: /\nDisallow: /search`),
    `Sitemap: ${ORIGIN}/sitemap-index.xml`,
    `Agentmap: ${ORIGIN}/.well-known/ai-catalog.json`,
  ].join('\n\n');

const headers = (
  home = `/\n  Link: </.well-known/api-catalog>; rel="api-catalog"\n  Link: </openapi.json>; rel="service-desc"\n  Link: </llms.txt>; rel="describedby"`
) => [`/*\n  X-Frame-Options: DENY`, home, `/feed.json\n  X-Robots-Tag: noindex`].join('\n\n');

const manifest = (urls = ['/llms.txt', '/feed.json']) => ({
  entries: urls.map((url, index) => ({ identifier: `urn:air:example.com:machine:${index}`, url: `${ORIGIN}${url}` })),
});

const catalog = {
  linkset: [
    {
      anchor: ORIGIN,
      'service-desc': [{ href: `${ORIGIN}/openapi.json` }],
      'service-doc': [{ href: `${ORIGIN}/llms.txt` }],
    },
  ],
};

test('every user-agent group states all three signals', () => {
  assert.deepEqual(contentSignalGaps(robots()), []);
});

test('a group added without the directive is named', () => {
  const withSilentGroup = `${robots()}\n\nUser-agent: NewBot\nAllow: /`;

  assert.deepEqual(contentSignalGaps(withSilentGroup), ['robots.txt: the group for NewBot declares no Content-Signal']);
});

test('a signal left out of the directive is named', () => {
  const partial = robots().replaceAll(SIGNAL, 'Content-Signal: search=yes, ai-train=yes');

  assert.deepEqual(contentSignalGaps(partial), [
    'robots.txt: the group for * leaves ai-input unsaid',
    'robots.txt: the group for GPTBot leaves ai-input unsaid',
  ]);
});

test('a signal declared twice for one agent is ambiguous and fails', () => {
  const twice = robots().replaceAll(SIGNAL, `${SIGNAL}\nContent-Signal: search=no, ai-train=no, ai-input=no`);

  assert.equal(contentSignalGaps(twice).length, 2);
});

test('the directives resolve to the path a crawler would fetch', () => {
  assert.equal(directiveTarget(robots(), 'Agentmap'), '/.well-known/ai-catalog.json');
  assert.equal(directiveTarget(robots(), 'Sitemap'), '/sitemap-index.xml');
  assert.equal(directiveTarget(robots(), 'Humansmap'), undefined);
});

test('a named route that the build does not ship is a finding', () => {
  assert.deepEqual(shippedGaps('robots.txt', ['/llms.txt', '/gone.txt'], ['/llms.txt']), [
    'robots.txt: /gone.txt is named but not shipped',
  ]);
});

test('the openapi document and the shipped json routes must agree both ways', () => {
  const document = { paths: { '/feed.json': {}, '/ghost.json': {} } };

  assert.deepEqual(openApiCoverageGaps(document, ['/feed.json', '/search-index-post.json']), [
    'openapi.json: /ghost.json is described but not shipped',
    'openapi.json: /search-index-post.json is shipped but undescribed',
  ]);
});

test('the linkset carries an anchor and both service links', () => {
  assert.deepEqual(linksetShapeGaps(catalog), []);
  assert.deepEqual(linksetShapeGaps({ linkset: [] }), ['api-catalog: the linkset is empty']);
  assert.deepEqual(linksetShapeGaps({ linkset: [{ 'service-desc': [], 'service-doc': [] }] }), [
    'api-catalog: the linkset entry carries no anchor',
  ]);
});

test('the linkset hrefs are collected whatever relation holds them', () => {
  assert.deepEqual(linksetTargets(catalog), [`${ORIGIN}/openapi.json`, `${ORIGIN}/llms.txt`]);
});

test('the home page declares all three relations, and each target is shipped', () => {
  assert.deepEqual(linkHeaderGaps(headers(), ['/.well-known/api-catalog', '/openapi.json', '/llms.txt']), []);
});

test('a link rule hidden under the catch-all is not a home-page rule', () => {
  const leaked = headers().replace('/\n  Link:', '/*\n  Link:');

  assert.deepEqual(linkHeaderGaps(leaked, ['/openapi.json']), ['_headers: the home page carries no Link rule']);
});

test('a link header missing its rel is named, and so is the relation it was meant to carry', () => {
  const malformed = headers().replace('</llms.txt>; rel="describedby"', '/llms.txt');

  assert.deepEqual(linkHeaderGaps(malformed, ['/.well-known/api-catalog', '/openapi.json']), [
    '_headers: Link "/llms.txt" is not <uri>; rel="name"',
    '_headers: the home page declares no describedby link',
  ]);
});

test('a link header pointing at an unshipped file is named', () => {
  assert.deepEqual(linkHeaderGaps(headers(), ['/.well-known/api-catalog', '/llms.txt']), [
    '_headers: /openapi.json is named but not shipped',
  ]);
});

test('the head link and the robots directive must name the same manifest', () => {
  const html = '<link rel="ai-catalog" href="/.well-known/ai-catalog.json" type="application/json" />';

  assert.deepEqual(headLinkGaps(html, '/.well-known/ai-catalog.json'), []);
  assert.deepEqual(headLinkGaps(html, '/.well-known/other.json'), [
    'index.html: the ai-catalog link points at /.well-known/ai-catalog.json, robots.txt points at /.well-known/other.json',
  ]);
  assert.deepEqual(headLinkGaps('<head></head>', '/x.json'), ['index.html: no <link rel="ai-catalog">']);
});

test('the manifest lists shipped files under unique identifiers', () => {
  assert.deepEqual(manifestEntryGaps(manifest(), ['/llms.txt', '/feed.json']), []);
  assert.deepEqual(manifestEntryGaps({ entries: [] }, []), ['ai-catalog.json: the manifest lists no entries']);
  assert.deepEqual(manifestEntryGaps(manifest(['/llms.txt', '/gone.txt']), ['/llms.txt']), [
    'ai-catalog.json: /gone.txt is named but not shipped',
  ]);
});

test('an identifier reused by two entries is named once', () => {
  const twins = manifest(['/llms.txt', '/feed.json']);
  twins.entries[1].identifier = twins.entries[0].identifier;

  assert.deepEqual(manifestEntryGaps(twins, ['/llms.txt', '/feed.json']), [
    'ai-catalog.json: urn:air:example.com:machine:0 is listed twice',
  ]);
});

async function buildTree(overrides = {}) {
  const dist = await mkdtemp(join(tmpdir(), 'agent-interfaces-'));
  const files = {
    'robots.txt': robots(),
    _headers: headers(),
    'index.html': '<html><head><link rel="ai-catalog" href="/.well-known/ai-catalog.json" /></head></html>',
    'openapi.json': JSON.stringify({ paths: { '/feed.json': {} } }),
    'feed.json': '{}',
    'llms.txt': 'index',
    'sitemap-index.xml': '<urlset />',
    '.well-known/api-catalog': JSON.stringify(catalog),
    '.well-known/ai-catalog.json': JSON.stringify(manifest()),
    ...overrides,
  };
  for (const [route, body] of Object.entries(files)) {
    await mkdir(join(dist, route.split('/').slice(0, -1).join('/') || '.'), { recursive: true });
    await writeFile(join(dist, route), body);
  }
  return dist;
}

test('a built tree that satisfies every rule produces no findings', async () => {
  assert.deepEqual(await agentInterfaceFindings(await buildTree()), []);
});

test('a manifest the robots directive cannot reach is a finding about the build, not a crash', async () => {
  const dist = await buildTree({ 'robots.txt': robots().replace('ai-catalog.json', 'ai-catalog-v2.json') });

  assert.deepEqual(await agentInterfaceFindings(dist).catch((error) => error.code), 'ENOENT');
});

test('a json route the document forgot is caught against the real tree', async () => {
  const dist = await buildTree({ 'search-index-post.json': '[]' });

  assert.deepEqual(await agentInterfaceFindings(dist), [
    'openapi.json: /search-index-post.json is shipped but undescribed',
  ]);
});
