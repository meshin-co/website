import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

import { COLLECTION_OF, RESOURCE_COLLECTION } from './entry-prose.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { WriterError } from './writer-error.mjs';

export const DATA_DIRECTORY = readEngineConfig().content.dataDirectory;
const TAGS_FILE = `${DATA_DIRECTORY}/tags.mjs`;
const ROUTES_FILE = 'audits/routes.json';

export const REPO_FILES = {
  bannedPhrases: 'site/banned-phrases.json',
  contentFacts: 'site/content-facts.json',
  controlledWords: 'site/controlled-words.json',
  routes: ROUTES_FILE,
  tags: TAGS_FILE,
  collections: Object.fromEntries(
    [COLLECTION_OF.article, COLLECTION_OF.term, RESOURCE_COLLECTION].map((name) => [name, `${DATA_DIRECTORY}/${name}`])
  ),
};
const TAG_SLUG = /\bslug:\s*'([^']+)'/g;
const MARKDOWN = '.md';

export const sha256Of = (content) => createHash('sha256').update(content).digest('hex');

function inside(repoRoot, path) {
  const resolved = join(repoRoot, path);
  if (isAbsolute(path) || relative(repoRoot, resolved).startsWith('..'))
    throw new WriterError('config', `${path} is outside the repository root`);
  return resolved;
}

export function readText(repoRoot, path) {
  const resolved = inside(repoRoot, path);
  try {
    return readFileSync(resolved, 'utf8');
  } catch {
    throw new WriterError('config', `${path} does not exist or cannot be read`);
  }
}

export function listing(repoRoot, directory) {
  const resolved = inside(repoRoot, directory);
  try {
    return readdirSync(resolved)
      .filter((name) => name.endsWith(MARKDOWN))
      .map((name) => name.slice(0, -MARKDOWN.length))
      .sort();
  } catch {
    throw new WriterError('config', `${directory} does not exist or cannot be listed`);
  }
}

export function tagSlugs(repoRoot) {
  const slugs = [...readText(repoRoot, TAGS_FILE).matchAll(TAG_SLUG)].map(([, slug]) => slug);
  if (slugs.length === 0) throw new WriterError('config', `${TAGS_FILE}: no tag slug found`);
  return slugs;
}

export function routeList(repoRoot) {
  const unreadable = new WriterError('config', `${ROUTES_FILE} is not a non-empty list of route strings`);
  let routes;
  try {
    routes = JSON.parse(readText(repoRoot, ROUTES_FILE));
  } catch (error) {
    if (error instanceof WriterError) throw error;
    throw unreadable;
  }
  if (!Array.isArray(routes) || routes.length === 0 || !routes.every((route) => typeof route === 'string'))
    throw unreadable;
  return routes;
}
