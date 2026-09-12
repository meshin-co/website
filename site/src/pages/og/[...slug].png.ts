import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { METADATA } from 'astrowind:config';

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

import { findOgCacheDir, ogCacheKey, readOgImage, writeOgImage } from '~/utils/og-cache.mjs';
import { pickFontFile, readFontNames } from '~/utils/font-file.mjs';
import { buildOgTree } from '~/utils/og-template.mjs';

type OgProps = { title: string; eyebrow?: string; footer?: string; cacheKey: string };

const COLLECTIONS = ['post', 'service', 'resource', 'glossary', 'case'] as const;
const FONT_DIRS = ['src/assets/fonts', 'node_modules/.astro/fonts', '.astro/fonts'];

function loadFontFiles() {
  const files = [];
  for (const dir of FONT_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!/\.(ttf|otf)$/i.test(name)) continue;
      const data = readFileSync(join(dir, name));
      files.push({ path: join(dir, name), data, names: readFontNames(data) });
    }
  }
  return files;
}

function findFont(files: ReturnType<typeof loadFontFiles>, family: string, style: string): Buffer {
  const match = pickFontFile(files, family, style);
  if (!match)
    throw new Error(
      `No ${family} ${style} TTF/OTF on disk under ${FONT_DIRS.join(', ')}. Astro caches .woff2 only unless the font entry declares formats: ['woff2', 'ttf'], and satori cannot read WOFF2.`
    );
  return match.data;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const defaultTitle = METADATA.title?.default ?? 'meshin.co';
  const paths: { params: { slug: string }; props: OgProps }[] = [
    {
      params: { slug: 'default' },
      props: {
        title: defaultTitle,
        footer: METADATA.description,
        cacheKey: ogCacheKey({ collection: 'default', id: 'default', title: defaultTitle }),
      },
    },
  ];
  for (const collection of COLLECTIONS) {
    const entries = await getCollection(collection, ({ data }) => !data.draft && !data.noindex);
    for (const entry of entries) {
      paths.push({
        params: { slug: `${collection}/${entry.id}` },
        props: {
          title: entry.data.title,
          eyebrow: collection,
          footer: entry.data.description,
          cacheKey: ogCacheKey({
            collection,
            id: entry.id,
            title: entry.data.title,
            updatedDate: entry.data.updatedDate,
          }),
        },
      });
    }
  }
  return paths;
};

const PNG_HEADERS = { 'Content-Type': 'image/png' } as const;

export const GET: APIRoute<OgProps> = async ({ params, props }) => {
  const slug = String(params.slug);
  const cacheDir = findOgCacheDir();
  const cached = readOgImage(cacheDir, slug, props.cacheKey);
  if (cached) return new Response(new Uint8Array(cached), { headers: PNG_HEADERS });

  const files = loadFontFiles();
  const fonts = [
    { name: 'Fraunces', data: findFont(files, 'Fraunces', 'SemiBold'), weight: 600 as const, style: 'normal' as const },
    {
      name: 'IBM Plex Sans',
      data: findFont(files, 'IBM Plex Sans', 'Regular'),
      weight: 400 as const,
      style: 'normal' as const,
    },
  ];
  const tree = buildOgTree({ title: props.title, eyebrow: props.eyebrow ?? '', footer: props.footer ?? '' });
  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg).render().asPng();
  writeOgImage(cacheDir, slug, props.cacheKey, png);
  return new Response(new Uint8Array(png), { headers: PNG_HEADERS });
};
