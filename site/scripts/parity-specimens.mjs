import { readdirSync, readFileSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GATE = 'gate:parity';
const SITE_ROOT = join(import.meta.dirname, '..');
const ENTRY_FILE = /\.mdx?$/;
const WITHHELD = /^(?:draft|noindex):\s*true\s*$/m;

function firstLiveEntry(kind) {
  const directory = join(SITE_ROOT, 'src', 'data', kind);
  const live = readdirSync(directory)
    .filter((name) => ENTRY_FILE.test(name))
    .sort()
    .find(
      (name) => !WITHHELD.test(/^---\n([\s\S]*?)\n---/.exec(readFileSync(join(directory, name), 'utf8'))?.[1] ?? '')
    );
  return live.replace(ENTRY_FILE, '');
}

const POST = firstLiveEntry('post');
const POST_ROUTE = '/blog/' + POST;
const MISSING = ' is owed ';

const withoutSitemapEntry = (route) => (text) =>
  text.replace(new RegExp('<url><loc>https?://[^/<]+' + route + '</loc>[\\s\\S]*?</url>'), '');

const withoutFeedItem = (route) => (text) =>
  text.replace(
    new RegExp('<item>(?:(?!</item>)[\\s\\S])*?<guid[^>]*>https?://[^<]+' + route + '</guid>[\\s\\S]*?</item>'),
    ''
  );

const withoutShardEntry = (route) => (text) => JSON.stringify(JSON.parse(text).filter(({ href }) => href !== route));

async function removeBinaryFile(path) {
  const bytes = await readFile(path);
  await rm(path);
  return () => writeFile(path, bytes);
}

const withoutMarkdownLink = (text) => text.replace(/<link\b[^>]*text\/markdown[^>]*>/, '');

export const paritySpecimens = ({ editFile, removeFile }) => ({
  parityStaticPageLosesItsSidecar: {
    gate: GATE,
    token: '/about' + MISSING + 'a markdown sidecar: /about.md did not ship',
    plant: (copySite) => removeFile(join(copySite, 'dist/about.md')),
  },
  parityStaticPageLeavesTheSitemap: {
    gate: GATE,
    token: '/about' + MISSING + 'a sitemap entry with a lastmod: /sitemap-0.xml does not list it',
    plant: (copySite) => editFile(join(copySite, 'dist/sitemap-0.xml'), withoutSitemapEntry('/about')),
  },
  parityEntryLosesItsSocialCard: {
    gate: GATE,
    token:
      POST_ROUTE + MISSING + 'a social card: its og:image /og/post/' + POST + '.png is not a file this build ships',
    plant: (copySite) => removeBinaryFile(join(copySite, 'dist/og/post/' + POST + '.png')),
  },
  parityEntryLeavesItsCollectionFeed: {
    gate: GATE,
    token: POST_ROUTE + MISSING + 'an item in its collection feed: /blog/rss.xml carries no guid for it',
    plant: (copySite) => editFile(join(copySite, 'dist/blog/rss.xml'), withoutFeedItem(POST_ROUTE)),
  },
  parityEntryLosesItsSearchEntry: {
    gate: GATE,
    token: POST_ROUTE + MISSING + 'a search entry: /search-index-post.json holds no entry for it',
    plant: (copySite) => editFile(join(copySite, 'dist/search-index-post.json'), withoutShardEntry(POST_ROUTE)),
  },
  parityEntryLosesItsMarkdownLink: {
    gate: GATE,
    token:
      POST_ROUTE + MISSING + 'a markdown alternate link: its head has no <link rel="alternate" type="text/markdown"',
    plant: (copySite) => editFile(join(copySite, 'dist/blog/' + POST + '.html'), withoutMarkdownLink),
  },
});
