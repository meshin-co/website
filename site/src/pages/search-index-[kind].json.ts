import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';

import { archiveTitleOf, categoryPillars } from '~/data/categories.mjs';
import { artifactIds, drivers, hero, shift, signals } from '~/data/home';
import { TAGS, tagArchive } from '~/data/tags.mjs';
import { FEED_BASES, isLive, isPublished } from '~/utils/feeds.mjs';
import { LLMS_COLLECTIONS } from '~/utils/llms-collections.mjs';
import { collectionHubs, publicIndexableStaticPages } from '~/utils/machine-text.mjs';
import { buildShardEntry, KINDS, words } from '../../public/search/shards.mjs';

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

const HOME_BODY_WITHOUT_SERVICES = [
  hero.sub,
  hero.proof.join(' '),
  ...signals.items,
  signals.verdict,
  ...drivers.map(({ name, detail }) => `${name} ${detail}`),
  ...shift.before.items,
  ...shift.after.items,
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
        faq: entry.data.faq,
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
    const [author, posts, faqEntries, serviceEntries, resourceEntries] = await Promise.all([
      getEntry('author', 'dmitri'),
      getCollection('post', isLive),
      getCollection('faq', isLive),
      getCollection('service', isPublished),
      getCollection('resource', ({ data }) => !data.draft),
    ]);

    const homeBody = words([
      ...HOME_BODY_WITHOUT_SERVICES,
      ...serviceEntries.flatMap(({ data }) => [data.name, data.tagline, ...data.deliverables]),
      ...artifactIds.flatMap((id) => {
        const entry = resourceEntries.find((candidate) => candidate.id === id);
        return entry ? [entry.data.name, entry.data.description] : [];
      }),
    ]);

    const aboutBody = author ? words([author.data.role, author.data.bio, author.data.credentials.join(' ')]) : '';

    const faqBody = words(faqEntries.map((entry) => entry.data.question));

    const tagCounts = new Map<string, number>();
    for (const post of posts) {
      for (const tag of post.data.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const liveTags = TAGS.filter((tag) => (tagCounts.get(tag.slug) ?? 0) > 0);
    const blogTagsBody = words(liveTags.map((tag) => tag.name));

    const liveCategorySlugs = new Set<string>(posts.map((post) => post.data.category));

    const staticPageBodyFromSource: Record<string, string> = {
      '/': homeBody,
      '/about': aboutBody,
      '/faq': faqBody,
      '/blog/tags': blogTagsBody,
    };

    const staticPages = publicIndexableStaticPages();

    const staticPageEntries = staticPages.map((page) =>
      buildShardEntry('page', {
        href: page.path,
        title: page.title,
        description: page.description,
        body: staticPageBodyFromSource[page.path] ?? '',
      })
    );

    const hubEntries = collectionHubs({
      collections: LLMS_COLLECTIONS,
      staticPaths: staticPages.map((page) => page.path),
    }).map(({ base }: { base: string }) =>
      buildShardEntry('page', { href: base, title: '', description: '', body: '' })
    );

    const categoryEntries = Object.entries(categoryPillars)
      .filter(([slug]) => liveCategorySlugs.has(slug))
      .map(([slug, pillar]) =>
        buildShardEntry('page', {
          href: `/blog/category/${slug}`,
          title: archiveTitleOf(pillar),
          description: pillar.description,
          body: pillar.body.join(' '),
        })
      );

    const tagEntries = liveTags.map((tag) => {
      const archive = tagArchive(tag);
      return buildShardEntry('page', {
        href: `/blog/tag/${tag.slug}`,
        title: archive.title,
        description: archive.description,
        body: archive.description,
      });
    });

    return [...staticPageEntries, ...hubEntries, ...categoryEntries, ...tagEntries];
  },
};

export const GET: APIRoute = async ({ params }) => {
  const build = shardBuilders[params.kind ?? ''];
  if (!build) return new Response('unknown search shard', { status: 404 });

  return new Response(JSON.stringify(await build()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
