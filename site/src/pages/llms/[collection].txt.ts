import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

import { SITE } from 'astrowind:config';
import { absoluteUrl } from '~/utils/machine-text.mjs';
import { LLMS_COLLECTIONS, llmsCollectionFiles, toLlmsEntry } from '~/utils/llms-collections.mjs';

export const prerender = true;

const toPaths = async ({ name, base, title }: (typeof LLMS_COLLECTIONS)[number]) => {
  const origin = import.meta.env.SITE.replace(/\/$/, '');
  const entries = (await getCollection(name as Parameters<typeof getCollection>[0]))
    .map(toLlmsEntry())
    .map((entry) => ({
      ...entry,
      url: absoluteUrl(origin, `${base}/${entry.id}`),
      summary: entry.description,
    }));
  if (!entries.some((entry) => !entry.draft && !entry.noindex)) return [];
  return llmsCollectionFiles({ site: SITE.name, origin, name, title, entries }).map(({ param, text }) => ({
    params: { collection: param },
    props: { text },
  }));
};

export const getStaticPaths: GetStaticPaths = async () => (await Promise.all(LLMS_COLLECTIONS.map(toPaths))).flat();

export const GET: APIRoute = ({ props }) =>
  new Response(props.text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
