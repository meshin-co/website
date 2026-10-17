import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FEED_BASES } from '../src/utils/feeds.mjs';
import { emptyCollectionFindings, listedPaths } from './collection-gate.mjs';

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
const shard = (...rows) =>
  JSON.stringify(rows.map((row) => ({ title: 'T', description: 'D', kind: 'Page', text: 'x', ...row })));
const jsonFeed = (...urls) =>
  JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', items: urls.map((url) => ({ id: url, url })) });

const because = '/case-studies has no live case entry';

test('a build with no empty collection owes this guard nothing, whatever the hub looks like', () => {
  const world = { ...caseWorld({ hub: INDEXABLE, shipped: ['case-studies.md'] }), kinds: [] };
  assert.deepEqual(emptyCollectionFindings(world), []);
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

test('a sitemap, a search shard, the merged feed and the json feed each count when they list the empty hub or one of its entries', () => {
  const texts = {
    'feed.json': jsonFeed(`${SITE}/case-studies/first`),
    'rss.xml': feedXml(`${SITE}/case-studies/first`),
    'search-index-page.json': shard({ href: '/case-studies', text: 'Nothing published yet.' }),
    'sitemap-0.xml': sitemap(`${SITE}/case-studies`),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), [
    `/feed.json lists /case-studies/first but ${because}`,
    `/rss.xml lists /case-studies/first but ${because}`,
    `/search-index-page.json lists /case-studies but ${because}`,
    `/sitemap-0.xml lists /case-studies but ${because}`,
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

test('the heading of an empty collection in llms-full.txt is a finding, because the section is offered with nothing in it', () => {
  const texts = { 'llms-full.txt': '# meshin.co\n\n## Offers\n\n## Case studies\n\n## Questions and answers\n' };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), [
    '/llms-full.txt carries the heading "Case studies" but ' + because,
  ]);
});

test('a heading is read in llms-full.txt only, and only as a whole line', () => {
  const texts = {
    'llms/post.txt': '## Case studies\n',
    'llms-full.txt': 'See the ## Case studies heading, or ### Case studies in detail.\n',
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('a path that merely begins with the hub name, or sits under another hub, is not under the empty hub', () => {
  const texts = {
    'llms.txt': llmsTxt(`${SITE}/case-studies-archive`, `${SITE}/blog/case-studies`, `${SITE}/case`),
    'search-index-page.json': shard({ href: '/case-studies-archive' }, { href: '/blog/case-studies' }),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('a link to another origin that shares the hub’s path is not a listing of this site’s hub', () => {
  const texts = { 'llms.txt': llmsTxt('https://example.com/case-studies', 'https://meshin.co.evil.test/case-studies') };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('the hub named in prose, or inside a body line, is not a listing, so an article may mention it', () => {
  const texts = {
    'llms-full.txt': [
      '## Writing',
      '',
      '# An article',
      '',
      `[${SITE}/blog/an-article](${SITE}/blog/an-article)`,
      '',
      `See ${SITE}/case-studies for client work, or the case studies page.`,
    ].join('\n'),
    'search-index-post.json': shard({ href: '/blog/an-article', text: 'Read /case-studies for client work.' }),
    'feed.json': JSON.stringify({ items: [{ url: `${SITE}/blog/an-article`, content_text: `${SITE}/case-studies` }] }),
  };
  assert.deepEqual(emptyCollectionFindings(caseWorld({ texts })), []);
});

test('a surface that is not valid JSON fails loudly instead of being skipped', () => {
  const texts = { 'search-index-page.json': '[{"href":' };
  assert.throws(() => emptyCollectionFindings(caseWorld({ texts })), /search-index-page\.json is not valid JSON/);
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
  assert.deepEqual(listedPaths('search-index-page.json', shard({ href: '/a/' }, { href: '/b' }), SITE), ['/a', '/b']);
  assert.deepEqual(listedPaths('feed.json', jsonFeed(`${SITE}/a`), SITE), ['/a']);
});
