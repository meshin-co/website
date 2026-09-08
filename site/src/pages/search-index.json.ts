import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { buildIndexEntry } from '../../public/search/index-model.mjs';

export const prerender = true;

const SOURCES = [
  { collection: 'post', base: 'blog', kind: 'Writing' },
  { collection: 'service', base: 'services', kind: 'Service' },
  { collection: 'resource', base: 'resources', kind: 'Resource' },
  { collection: 'glossary', base: 'glossary', kind: 'Glossary' },
  { collection: 'case', base: 'case-studies', kind: 'Case study' },
] as const;

const PAGES = [
  {
    href: '/',
    title: 'Fractional Chief AI Officer',
    description: 'AI leadership you can name on the org chart.',
    kind: 'Page',
  },
  {
    href: '/approach',
    title: 'How I work',
    description: 'The six things that decide whether an AI initiative reaches production.',
    kind: 'Page',
  },
  {
    href: '/pricing',
    title: 'Pricing',
    description: 'Assessment, sprint and retainer prices, with the billing terms.',
    kind: 'Page',
  },
  {
    href: '/about',
    title: 'About Dmitri Meshin',
    description: 'Platform engineer working as a Fractional Chief AI Officer.',
    kind: 'Page',
  },
  {
    href: '/faq',
    title: 'Questions and answers',
    description: 'What each offer produces and how AI risk gets signed off.',
    kind: 'Page',
  },
  {
    href: '/ai-policy',
    title: 'AI acceptable use policy',
    description: 'My own policy: which data may reach which vendor, and who decides.',
    kind: 'Page',
  },
  {
    href: '/security',
    title: 'Security',
    description: 'How this site is built and how client data is handled.',
    kind: 'Page',
  },
  {
    href: '/now',
    title: 'Now',
    description: 'What I am working on this month and what capacity is free.',
    kind: 'Page',
  },
  { href: '/speaking', title: 'Speaking', description: 'Talks and podcast appearances.', kind: 'Page' },
];

type LiveEntry = { data: { draft?: boolean; noindex?: boolean } };

const isLive = ({ data }: LiveEntry) => !data.draft && !data.noindex;

export const GET: APIRoute = async () => {
  const entries = [...PAGES.map((page) => buildIndexEntry({ ...page, body: '' }))];

  for (const { collection, base, kind } of SOURCES) {
    for (const entry of await getCollection(collection, isLive)) {
      entries.push(
        buildIndexEntry({
          href: `/${base}/${entry.id}`,
          title: entry.data.title,
          description: entry.data.description,
          kind,
          body: entry.body ?? '',
        })
      );
    }
  }

  return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
