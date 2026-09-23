import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildShardEntry } from '../public/search/shards.mjs';
import { extractPage } from './content-html.mjs';
import { brandFromDisk, titleSuffix } from '../src/utils/brand.mjs';

const PAGE_SHARD = 'search-index-page.json';
const TITLE_SUFFIX = titleSuffix(brandFromDisk());

const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

const distFile = (href) => (href === '/' ? 'index.html' : join(href.slice(1), 'index.html'));

async function readRouteHtml(distDir, href) {
  try {
    return await readFile(join(distDir, distFile(href)), 'utf8');
  } catch (cause) {
    throw new Error(`search-page-text: no built page for search entry "${href}"`, { cause });
  }
}

function titleFrom(html) {
  const raw = decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '');
  return raw.endsWith(TITLE_SUFFIX) ? raw.slice(0, -TITLE_SUFFIX.length) : raw;
}

function descriptionFrom(html) {
  const tag = /<meta[^>]*name="description"[^>]*>/.exec(html)?.[0] ?? '';
  return decode(/content="([^"]*)"/.exec(tag)?.[1] ?? '');
}

export async function deriveEntry(distDir, entry) {
  const html = await readRouteHtml(distDir, entry.href);
  const needsHead = entry.description === '' && entry.text === '';

  return buildShardEntry('page', {
    href: entry.href,
    title: needsHead ? titleFrom(html) : entry.title,
    description: needsHead ? descriptionFrom(html) : entry.description,
    body: extractPage(entry.href, html).text,
  });
}

export async function fillPageShardText(distDir) {
  const shardPath = join(distDir, PAGE_SHARD);
  const entries = JSON.parse(await readFile(shardPath, 'utf8'));
  const derivedCount = entries.filter((entry) => entry.text === '').length;

  const filled = await Promise.all(entries.map((entry) => (entry.text === '' ? deriveEntry(distDir, entry) : entry)));

  await writeFile(shardPath, JSON.stringify(filled));
  return { entries: filled, derivedCount };
}

async function main(distDir) {
  const { entries, derivedCount } = await fillPageShardText(distDir);
  console.log(`search-page-text: derived ${derivedCount} of ${entries.length} page entries from dist`);
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist');
}
