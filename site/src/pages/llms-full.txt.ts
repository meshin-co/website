import { getCollection } from 'astro:content';

import { SITE } from 'astrowind:config';
import { absoluteUrl, renderLlmsIndex } from '~/utils/machine-text.mjs';
import { COLLECTION_NAMES, LLMS_COLLECTIONS, latestUpdated, toLlmsEntry } from '~/utils/llms-collections.mjs';

export const prerender = true;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

export const GET = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');

  const files = [];
  for (const { name, base, title, file } of LLMS_COLLECTIONS) {
    const entries = await getCollection(name as Parameters<typeof getCollection>[0], isLive);
    const mapped = entries.map(toLlmsEntry());
    files.push({
      title: `${title} — full text`,
      url: absoluteUrl(site, file),
      count: mapped.length,
      updated: latestUpdated(mapped),
    });
  }

  return new Response(renderLlmsIndex({ site: SITE.name, files }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
