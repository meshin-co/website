import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { extractPage } from './content-html.mjs';
import {
  absoluteUrl,
  publicIndexableStaticPages,
  renderSidecar,
  sidecarFileForRoute,
  sidecarRoutes,
} from '../src/utils/machine-text.mjs';
import { siteLastmods } from '../src/utils/sitemap-lastmod.mjs';
import { brandFromDisk } from '../src/utils/brand.mjs';

const SITE_ORIGIN = `https://${brandFromDisk().name}`;

async function routeHtml(distDir, route) {
  const withoutSlash = route.slice(1);
  for (const candidate of [join(distDir, withoutSlash, 'index.html'), join(distDir, `${withoutSlash}.html`)]) {
    const html = await readFile(candidate, 'utf8').catch(() => null);
    if (html !== null) return html;
  }
  return null;
}

const NON_PROSE_BLOCK = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function buildSidecar({ page, html, updatedIso, site = SITE_ORIGIN }) {
  if (!updatedIso) throw new Error(`generate-static-sidecars: no lastmod for ${page.path}`);

  return renderSidecar({
    title: page.title,
    description: page.description,
    updated: new Date(updatedIso),
    body: extractPage(page.path, html.replace(NON_PROSE_BLOCK, '')).text,
    url: absoluteUrl(site, page.path),
  });
}

export function classifyPage({ page, html, updatedIso, site = SITE_ORIGIN }) {
  if (html === null) return { status: 'missing-html', path: page.path };
  if (!updatedIso) return { status: 'skipped-no-lastmod', path: page.path };
  return { status: 'written', path: page.path, sidecar: buildSidecar({ page, html, updatedIso, site }) };
}

export async function main(distDir) {
  const pages = sidecarRoutes();
  const lastmods = await siteLastmods({
    dataDir: 'src/data',
    staticPages: publicIndexableStaticPages(),
    cwd: process.cwd(),
  });

  const missingHtml = [];
  const skipped = [];
  let written = 0;

  for (const page of pages) {
    const html = await routeHtml(distDir, page.path);
    const result = classifyPage({ page, html, updatedIso: lastmods[page.path] });

    if (result.status === 'missing-html') {
      missingHtml.push(result.path);
      continue;
    }
    if (result.status === 'skipped-no-lastmod') {
      skipped.push(result.path);
      continue;
    }

    const target = join(distDir, sidecarFileForRoute(result.path));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, result.sidecar);
    written += 1;
  }

  if (skipped.length > 0) {
    console.warn(
      `generate-static-sidecars: skipped ${skipped.join(', ')} — no lastmod available (expected outside a full git checkout, e.g. mutation-smoke's rsync copy; never defaults to build time)`
    );
  }

  if (missingHtml.length > 0) {
    console.error(`generate-static-sidecars: no built html for ${missingHtml.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`generate-static-sidecars: wrote ${written} sidecar(s) for static pages and hubs`);
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist');
}
