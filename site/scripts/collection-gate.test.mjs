import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FEED_BASES } from '../src/utils/feeds.mjs';
import { emptyCollectionFindings, indexDocuments, listedPaths } from './collection-gate.mjs';
import { indexFilesOf } from './fixtures/parity-world.mjs';

const SITE = 'https://meshin.co';
const INDEXABLE = '<!doctype html><html><head><meta content="index, follow" name="robots"></head><body></body></html>';
const NOINDEX = '<!doctype html><html><head><meta content="noindex, follow" name="robots"></head><body></body></html>';

const caseWorld = ({ hub = NOINDEX, withHub = true, shipped = [], texts = {} } = {}) => ({
  kinds: ['case'],
  routes: withHub ? ['/', '/case-studies'] : ['/'],
  htmlByRoute: withHub ? { '/': INDEXABLE, '/case-studies': hub } : { '/': INDEXABLE },
  shipped,
  texts,
  site: SITE,
});

const hubLine = (url) => `- [A page](${url}): what it holds`;
const llmsTxt = (...urls) => ['# meshin.co', '', '## Hubs', '', ...urls.map(hubLine)].join('\n');
const sitemap = (...urls) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset>${urls.map((url) => `<url><loc>${url}</loc><lastmod>2026-10-11T17:56:33.000Z</lastmod></url>`).join('')}</urlset>`;
const feedXml = (...urls) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>meshin.co</title><link>${SITE}/</link>${urls.map((url) => `<item><title>T</title><link>${url}</link><guid isPermaLink="true">${url}</guid></item>`).join('')}</channel></rss>`;
const searchIndex = (...documents) => indexFilesOf(documents);
const MANIFEST = 'search-index/manifest.json';
const pageOf = (texts) => Object.keys(texts).find((file) => /\/d\/\d+\.json$/.test(file));
const chunkOf = (texts) => Object.keys(texts).find((file) => /\/t\/\d+\.json$/.test(file));
const jsonFeed = (...urls) =>
  JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', items: urls.map((url) => ({ id: url, url })) });

const because = '/case-studies has no live case entry';

test('a build with no empty collection owes this guard nothing, whatever the hub looks like', () => {
  const world = { ...caseWorld({ hub: INDEXABLE, shipped: ['case-studies.md'] }), kinds: [] };
  assert.deepEqual(emptyCollectionFindings(world), []);
});

test('a build with no empty collection reads none of its surfaces, so a damaged one fails nothing here', () => {
  const texts = { 'feed.json': '{"items":', [MANIFEST]: '[]' };
  assert.deepEqual(emptyCollectionFindings({ ...caseWorld({ texts }), kinds: [] }), []);
});

test('an empty collection whose hub is noindex and offered nowhere is clean', () => {
  assert.deepEqual(emptyCollectionFindings(caseWorld()), []);
});

test('an empty collection whose hub is indexable is a finding that names the hub and the collection', () => {
  assert.deepEqual(emptyCollectionFindings(caseWorld({ hub: INDEXABLE })), [
    '/case-studies is indexable but has no live case entry',
  ]);
});

test('a hub page with no robots meta at all is indexable', () => {
  const world = caseWorld({ hub: '<!doctype html><html><head></head><body></body></html>' });
  assert.deepEqual(emptyCollectionFindings(world), ['/case-studies is indexable but has no live case entry']);
});

test('a hub that was not built cannot be indexable, so only its machine files are judged', () => {
  assert.deepEqual(emptyCollectionFindings(caseWorld({ withHub: false })), []);
  assert.deepEqual(emptyCollectionFindings(caseWorld({ withHub: false, shipped: ['case-studies.md'] })), [
    `/case-studies.md ships but ${because}`,
  ]);
});

test('every collection comes from FEED_BASES, so a collection added later is judged without an edit here', () => {
  const kinds = Object.keys(FEED_BASES);
  const hubs = Object.values(FEED_BASES).map((base) => `/${base}`);
  const world = {
    kinds,
    routes: ['/', ...hubs],
    htmlByRoute: Object.fromEntries(['/', ...hubs].map((route) => [route, INDEXABLE])),
    shipped: [],
    texts: {},
    site: SITE,
  };
  assert.deepEqual(
    emptyCollectionFindings(world),
    kinds.map((kind) => `/${FEED_BASES[kind]} is indexable but has no live ${kind} entry`)
  );
});

test('a kind that has no feed base is not judged, because machine.mjs already reports it', () => {
  assert.deepEqual(emptyCollectionFindings({ ...caseWorld({ hub: INDEXABLE }), kinds: ['author'] }), []);
});

test('only the collections named empty are judged, so a populated hub may be indexable and listed', () => {
  const world = {
    ...caseWorld({
      hub: INDEXABLE,
      shipped: ['case-studies.md'],
      texts: { 'llms.txt': llmsTxt(`${SITE}/case-studies`) },
    }),
    kinds: ['faq'],
  };
  assert.deepEqual(emptyCollectionFindings(world), []);
});

test('an empty collection that still ships its markdown mirror, its own feed or a full-text file is a finding for each', () => {
  const shipped = ['case-studies.md', 'case-studies/rss.xml', 'llms/case.txt', 'llms/case-1.txt', 'llms/case-12.txt'];
  assert.deepEqual(
    emptyCollectionFindings(caseWorld({ shipped })),
    shipped.map((file) => `/${file} ships but ${because}`)
  );
});

test('the pages of an empty collection are not machine files, so its hub page and a noindex leaf page may ship', () => {
  const shipped = ['case-studies.html', 'case-studies/a-private-case.html', 'about.md', 'og/case/a.png'];
  assert.deepEqual(emptyCollectionFindings(caseWorld({ shipped })), []);
});

test('a full-text file of another collection is not mistaken for this collection’s file', () => {
  const shipped = [
    'llms/case-study.txt',
    'llms/cases.txt',
    'llms/case-1.txt.bak',
    'llms/post.txt',
    'case-studies-archive.md',
  ];
  assert.deepEqual(emptyCollectionFindings(caseWorld({ shipped })), []);
});

test('llms.txt linking the empty hub, its feed, its mirror or its full-text file is a finding for each', () => {
  const text = llmsTxt(
    `${SITE}/case-studies`,
    `${SITE}/case-studies/rss.xml`,
    `${SITE}/case-studies.md`,
    `${SITE}/llms/case.txt`
  );
  const findings = emptyCollectionFindings(caseWorld({ texts: { 'llms.txt': text } }));
  assert.deepEqual(findings, [
    `/llms.txt lists /case-studies but ${because}`,
    `/llms.txt lists /case-studies/rss.xml but ${because}`,
    `/llms.txt lists /case-studies.md but ${because}`,
    `/llms.txt lists /llms/case.txt but ${because}`,
  ]);
});

test('a sitemap, the search index, the merged feed and the json feed each count when they list the empty hub or one of its entries', () => {
  const texts = {
    'feed.json': jsonFeed(`${SITE}/case-studies/first`),
    'rss.xml': feedXml(`${SITE}/case-studies/first`),
    'sitemap-0.xml': sitemap(`${SITE}/case-studies`),
    ...searchIndex({ href: '/case-studies', description: 'Nothing published yet.' }),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), [
    `/feed.json lists /case-studies/first but ${because}`,
    `/rss.xml lists /case-studies/first but ${because}`,
    `/sitemap-0.xml lists /case-studies but ${because}`,
    `/${MANIFEST} lists /case-studies but ${because}`,
  ]);
});

test('an entry listed twice in one surface is one finding, not two', () => {
  const texts = { 'rss.xml': feedXml(`${SITE}/case-studies/first`) };
  assert.equal(emptyCollectionFindings(caseWorld({ texts })).length, 1);
});

test('a trailing slash, a query string or a fragment does not hide the hub from the listing check', () => {
  for (const url of [`${SITE}/case-studies/`, `${SITE}/case-studies?utm=x`, `${SITE}/case-studies#top`]) {
    const findings = emptyCollectionFindings(caseWorld({ texts: { 'llms.txt': llmsTxt(url) } }));
    assert.deepEqual(findings, [`/llms.txt lists /case-studies but ${because}`], url);
  }
});

const pointerLine = (path) => `- [Pointer](${SITE}${path}): 3 entries, full body text of each.`;
const llmsFull = (...paths) => ['# meshin.co', '', '## Collections', '', ...paths.map(pointerLine)].join('\n');

test('llms-full.txt pointing at the full-text file of an empty collection is a finding, as any listing surface is', () => {
  const texts = {
    'llms-full.txt': llmsFull('/llms/faq.txt', '/llms/case.txt', '/llms/case-1.txt', '/llms/case-12.txt'),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), [
    `/llms-full.txt lists /llms/case.txt but ${because}`,
    `/llms-full.txt lists /llms/case-1.txt but ${because}`,
    `/llms-full.txt lists /llms/case-12.txt but ${because}`,
  ]);
});

test('llms-full.txt pointing only at the collections that have entries is clean for an empty collection', () => {
  const texts = {
    'llms-full.txt': llmsFull('/llms/faq.txt', '/llms/post.txt', '/llms/post-2.txt', '/llms/case-study.txt'),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('a heading that carries the title of an empty collection in llms-full.txt is no finding, the file holds pointers', () => {
  const texts = {
    'llms-full.txt': ['# meshin.co', '', '## Case studies', '', pointerLine('/llms/faq.txt')].join('\n'),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('a path that merely begins with the hub name, or sits under another hub, is not under the empty hub', () => {
  const texts = {
    'llms.txt': llmsTxt(`${SITE}/case-studies-archive`, `${SITE}/blog/case-studies`, `${SITE}/case`),
    ...searchIndex({ href: '/case-studies-archive' }, { href: '/blog/case-studies' }),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('a link to another origin that shares the hub’s path is not a listing of this site’s hub', () => {
  const texts = { 'llms.txt': llmsTxt('https://example.com/case-studies', 'https://meshin.co.evil.test/case-studies') };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('the hub named in prose, or inside a body line, is not a listing, so an article may mention it', () => {
  const texts = {
    'llms/post.txt': [
      '## Writing',
      '',
      '# An article',
      '',
      `[${SITE}/blog/an-article](${SITE}/blog/an-article)`,
      '',
      `See ${SITE}/case-studies for client work, or the case studies page.`,
    ].join('\n'),
    ...searchIndex({
      href: '/blog/an-article',
      kind: 'Writing',
      description: 'Read /case-studies for client work.',
    }),
    'feed.json': JSON.stringify({ items: [{ url: `${SITE}/blog/an-article`, content_text: `${SITE}/case-studies` }] }),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('a surface that is not valid JSON fails loudly instead of being skipped', () => {
  const texts = { 'feed.json': '{"items":' };
  assert.throws(() => emptyCollectionFindings(caseWorld({ texts })), /feed\.json is not valid JSON/);
});

test('a manifest or a page of the search index that is not valid JSON fails loudly and names the file', () => {
  for (const file of [MANIFEST, pageOf(searchIndex({ href: '/a' }))]) {
    const texts = { ...searchIndex({ href: '/a' }), [file]: '[["/a",' };
    assert.throws(() => emptyCollectionFindings(caseWorld({ texts })), {
      message: `collection-gate: ${file} is not valid JSON`,
    });
  }
});

test('a manifest that holds no document count or page size and a page that holds no list fail loudly, as a surface with no list does', () => {
  const page = pageOf(searchIndex({ href: '/a' }));
  for (const [file, text] of [
    [MANIFEST, '[]'],
    [MANIFEST, '{"version":"abc"}'],
    [MANIFEST, '{"version":"abc","documents":3}'],
    [MANIFEST, '{"version":"abc","documents":3,"pageSize":0}'],
    [page, '{"href":"/a"}'],
  ]) {
    const texts = { ...searchIndex({ href: '/a' }), [file]: text };
    assert.throws(() => emptyCollectionFindings(caseWorld({ texts })), {
      message: `collection-gate: ${file} does not hold the list this guard reads`,
    });
  }
});

test('a page the manifest names but the build lacks fails loudly instead of listing less', () => {
  const texts = searchIndex({ href: '/a' });
  const page = pageOf(texts);
  delete texts[page];
  assert.throws(() => emptyCollectionFindings(caseWorld({ texts })), {
    message: `collection-gate: ${page} is missing`,
  });
});

test('pages of the search index with no manifest fail loudly instead of reading nothing', () => {
  const texts = searchIndex({ href: '/case-studies' });
  delete texts[MANIFEST];
  assert.throws(() => emptyCollectionFindings(caseWorld({ texts })), {
    message: `collection-gate: ${MANIFEST} is missing`,
  });
});

test('a term chunk holds no list and is never read as one, so a damaged chunk changes nothing here', () => {
  const texts = searchIndex({ href: '/a' }, { href: '/case-studies' });
  const chunk = chunkOf(texts);
  assert.ok(chunk, 'the index must hold a term chunk for this to prove anything');
  texts[chunk] = 'not json';
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), [`/${MANIFEST} lists /case-studies but ${because}`]);
});

test('an address in the search index is judged as every other surface is: a trailing slash does not hide the hub', () => {
  const texts = searchIndex({ href: '/case-studies/' }, { href: '/case-studies/first/' });
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), [
    `/${MANIFEST} lists /case-studies but ${because}`,
    `/${MANIFEST} lists /case-studies/first but ${because}`,
  ]);
});

test('indexDocuments reads each document of the index with its kind in address order, and nothing from a build with no index', () => {
  assert.deepEqual(indexDocuments({}), []);
  assert.deepEqual(indexDocuments({ 'llms.txt': '# x' }), []);
  assert.deepEqual(
    indexDocuments(
      searchIndex(
        { href: '/b', title: 'B', description: 'The b page', kind: 'Writing' },
        { href: '/a', title: 'A', description: 'The a page', kind: 'Glossary' }
      )
    ),
    [
      { href: '/a', title: 'A', description: 'The a page', kind: 'Glossary' },
      { href: '/b', title: 'B', description: 'The b page', kind: 'Writing' },
    ]
  );
});

test('listedPaths reads each surface by its own shape and keeps only this site’s paths', () => {
  assert.deepEqual(
    listedPaths(
      'llms.txt',
      `- [A](${SITE}/a) (updated 2026-10-07T00:00:00.000Z): x\n${SITE}/b\nprose ${SITE}/c\n- [Other](https://x.test/d): y`,
      SITE
    ),
    ['/a', '/b']
  );
  assert.deepEqual(listedPaths('sitemap-0.xml', sitemap(`${SITE}/a`, `${SITE}/`), SITE), ['/a', '/']);
  assert.deepEqual(listedPaths('rss.xml', feedXml(`${SITE}/a`), SITE), ['/', '/a', '/a']);
  assert.deepEqual(listedPaths('case-studies/rss.xml', feedXml(), SITE), ['/']);
  assert.deepEqual(listedPaths('feed.json', jsonFeed(`${SITE}/a`), SITE), ['/a']);
});
