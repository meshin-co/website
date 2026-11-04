import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { KINDS, buildShardEntry } from '../public/search/shards.mjs';
import { extractPage } from './content-html.mjs';
import { brandFromDisk, titleSuffix } from '../src/utils/brand.mjs';

const TITLE_SUFFIX = titleSuffix(brandFromDisk());

const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

const distFile = (href) => (href === '/' ? 'index.html' : `${href.slice(1)}.html`);

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

const needsDerivation = (entry) => entry.kind === KINDS.page.label && entry.text === '';

export async function fillPageText(distDir, entries) {
  const derivedCount = entries.filter(needsDerivation).length;
  const filled = await Promise.all(
    entries.map((entry) => (needsDerivation(entry) ? deriveEntry(distDir, entry) : entry))
  );

  return { entries: filled, derivedCount };
}
