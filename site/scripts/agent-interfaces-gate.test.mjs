import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSearchIndex, chunkPath, pagePath } from '../src/utils/search-index.mjs';

import {
  agentInterfaceFindings,
  contentSignalGaps,
  headLinkGaps,
  linkHeaderGaps,
  linksetShapeGaps,
  linksetTargets,
  llmsSummaryGaps,
  manifestEntryGaps,
  manifestRoute,
  markdownNegotiationGaps,
  openApiCoverageGaps,
  robotsSignalGaps,
  shippedGaps,
} from './agent-interfaces-gate.mjs';

const ORIGIN = 'https://example.com';
const SIGNAL = 'search=yes, ai-input=yes, ai-train=yes';

const robots = (groups = ['*', 'GPTBot']) =>
  [
    ...groups.map((agent) => `User-agent: ${agent}\nContent-Signal: ${SIGNAL}\nAllow: /\nDisallow: /search`),
    `Sitemap: ${ORIGIN}/sitemap-index.xml`,
  ].join('\n\n');

const headers = (
  home = `/\n  Link: </.well-known/api-catalog>; rel="api-catalog"\n  Link: </openapi.json>; rel="service-desc"\n  Link: </llms.txt>; rel="describedby"`
) =>
  [`/*\n  X-Frame-Options: DENY\n  Content-Signal: ${SIGNAL}`, home, `/feed.json\n  X-Robots-Tag: noindex`].join(
    '\n\n'
  );

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

test('every response declares all three signals', () => {
  assert.deepEqual(contentSignalGaps(headers()), []);
});

test('a build that declares no signal at all is named', () => {
  const silent = headers().replace(`\n  Content-Signal: ${SIGNAL}`, '');

  assert.deepEqual(contentSignalGaps(silent), ['_headers: no response declares a Content-Signal']);
});

test('every robots group repeats the header word for word', () => {
  assert.deepEqual(robotsSignalGaps(robots(), headers()), []);
});

test('a robots group that says something else than the header is named', () => {
  const drifted = robots().replace(
    `Content-Signal: ${SIGNAL}`,
    'Content-Signal: search=yes, ai-input=yes, ai-train=no'
  );

  assert.deepEqual(robotsSignalGaps(drifted, headers()), [
    'robots.txt: the group for * says "search=yes, ai-input=yes, ai-train=no", the header says "search=yes, ai-input=yes, ai-train=yes"',
  ]);
});

test('a robots group added without the directive is named', () => {
  const silent = `${robots()}\n\nUser-agent: NewBot\nAllow: /`;

  assert.deepEqual(robotsSignalGaps(silent, headers()), [
    'robots.txt: the group for NewBot declares 0 Content-Signal lines',
  ]);
});

test('a signal left out of the header is named', () => {
  const partial = headers().replace(SIGNAL, 'search=yes, ai-input=yes');

  assert.deepEqual(contentSignalGaps(partial), ['_headers: the Content-Signal leaves ai-train unsaid']);
});

test('two signal headers on the same rule are ambiguous and fail', () => {
  const twice = headers().replace(
    `Content-Signal: ${SIGNAL}`,
    `Content-Signal: ${SIGNAL}\n  Content-Signal: search=no, ai-input=no, ai-train=no`
  );

  assert.deepEqual(contentSignalGaps(twice), ['_headers: /* declares 2 Content-Signal headers']);
});

test('the manifest route is read off the head link', () => {
  assert.equal(
    manifestRoute('<link rel="ai-catalog" href="/.well-known/ai-catalog.json" />'),
    '/.well-known/ai-catalog.json'
  );
  assert.equal(manifestRoute('<head></head>'), undefined);
});

test('a named route that the build does not ship is a finding', () => {
  assert.deepEqual(shippedGaps('robots.txt', ['/llms.txt', '/gone.txt'], ['/llms.txt']), [
    'robots.txt: /gone.txt is named but not shipped',
  ]);
});

test('the openapi document and the shipped json routes must agree both ways', () => {
  const document = { paths: { '/feed.json': {}, '/ghost.json': {} } };

  assert.deepEqual(openApiCoverageGaps(document, ['/feed.json', '/data/extra.json']), [
    'openapi.json: /ghost.json is described but not shipped',
    'openapi.json: /data/extra.json is shipped but undescribed',
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

test('the head link must name a manifest the build ships', () => {
  const html = '<link rel="ai-catalog" href="/.well-known/ai-catalog.json" type="application/json" />';

  assert.deepEqual(headLinkGaps(html, ['/.well-known/ai-catalog.json']), []);
  assert.deepEqual(headLinkGaps(html, []), ['index.html: /.well-known/ai-catalog.json is named but not shipped']);
  assert.deepEqual(headLinkGaps('<head></head>', []), ['index.html: no <link rel="ai-catalog">']);
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

const GOOD_SUMMARY = '# Example\n\n- [Home](https://example.com/): the home page\n';

test('a summary with an H1, enough text and a Markdown link has no gap', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', GOOD_SUMMARY), []);
});

test('a summary whose first non-empty line is not an H1 is named with that line', () => {
  const text = 'Example site\n\n# Example\n\n- [Home](https://example.com/): the home page\n';

  assert.deepEqual(llmsSummaryGaps('llms.txt', text), [
    'llms.txt: the first non-empty line is not an H1 heading: "Example site"',
  ]);
});

test('an H2, an H1 without text and a hash with no space are not an H1 heading', () => {
  const rest = '\n\n- [Home](https://example.com/): the home page and more\n';

  for (const first of ['## Example', '#', '#Example']) {
    assert.equal(llmsSummaryGaps('llms/post.txt', `${first}${rest}`).length, 1, first);
  }
});

test('leading blank lines do not hide an H1, so the first non-empty line is what counts', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', `\n\n${GOOD_SUMMARY}`), []);
});

test('a summary under 50 bytes is named with its size', () => {
  const text = '# Tiny\n[a](https://e.co/)\n';

  assert.deepEqual(llmsSummaryGaps('llms/post.txt', text), [
    `llms/post.txt: ${Buffer.byteLength(text)} bytes, under the 50-byte minimum`,
  ]);
});

test('exactly 50 bytes is long enough', () => {
  const head = '# T\n[a](https://e.co/x)';
  const text = `${head}${'.'.repeat(50 - head.length)}`;

  assert.equal(Buffer.byteLength(text), 50);
  assert.deepEqual(llmsSummaryGaps('llms.txt', text), []);
});

test('size counts bytes, so multi-byte text is not short by character count', () => {
  const text = `# Ы\n[${'ы'.repeat(15)}](https://e.co/)`;

  assert.ok(text.length < 50 && Buffer.byteLength(text) >= 50);
  assert.deepEqual(llmsSummaryGaps('llms.txt', text), []);
});

test('a bare URL is not a link, and the finding says how many bare URLs were seen', () => {
  const text = '# Example\n\nSee https://example.com/ and https://example.com/about for the pages.\n';

  assert.deepEqual(llmsSummaryGaps('llms.txt', text), [
    'llms.txt: no Markdown link [text](url); 2 bare URLs do not count',
  ]);
});

test('a file with no URL at all is named without a bare-URL count', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', '# Example\n\nA site about agents and nothing else to show.\n'), [
    'llms.txt: no Markdown link [text](url)',
  ]);
});

test('an image, an empty link text and a link inside a code fence are not links', () => {
  const base = '# Example\n\nText long enough to clear the floor on its own.\n';

  for (const body of ['![alt](https://e.co/a.png)', '[](https://e.co/)', '```\n[a](https://e.co/)\n```']) {
    assert.equal(llmsSummaryGaps('llms.txt', `${base}${body}\n`).length, 1, body);
  }
});

test('a relative inline link among prose counts', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', '# Example\n\nRead [the about page](/about) for more detail.\n'), []);
});

test('every condition that fails is named, one finding each', () => {
  assert.deepEqual(llmsSummaryGaps('llms/x.txt', 'x'), [
    'llms/x.txt: the first non-empty line is not an H1 heading: "x"',
    'llms/x.txt: 1 bytes, under the 50-byte minimum',
    'llms/x.txt: no Markdown link [text](url)',
  ]);
});

test('an empty file is named for all three conditions without a crash', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', ''), [
    'llms.txt: the first non-empty line is not an H1 heading: ""',
    'llms.txt: 0 bytes, under the 50-byte minimum',
    'llms.txt: no Markdown link [text](url)',
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
    '_worker.js': 'export default {};',
    'index.md': '# Home',
    'llms.txt': GOOD_SUMMARY,
    'llms-full.txt': GOOD_SUMMARY,
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

test('the built tree is checked: llms.txt, llms-full.txt and every llms shard', async () => {
  const dist = await buildTree({
    'llms.txt': 'Example\n',
    'llms-full.txt': '# Example full text with no link in it at all, only prose\n',
    'llms/post.txt': '# P\n',
    'llms/faq.txt': GOOD_SUMMARY,
  });

  assert.deepEqual(await agentInterfaceFindings(dist), [
    'llms.txt: the first non-empty line is not an H1 heading: "Example"',
    'llms.txt: 8 bytes, under the 50-byte minimum',
    'llms.txt: no Markdown link [text](url)',
    'llms-full.txt: no Markdown link [text](url)',
    'llms/post.txt: 4 bytes, under the 50-byte minimum',
    'llms/post.txt: no Markdown link [text](url)',
  ]);
});

test('a tree with no llms.txt or llms-full.txt is named, not a crash', async () => {
  const dist = await buildTree();
  await rm(join(dist, 'llms.txt'));
  await rm(join(dist, 'llms-full.txt'));

  const findings = await agentInterfaceFindings(dist);

  assert.ok(findings.includes('llms.txt: not shipped'));
  assert.ok(findings.includes('llms-full.txt: not shipped'));
});

test('a head link naming a manifest the build never wrote is a finding, not a crash', async () => {
  const dist = await buildTree({
    'index.html': '<html><head><link rel="ai-catalog" href="/.well-known/ai-catalog-v2.json" /></head></html>',
  });

  assert.deepEqual(await agentInterfaceFindings(dist), [
    'index.html: /.well-known/ai-catalog-v2.json is named but not shipped',
  ]);
});

test('a json route the document forgot is caught against the real tree', async () => {
  const dist = await buildTree({ 'data/extra.json': '[]' });

  assert.deepEqual(await agentInterfaceFindings(dist), ['openapi.json: /data/extra.json is shipped but undescribed']);
});

const SEARCH_MANIFEST = '/search-index/manifest.json';
const { version: SEARCH_VERSION } = buildSearchIndex([]).manifest;
const describing = (...routes) => JSON.stringify({ paths: Object.fromEntries(routes.map((route) => [route, {}])) });

function searchIndexFiles(count) {
  const files = {};
  for (let at = 0; at < count; at += 1) {
    files[chunkPath(SEARCH_VERSION, at).slice(1)] = '[]';
    files[pagePath(SEARCH_VERSION, at).slice(1)] = '[]';
  }
  return files;
}

test('the files behind the search index manifest are implementation files, so 500 chunks and 500 pages leave a described tree clean', async () => {
  const dist = await buildTree({
    'openapi.json': describing('/feed.json', SEARCH_MANIFEST),
    'search-index/manifest.json': '{}',
    ...searchIndexFiles(500),
  });

  assert.deepEqual(await agentInterfaceFindings(dist), []);
});

test('the search index manifest is a public interface, so a document that forgets it is a finding however many files stand behind it', async () => {
  const dist = await buildTree({ 'search-index/manifest.json': '{}', ...searchIndexFiles(2) });

  assert.deepEqual(await agentInterfaceFindings(dist), [
    'openapi.json: /search-index/manifest.json is shipped but undescribed',
  ]);
});

test('a JSON file the search index keeps outside a version directory is a finding too', async () => {
  const dist = await buildTree({
    'openapi.json': describing('/feed.json', SEARCH_MANIFEST),
    'search-index/manifest.json': '{}',
    'search-index/stray.json': '{}',
  });

  assert.deepEqual(await agentInterfaceFindings(dist), [
    'openapi.json: /search-index/stray.json is shipped but undescribed',
  ]);
});

test('an edge handler that is not shipped means the markdown URL answers HTML', () => {
  assert.deepEqual(markdownNegotiationGaps(['/index.md', '/index.html']), [
    '_worker.js: the build ships no edge handler, so Accept: text/markdown answers HTML',
  ]);
});

test('an edge handler with no home sidecar to serve is dead on the route agents probe', () => {
  assert.deepEqual(markdownNegotiationGaps(['/_worker.js', '/index.html']), [
    'index.md: the home route has no markdown sidecar for the edge handler to serve',
  ]);
});

test('both shipped is the whole requirement', () => {
  assert.deepEqual(markdownNegotiationGaps(['/_worker.js', '/index.md']), []);
});
