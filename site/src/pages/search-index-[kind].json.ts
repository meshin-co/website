import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';

import { artifacts, drivers, hero, services, shift, signals } from '~/data/home';
import { FEED_BASES, isLive } from '~/utils/feeds.mjs';
import { buildShardEntry, KINDS } from '../../public/search/shards.mjs';

export const prerender = true;

export function getStaticPaths(): { params: { kind: string } }[] {
  return Object.keys(KINDS).map((kind) => ({ params: { kind } }));
}

interface ShardEntry {
  href: string;
  title: string;
  description: string;
  kind: string;
  text: string;
}

const homeBody = [
  hero.sub,
  hero.proof.join(' '),
  ...signals.items,
  signals.verdict,
  ...services.flatMap(({ name, outcome, deliverables }) => [name, outcome, ...deliverables]),
  ...drivers.map(({ name, detail }) => `${name} ${detail}`),
  ...shift.before.items,
  ...shift.after.items,
  ...artifacts.map(({ name, summary }) => `${name} ${summary}`),
].join(' ');

const PAGES = [
  {
    href: '/',
    title: 'Fractional Chief AI Officer',
    description: 'AI leadership you can name on the org chart.',
    body: homeBody,
  },
  {
    href: '/approach',
    title: 'How I work',
    description: 'The six things that decide whether an AI initiative reaches production.',
    body: '',
  },
  {
    href: '/pricing',
    title: 'Pricing',
    description: 'Assessment, sprint and retainer prices, with the billing terms.',
    body: '',
  },
  {
    href: '/about',
    title: 'About Dmitri Meshin',
    description: 'Platform engineer working as a Fractional Chief AI Officer.',
    body: '',
  },
  {
    href: '/faq',
    title: 'Questions and answers',
    description: 'What each offer produces and how AI risk gets signed off.',
    body: '',
  },
  {
    href: '/ai-policy',
    title: 'AI acceptable use policy',
    description: 'My own policy: which data may reach which vendor, and who decides.',
    body: '',
  },
  {
    href: '/security',
    title: 'Security',
    description: 'How this site is built and how client data is handled.',
    body: '',
  },
  { href: '/now', title: 'Now', description: 'What I am working on this month and what capacity is free.', body: '' },
];

const shardBuilders: Record<string, () => Promise<ShardEntry[]>> = {
  post: async () =>
    (await getCollection('post', isLive)).map((entry) =>
      buildShardEntry('post', {
        href: `/${FEED_BASES.post}/${entry.id}`,
        title: entry.data.title,
        description: entry.data.description,
        body: entry.body ?? '',
        keyTakeaways: entry.data.keyTakeaways,
        fullAnswer: entry.data.fullAnswer,
      })
    ),
  glossary: async () =>
    (await getCollection('glossary', isLive)).map((entry) =>
      buildShardEntry('glossary', {
        href: `/${FEED_BASES.glossary}/${entry.id}`,
        title: entry.data.title,
        description: entry.data.description,
        body: entry.body ?? '',
        shortDefinition: entry.data.shortDefinition,
        definition: entry.data.definition,
      })
    ),
  resource: async () =>
    (await getCollection('resource', isLive)).map((entry) =>
      buildShardEntry('resource', {
        href: `/${FEED_BASES.resource}/${entry.id}`,
        title: entry.data.title,
        description: entry.data.description,
        body: entry.body ?? '',
      })
    ),
  service: async () =>
    (await getCollection('service', isLive)).map((entry) =>
      buildShardEntry('service', {
        href: `/${FEED_BASES.service}/${entry.id}`,
        title: entry.data.title,
        description: entry.data.description,
        body: entry.body ?? '',
        shortAnswer: entry.data.shortAnswer,
        deliverables: entry.data.deliverables,
        faq: entry.data.faq,
      })
    ),
  case: async () =>
    (await getCollection('case', isLive)).map((entry) =>
      buildShardEntry('case', {
        href: `/${FEED_BASES.case}/${entry.id}`,
        title: entry.data.title,
        description: entry.data.description,
        body: entry.body ?? '',
        problem: entry.data.problem,
        approach: entry.data.approach,
        outcome: entry.data.outcome,
      })
    ),
  faq: async () =>
    (await getCollection('faq', isLive)).map((entry) =>
      buildShardEntry('faq', {
        href: `/${FEED_BASES.faq}/${entry.id}`,
        question: entry.data.question,
        answer: entry.data.answer,
      })
    ),
  page: async () => {
    const author = await getEntry('author', 'dmitri');
    const aboutBody = author ? [author.data.role, author.data.bio, author.data.credentials.join(' ')].join(' ') : '';
    return PAGES.map((page) => buildShardEntry('page', page.href === '/about' ? { ...page, body: aboutBody } : page));
  },
};

export const GET: APIRoute = async ({ params }) => {
  const build = shardBuilders[params.kind ?? ''];
  if (!build) return new Response('unknown search shard', { status: 404 });

  return new Response(JSON.stringify(await build()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
