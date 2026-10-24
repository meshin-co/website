import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { brandFromDisk } from '../src/utils/brand.mjs';
import { CONTENT_SIGNAL } from './gen-headers.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const SITE_ORIGIN = `https://${brandFromDisk().name}`;
const TRAINING_AGENTS = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'CCBot',
  'PerplexityBot',
  'Applebot-Extended',
  'meta-externalagent',
  'Bytespider',
  'Diffbot',
  'cohere-ai',
];
const RETRIEVAL_AGENTS = [
  'OAI-SearchBot',
  'Claude-SearchBot',
  'Claude-User',
  'Perplexity-User',
  'ChatGPT-User',
  'Amazonbot',
  'ImagesiftBot',
  'Timpibot',
  'YouBot',
];
const SEARCH_AGENTS = ['Googlebot', 'Bingbot', 'Applebot'];

export function disallowedPaths(pagesDir) {
  return ['/search', '/styleguide', ...(existsSync(join(pagesDir, 'api')) ? ['/api'] : [])];
}

export function renderRobots(disallowed) {
  const agents = ['*', ...TRAINING_AGENTS, ...RETRIEVAL_AGENTS, ...SEARCH_AGENTS];
  const groups = agents
    .map((agent) =>
      [
        `User-agent: ${agent}`,
        `Content-Signal: ${CONTENT_SIGNAL}`,
        'Allow: /',
        ...disallowed.map((path) => `Disallow: ${path}`),
      ].join('\n')
    )
    .join('\n\n');
  return `${groups}\n\nSitemap: ${SITE_ORIGIN}/sitemap-index.xml\n`;
}

async function main() {
  const siteRoot = fileURLToPath(new URL('..', import.meta.url));
  const disallowed = disallowedPaths(join(siteRoot, 'src', 'pages'));
  await writeFile(join(siteRoot, 'public', 'robots.txt'), renderRobots(disallowed));
  console.log(
    `robots.txt written: ${TRAINING_AGENTS.length + RETRIEVAL_AGENTS.length + SEARCH_AGENTS.length + 1} groups`
  );
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  await main();
}
