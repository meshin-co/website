import { getCollection } from 'astro:content';

import { SITE } from 'astrowind:config';
import { absoluteUrl, renderLlmsFull } from '~/utils/machine-text.mjs';
import { LLMS_COLLECTIONS, toLlmsEntry } from '~/utils/llms-collections.mjs';

export const prerender = true;

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

export const GET = async () => {
  const site = import.meta.env.SITE.replace(/\/$/, '');

  const sections = [];
  for (const { name, base, title } of LLMS_COLLECTIONS) {
    const entries = await getCollection(name as Parameters<typeof getCollection>[0], isLive);
    const mapped = entries.map(toLlmsEntry()).map((entry) => ({
      title: entry.title,
      url: absoluteUrl(site, `${base}/${entry.id}`),
      summary: entry.description,
      body: entry.body,
      updated: entry.updated,
    }));
    sections.push({ title, entries: mapped });
  }

  return new Response(renderLlmsFull({ site: SITE.name, sections }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
