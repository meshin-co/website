import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { collectionGateFailures, readCollectionSurfaces } from './collection-gate.mjs';
import { indexFilesOf } from './fixtures/parity-world.mjs';

const SITE = 'https://meshin.co';
const INDEXABLE = '<!doctype html><html><head><meta content="index, follow" name="robots"></head><body></body></html>';
const NOINDEX = '<!doctype html><html><head><meta content="noindex, follow" name="robots"></head><body></body></html>';

const hubLine = (url) => `- [A page](${url}): what it holds`;
const llmsTxt = (...urls) => ['# meshin.co', '', '## Hubs', '', ...urls.map(hubLine)].join('\n');
const sitemap = (...urls) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset>${urls.map((url) => `<url><loc>${url}</loc><lastmod>2026-10-11T17:56:33.000Z</lastmod></url>`).join('')}</urlset>`;
const feedXml = (...urls) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>meshin.co</title><link>${SITE}/</link>${urls.map((url) => `<item><title>T</title><link>${url}</link><guid isPermaLink="true">${url}</guid></item>`).join('')}</channel></rss>`;
const searchIndex = (...documents) => indexFilesOf(documents);
const jsonFeed = (...urls) =>
  JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', items: urls.map((url) => ({ id: url, url })) });

const because = '/case-studies has no live case entry';
const MANIFEST = 'search-index/manifest.json';
const judged = { kinds: ['case'], routes: ['/case-studies'], htmlByRoute: { '/case-studies': NOINDEX }, site: SITE };

function distWith(files) {
  const dist = mkdtempSync(join(tmpdir(), 'collection-gate-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, file)), { recursive: true });
    writeFileSync(join(dist, file), content);
  }
  return dist;
}

test('readCollectionSurfaces lists every shipped file, sorted, and reads only the files that offer pages to a machine', async () => {
  const index = searchIndex({ href: '/a' });
  const dist = distWith({
    'case-studies.md': '# x',
    'case-studies/rss.xml': feedXml(),
    'llms/case.txt': '# x',
    'llms/case-1.txt': '# x',
    'llms.txt': llmsTxt(`${SITE}/a`),
    'llms-full.txt': '# x',
    'feed.json': jsonFeed(),
    'rss.xml': feedXml(),
    'sitemap-index.xml': sitemap(),
    'sitemap-0.xml': sitemap(`${SITE}/a`),
    ...index,
    'blog/an-article.md': `[x](${SITE}/case-studies)`,
    'about.html': INDEXABLE,
    'og/blog/a.png': 'png',
    'gate-routes.json': '{"routes":["/case-studies"]}',
  });
  const indexFiles = Object.keys(index);
  const documentFiles = indexFiles.filter((file) => file === MANIFEST || file.includes('/d/'));
  try {
    const { shipped, texts } = await readCollectionSurfaces(dist);
    assert.ok(documentFiles.length < indexFiles.length, 'the index must hold term chunks for this to prove anything');
    assert.deepEqual(shipped, [...shipped].sort());
    assert.deepEqual(
      shipped,
      [
        'about.html',
        'blog/an-article.md',
        'case-studies.md',
        'case-studies/rss.xml',
        'feed.json',
        'gate-routes.json',
        'llms-full.txt',
        'llms.txt',
        'llms/case-1.txt',
        'llms/case.txt',
        'og/blog/a.png',
        'rss.xml',
        'sitemap-0.xml',
        'sitemap-index.xml',
        ...indexFiles,
      ].sort()
    );
    assert.deepEqual(
      Object.keys(texts),
      [
        'case-studies/rss.xml',
        'feed.json',
        'llms-full.txt',
        'llms.txt',
        'llms/case-1.txt',
        'llms/case.txt',
        'rss.xml',
        'sitemap-0.xml',
        'sitemap-index.xml',
        ...documentFiles,
      ].sort()
    );
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('collectionGateFailures judges a built tree: clean while the empty hub is withheld, red the moment its mirror ships', async () => {
  const dist = distWith({
    'case-studies.html': NOINDEX,
    'llms.txt': llmsTxt(`${SITE}/faq`),
    'sitemap-0.xml': sitemap(`${SITE}/faq`),
  });
  try {
    assert.deepEqual(await collectionGateFailures(dist, judged), []);

    writeFileSync(join(dist, 'case-studies.md'), '# Fractional Chief AI Officer case study');
    assert.deepEqual(await collectionGateFailures(dist, judged), [`/case-studies.md ships but ${because}`]);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('collectionGateFailures reads the document pages of a built search index and finds the empty hub listed there', async () => {
  const unlisted = distWith({ 'case-studies.html': NOINDEX, ...searchIndex({ href: '/about' }) });
  const listed = distWith({
    'case-studies.html': NOINDEX,
    ...searchIndex({ href: '/about' }, { href: '/case-studies' }),
  });
  try {
    assert.deepEqual(await collectionGateFailures(unlisted, judged), []);
    assert.deepEqual(await collectionGateFailures(listed, judged), [`/${MANIFEST} lists /case-studies but ${because}`]);
  } finally {
    rmSync(unlisted, { recursive: true, force: true });
    rmSync(listed, { recursive: true, force: true });
  }
});

test('a corrupt or missing page in a built search index fails the gate loudly instead of judging less', async () => {
  const index = searchIndex({ href: '/about' });
  const page = Object.keys(index).find((file) => file.includes('/d/'));
  const damages = [
    [(dist) => writeFileSync(join(dist, page), '[["/about",'), `collection-gate: ${page} is not valid JSON`],
    [(dist) => rmSync(join(dist, page)), `collection-gate: ${page} is missing`],
  ];
  for (const [damage, message] of damages) {
    const dist = distWith({ 'case-studies.html': NOINDEX, ...index });
    try {
      damage(dist);
      await assert.rejects(collectionGateFailures(dist, judged), { message });
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  }
});
