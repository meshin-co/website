import test from 'node:test';
import { createHash } from 'node:crypto';
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
  manifestSchemaGaps,
  markdownNegotiationGaps,
  openApiCoverageGaps,
  robotsSignalGaps,
  shippedGaps,
} from './agent-interfaces-gate.mjs';
import { renderAiCatalog } from './gen-agent-catalog.mjs';

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

const manifest = (paths = ['/llms.txt', '/feed.json']) =>
  renderAiCatalog({
    origin: ORIGIN,
    entries: paths.map((path, index) => ({
      path,
      namespace: 'machine',
      name: String(index),
      displayName: `Entry ${index}`,
      type: 'text/plain',
      description: 'A machine entry point of the example site.',
    })),
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

test('the manifest the generator writes passes the validator the installed audit uses', () => {
  assert.deepEqual(manifestSchemaGaps(JSON.stringify(manifest())), []);
});

test('a manifest missing a member the validator requires is refused, whichever member it is', () => {
  const without = {
    specVersion: (document) => delete document.specVersion,
    type: (document) => document.entries.forEach((entry) => delete entry.type),
    displayName: (document) => document.entries.forEach((entry) => delete entry.displayName),
  };

  for (const [member, remove] of Object.entries(without)) {
    const document = manifest();
    remove(document);
    const gaps = manifestSchemaGaps(JSON.stringify(document));

    assert.ok(gaps.length > 0, `${member} removed, and no finding`);
    assert.ok(
      gaps.every((gap) => gap.startsWith('ai-catalog.json: ')),
      member
    );
    assert.ok(
      gaps.some((gap) => gap.includes(member)),
      member
    );
  }
});

const GOOD_SUMMARY = '# Example\n\n- [Home](https://example.com/): the home page\n';

const RULES = { h1: /H1 heading/, floor: /minimum/, link: /Markdown link/ };
const rulesOf = (gaps) => gaps.map((gap) => Object.keys(RULES).find((rule) => RULES[rule].test(gap)));

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

  for (const first of ['## Example', '#', '# ', '#Example']) {
    assert.equal(llmsSummaryGaps('llms/post.txt', `${first}${rest}`).length, 1, first);
  }
});

test('leading blank lines do not hide an H1, so the first non-empty line is what counts', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', `\n\n${GOOD_SUMMARY}`), []);
});

test('a summary under 50 characters is named with its size', () => {
  const text = '# Tiny\n[a](https://e.co/)\n';

  assert.deepEqual(llmsSummaryGaps('llms/post.txt', text), [
    `llms/post.txt: ${text.length} characters, under the 50-character minimum`,
  ]);
});

test('exactly 50 characters is long enough and 49 is not', () => {
  const head = '# T\n[a](https://e.co/x)';
  const fifty = `${head}${'.'.repeat(50 - head.length)}`;
  const fortyNine = `${head}${'.'.repeat(49 - head.length)}`;

  assert.deepEqual(llmsSummaryGaps('llms.txt', fifty), []);
  assert.deepEqual(rulesOf(llmsSummaryGaps('llms.txt', fortyNine)), ['floor']);
});

test('size counts characters, as the audit does, so multi-byte text past 50 bytes is still short', () => {
  const text = `# Ы\n[${'ы'.repeat(15)}](https://e.co/)`;

  assert.ok(text.length < 50 && Buffer.byteLength(text) >= 50);
  assert.deepEqual(rulesOf(llmsSummaryGaps('llms.txt', text)), ['floor']);
});

test('a leading byte order mark is not counted, because one of the two ways Lighthouse reads the file drops it', () => {
  const head = '\uFEFF\n# T\n[a](https://e.co/x)';
  const fifty = head.padEnd(50, '.');

  assert.equal(fifty.length, 50);
  assert.deepEqual(rulesOf(llmsSummaryGaps('llms.txt', fifty)), ['floor']);
  assert.deepEqual(llmsSummaryGaps('llms.txt', `${fifty}.`), []);
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

test('an image, an empty text, an empty target, and a link in a code fence or inline code are not links', () => {
  const base = '# Example\n\nText long enough to clear the floor on its own.\n';
  const bodies = [
    '![alt](https://e.co/a.png)',
    '[](https://e.co/)',
    '[a]()',
    '```\n[a](https://e.co/)\n```',
    '~~~\n[a](https://e.co/)\n~~~',
    '`[a](https://e.co/)`',
  ];

  for (const body of bodies) {
    assert.equal(llmsSummaryGaps('llms.txt', `${base}${body}\n`).length, 1, body);
  }
});

test('a relative inline link among prose counts', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', '# Example\n\nRead [the about page](/about) for more detail.\n'), []);
});

test('a link whose text is inline code is a link', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', '# Example\n\nRead [`npm run build`](/docs) for more detail.\n'), []);
});

test('removing inline code never joins a closing bracket to an opening parenthesis into a link', () => {
  const text = '# Example\n\nA site about agents: [a]`x`(b) and nothing more to read.\n';

  assert.deepEqual(rulesOf(llmsSummaryGaps('llms.txt', text)), ['link']);
});

test('a line break of any kind inside a link ends it, because the audit reads no link across one', () => {
  for (const separator of ['\r', '\u2028', '\u2029']) {
    const bodies = [
      `Read [the${separator}about page](/about) for more detail.`,
      `Read [the about page](/ab${separator}out) for more detail.`,
      `Read [the \`a${separator}b\` page](/about) for more detail.`,
    ];
    for (const body of bodies) {
      assert.deepEqual(rulesOf(llmsSummaryGaps('llms.txt', `# Example\n\n${body}\n`)), ['link'], JSON.stringify(body));
    }
  }
});

test('carriage-return line endings do not break an H1 or a link', () => {
  assert.deepEqual(llmsSummaryGaps('llms.txt', GOOD_SUMMARY.replaceAll('\n', '\r\n')), []);
  assert.deepEqual(llmsSummaryGaps('llms.txt', GOOD_SUMMARY.replaceAll('\n', '\r')), []);
});

test('every condition that fails is named, one finding each, each starting with the file', () => {
  const gaps = llmsSummaryGaps('llms/x.txt', 'x');

  assert.deepEqual(rulesOf(gaps), ['h1', 'floor', 'link']);
  assert.ok(gaps.every((gap) => gap.startsWith('llms/x.txt: ')));
});

test('an empty file is named for all three conditions without a crash', () => {
  assert.deepEqual(rulesOf(llmsSummaryGaps('llms.txt', '')), ['h1', 'floor', 'link']);
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

test('a built tree whose manifest the validator refuses is named, not passed', async () => {
  const document = manifest();
  delete document.specVersion;

  const findings = await agentInterfaceFindings(
    await buildTree({ '.well-known/ai-catalog.json': JSON.stringify(document) })
  );

  assert.ok(findings.length > 0);
  assert.ok(findings.every((finding) => finding.startsWith('ai-catalog.json: ')));
});

const VECTORS = '{"cases":[]}\n';
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const specTree = ({ page = sha256(VECTORS), sidecar = sha256(VECTORS) } = {}) => ({
  'openapi.json': JSON.stringify({ paths: { '/feed.json': {}, '/spec/zz/1.0/vectors.json': {} } }),
  'spec/zz/1.0/vectors.json': VECTORS,
  'spec/zz/1.0.html': `<ul><li data-artefact="/spec/zz/1.0/vectors.json"><code data-artefact-digest>${page}</code></li></ul>`,
  'spec/zz/1.0.md': `- [vectors.json](${ORIGIN}/spec/zz/1.0/vectors.json): SHA-256 \`${sidecar}\``,
});

test('a published specification whose page and sidecar show the digest of the served file is passed', async () => {
  assert.deepEqual(await agentInterfaceFindings(await buildTree(specTree())), []);
});

test('a published specification whose page shows another digest than the served file is named, not passed', async () => {
  const findings = await agentInterfaceFindings(await buildTree(specTree({ page: sha256('other') })));

  assert.ok(findings.length > 0);
  assert.ok(findings.every((finding) => finding.includes('spec/zz/1.0.html')));
});

test('a published specification whose sidecar shows another digest than the served file is named, not passed', async () => {
  const findings = await agentInterfaceFindings(await buildTree(specTree({ sidecar: sha256('other') })));

  assert.ok(findings.length > 0);
  assert.ok(findings.every((finding) => finding.includes('spec/zz/1.0.md')));
});

test('the built tree is checked: llms.txt, llms-full.txt and every llms shard', async () => {
  const dist = await buildTree({
    'llms.txt': 'Example\n',
    'llms-full.txt': '# Example full text with no link in it at all, only prose\n',
    'llms/post.txt': '# P\n',
    'llms/faq.txt': GOOD_SUMMARY,
  });
  const byFile = Object.groupBy(await agentInterfaceFindings(dist), (finding) =>
    finding.slice(0, finding.indexOf(': '))
  );

  assert.deepEqual(Object.keys(byFile).sort(), ['llms-full.txt', 'llms.txt', 'llms/post.txt']);
  assert.deepEqual(rulesOf(byFile['llms.txt']), ['h1', 'floor', 'link']);
  assert.deepEqual(rulesOf(byFile['llms-full.txt']), ['link']);
  assert.deepEqual(rulesOf(byFile['llms/post.txt']), ['floor', 'link']);
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
