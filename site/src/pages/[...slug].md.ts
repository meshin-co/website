import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

import { teaser } from '~/utils/faq-meta.mjs';
import { absoluteUrl, renderSidecar } from '~/utils/machine-text.mjs';
import {
  citationMarkdown,
  groupSeries,
  seriesDescription,
  seriesLabel,
  seriesSidecarBody,
  specCitation,
} from '~/utils/spec-series.mjs';

export const prerender = true;

const BASES = {
  post: 'blog',
  service: 'services',
  resource: 'resources',
  glossary: 'glossary',
  case: 'case-studies',
  faq: 'faq',
  spec: 'spec',
} as const;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

export const getStaticPaths: GetStaticPaths = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');
  const paths = [];
  for (const [collection, base] of Object.entries(BASES)) {
    const entries = await getCollection(collection as keyof typeof BASES, isLive);
    for (const entry of entries) {
      const cited = 'citeAs' in entry.data ? `${citationMarkdown(specCitation({ ...entry.data, site }))}\n` : '';
      paths.push({
        params: { slug: `${base}/${entry.id}` },
        props: {
          title: 'question' in entry.data ? entry.data.question : entry.data.title,
          description: 'answer' in entry.data ? teaser(entry.data.answer) : entry.data.description,
          updated: entry.data.updatedDate ?? entry.data.publishDate,
          body: 'answer' in entry.data ? entry.data.answer : `${cited}${entry.body ?? ''}`,
          path: `/${base}/${entry.id}`,
        },
      });
    }
  }
  for (const series of groupSeries(await getCollection('spec', isLive))) {
    paths.push({
      params: { slug: `${BASES.spec}/${series.name}` },
      props: {
        title: seriesLabel(series.name),
        description: seriesDescription(series.name),
        updated: new Date(series.updated),
        body: seriesSidecarBody({ site, series }),
        path: `/${BASES.spec}/${series.name}`,
      },
    });
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
