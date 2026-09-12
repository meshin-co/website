import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

import { SITE } from 'astrowind:config';
import { absoluteUrl, renderLlmsCollection } from '~/utils/machine-text.mjs';
import { COLLECTION_NAMES, LLMS_COLLECTIONS, toLlmsEntry } from '~/utils/llms-collections.mjs';

export const prerender = true;

const toProps =
  (site: string) =>
  ({ name, base, title }: (typeof LLMS_COLLECTIONS)[number]) =>
    getCollection(name as Parameters<typeof getCollection>[0]).then((entries) => ({
      params: { collection: name },
      props: {
        title,
        entries: entries.map(toLlmsEntry()).map((entry) => ({
          title: entry.title,
          url: absoluteUrl(site, `${base}/${entry.id}`),
          summary: entry.description,
          body: entry.body,
          updated: entry.updated,
        })),
      },
    }));

export const getStaticPaths: GetStaticPaths = async () =>
  Promise.all(LLMS_COLLECTIONS.map(toProps(import.meta.env.SITE.replace(/\/$/, ''))));

export const GET: APIRoute = ({ props }) =>
  new Response(renderLlmsCollection({ site: SITE.name, title: props.title, entries: props.entries }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
