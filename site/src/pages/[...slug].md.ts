import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

import { absoluteUrl, renderSidecar } from '~/utils/machine-text.mjs';

export const prerender = true;

const BASES = {
  post: 'blog',
  service: 'services',
  resource: 'resources',
  glossary: 'glossary',
  case: 'case-studies',
} as const;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = [];
  for (const [collection, base] of Object.entries(BASES)) {
    const entries = await getCollection(collection as keyof typeof BASES, isLive);
    for (const entry of entries) {
      paths.push({
        params: { slug: `${base}/${entry.id}` },
        props: {
          title: entry.data.title,
          description: entry.data.description,
          updated: entry.data.updatedDate ?? entry.data.publishDate,
          body: entry.body ?? '',
          path: `/${base}/${entry.id}`,
        },
      });
    }
  }
  return paths;
};

export const GET: APIRoute = async ({ props }) => {
  const site = import.meta.env.SITE.replace(/\/$/, '');
  const body = renderSidecar({
    title: props.title,
    description: props.description,
    updated: props.updated,
    body: props.body,
    url: absoluteUrl(site, props.path),
  });

  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
