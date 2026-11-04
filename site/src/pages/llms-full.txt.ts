import { getCollection } from 'astro:content';

import { SITE } from 'astrowind:config';
import { absoluteUrl, renderLlmsFull } from '~/utils/machine-text.mjs';
import { LLMS_COLLECTIONS, LLMS_FILE_MAX_BYTES, llmsCollectionPointers } from '~/utils/llms-collections.mjs';

export const prerender = true;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

export const GET = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');

  const entryCounts: Record<string, number> = {};
  for (const { name } of LLMS_COLLECTIONS) {
    entryCounts[name] = (await getCollection(name as Parameters<typeof getCollection>[0], isLive)).length;
  }

  const pointers = llmsCollectionPointers(entryCounts).map((pointer) => ({
    ...pointer,
    url: absoluteUrl(site, pointer.url),
  }));

  return new Response(renderLlmsFull({ site: SITE.name, maxFileBytes: LLMS_FILE_MAX_BYTES, pointers }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
