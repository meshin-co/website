import { isHolding, originOf } from './autowriter-claims.mjs';
import { ENGINE_CONFIG_FILE, EngineConfigError, readEngineConfig } from './engine-config.mjs';
import { entryRoute } from './entry-files.mjs';
import { CATEGORIES } from './entry-limits.mjs';
import { COLLECTION_OF, parseEntrySource } from './entry-prose.mjs';
import { WriterError } from './writer-error.mjs';
import { REPO_FILES, listing, readText } from './writer-tree.mjs';

const POSTS_DIRECTORY = REPO_FILES.collections[COLLECTION_OF.article];
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}/;

export function checkedRotation(rotation) {
  const problems = rotation.flatMap((id, at) =>
    CATEGORIES.includes(id)
      ? []
      : [
          {
            path: `$.loop.categoryRotation[${at}]`,
            problem: `${JSON.stringify(id)} is not a category (the categories are ${CATEGORIES.join(', ')})`,
          },
        ]
  );
  if (problems.length > 0) throw new EngineConfigError(ENGINE_CONFIG_FILE, problems);
  return rotation;
}

export const CATEGORY_ROTATION = checkedRotation(readEngineConfig().loop.categoryRotation);

function targetQueries(repoRoot) {
  const path = REPO_FILES.contentFacts;
  const text = readText(repoRoot, path);
  try {
    return JSON.parse(text).targetQuery ?? {};
  } catch {
    throw new WriterError('config', `${path} is not valid JSON`);
  }
}

function frontmatterOf(repoRoot, path) {
  try {
    return parseEntrySource(readText(repoRoot, path)).frontmatter;
  } catch (error) {
    if (error instanceof WriterError) throw error;
    throw new WriterError('config', `${path}: ${error.message}`);
  }
}

const dayOf = (value) => (typeof value === 'string' && CALENDAR_DAY.test(value) ? value.slice(0, 10) : null);

export function readPublishedPosts(repoRoot) {
  const queries = targetQueries(repoRoot);
  return listing(repoRoot, POSTS_DIRECTORY).map((slug) => {
    const frontmatter = frontmatterOf(repoRoot, `${POSTS_DIRECTORY}/${slug}.md`);
    const route = entryRoute({ format: 'article', slug });
    return {
      slug,
      route,
      title: String(frontmatter.title ?? ''),
      query: queries[route] ?? null,
      category: frontmatter.category ?? null,
      publishDate: dayOf(frontmatter.publishDate),
    };
  });
}

function articlesBySlug({ posts, claims, now }) {
  const articles = new Map(posts.map(({ slug, category, publishDate }) => [slug, { category, day: publishDate }]));
  for (const { claim } of claims) {
    if (originOf(claim) !== 'category' || !isHolding(claim, now) || articles.has(claim.slug)) continue;
    articles.set(claim.slug, { category: claim.category, day: claim.claimedAt.slice(0, 10) });
  }
  return [...articles.values()];
}

const latest = (days) => days.reduce((newest, day) => (newest === null || day > newest ? day : newest), null);

export function categoryStandings({ rotation, posts, claims, now }) {
  const articles = articlesBySlug({ posts, claims, now });
  return rotation.map((category) => {
    const own = articles.filter((article) => article.category === category);
    return { category, articles: own.length, newest: latest(own.map(({ day }) => day).filter((day) => day !== null)) };
  });
}

const olderFirst = (first, second) => {
  if (first === second) return 0;
  if (first === null) return -1;
  if (second === null) return 1;
  return first < second ? -1 : 1;
};

export function rotationOrder(input) {
  return categoryStandings(input)
    .map((standing, configured) => ({ ...standing, configured }))
    .sort(
      (first, second) =>
        first.articles - second.articles ||
        olderFirst(first.newest, second.newest) ||
        first.configured - second.configured
    )
    .map(({ category }) => category);
}
