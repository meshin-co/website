import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig, fontProviders } from 'astro/config';

import { unified } from '@astrojs/markdown-remark';

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import icon from 'astro-icon';
import compress from 'astro-compress';
import expressiveCode from 'astro-expressive-code';

import astrowind from './vendor/integration';

import { readingTimeRemarkPlugin } from './src/utils/frontmatter';
import { rehypeExternalLinks, rehypeHeadingAnchors, rehypeScrollableTables } from './src/utils/pipeline.mjs';
import { collectionLastmods } from './src/utils/sitemap-lastmod.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LASTMODS = (await collectionLastmods(path.resolve(__dirname, 'src/data'))) as Record<string, string>;

export default defineConfig({
  output: 'static',
  trailingSlash: 'never',

  build: {
    inlineStylesheets: 'never',
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      weights: ['600', '700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-plex-sans',
      weights: ['400', '500'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: ['700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],

  integrations: [
    sitemap({
      filter: (page) => !/\/blog\/tag\/|\/styleguide|\/search/.test(page),
      serialize: (item) => {
        const route = new URL(item.url).pathname.replace(/\/$/, '');
        const modified = LASTMODS[route];
        return modified ? ({ ...item, lastmod: new Date(modified) } as unknown as typeof item) : item;
      },
    }),
    expressiveCode({
      themes: ['github-light', 'github-dark'],
      styleOverrides: { borderRadius: '0', frames: { shadowColor: 'transparent' } },
    }),
    mdx(),
    icon({
      iconDir: 'src/assets/icons',
      include: {
        tabler: ['*'],
      },
    }),

    compress({
      // csso off on purpose: its parser doesn't understand the media range
      // syntax Tailwind v4 emits for breakpoints (`@media (width>=48rem)`) and
      // silently drops every one of those blocks — the site then renders as if
      // all `md:`/`lg:` classes were missing. lightningcss parses it correctly.
      CSS: { csso: false, lightningcss: { minify: true } },
      HTML: {
        'html-minifier-terser': {
          removeAttributeQuotes: false,
          collapseBooleanAttributes: true,
          decodeEntities: false,
        },
      },
      Image: false,
      JavaScript: true,
      SVG: false,
      Logger: 1,
    }),

    astrowind({
      config: './src/config.yaml',
    }),
  ],

  image: {
    responsiveStyles: true,
  },

  markdown: {
    processor: unified({
      remarkPlugins: [readingTimeRemarkPlugin],
      rehypePlugins: [rehypeScrollableTables, rehypeHeadingAnchors, rehypeExternalLinks],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
  },
});
