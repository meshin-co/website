import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { collectionGateFailures, readCollectionSurfaces } from './collection-gate.mjs';

const SITE = 'https://meshin.co';
const INDEXABLE = '<!doctype html><html><head><meta content="index, follow" name="robots"></head><body></body></html>';
const NOINDEX = '<!doctype html><html><head><meta content="noindex, follow" name="robots"></head><body></body></html>';

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

function distWith(files) {
  const dist = mkdtempSync(join(tmpdir(), 'collection-gate-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, file)), { recursive: true });
    writeFileSync(join(dist, file), content);
  }
  return dist;
}

test('readCollectionSurfaces lists every shipped file, sorted, and reads only the files that offer pages to a machine', async () => {
  const dist = distWith({
    'case-studies.md': '# x',
    'case-studies/rss.xml': feedXml(),
    'llms/case.txt': '# x',
    'llms.txt': llmsTxt(`${SITE}/a`),
    'llms-full.txt': '# x',
    'feed.json': jsonFeed(),
    'rss.xml': feedXml(),
    'sitemap-index.xml': sitemap(),
    'sitemap-0.xml': sitemap(`${SITE}/a`),
    'search-index-page.json': shard({ href: '/a' }),
    'blog/an-article.md': `[x](${SITE}/case-studies)`,
    'about.html': INDEXABLE,
    'og/blog/a.png': 'png',
    'gate-routes.json': '{"routes":["/case-studies"]}',
  });
  try {
    const { shipped, texts } = await readCollectionSurfaces(dist);
    assert.deepEqual(shipped, [...shipped].sort());
    assert.deepEqual(shipped, [
      'about.html',
      'blog/an-article.md',
      'case-studies.md',
      'case-studies/rss.xml',
      'feed.json',
      'gate-routes.json',
      'llms-full.txt',
      'llms.txt',
      'llms/case.txt',
      'og/blog/a.png',
      'rss.xml',
      'search-index-page.json',
      'sitemap-0.xml',
      'sitemap-index.xml',
    ]);
    assert.deepEqual(Object.keys(texts), [
      'case-studies/rss.xml',
      'feed.json',
      'llms-full.txt',
      'llms.txt',
      'llms/case.txt',
      'rss.xml',
      'search-index-page.json',
      'sitemap-0.xml',
      'sitemap-index.xml',
    ]);
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
  const judged = { kinds: ['case'], routes: ['/case-studies'], htmlByRoute: { '/case-studies': NOINDEX }, site: SITE };
  try {
    assert.deepEqual(await collectionGateFailures(dist, judged), []);

    writeFileSync(join(dist, 'case-studies.md'), '# Fractional Chief AI Officer case study');
    assert.deepEqual(await collectionGateFailures(dist, judged), [`/case-studies.md ships but ${because}`]);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
