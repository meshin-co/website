import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SITE_ORIGIN = 'https://meshin.co';
const TRAINING_AGENTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'PerplexityBot'];
const RETRIEVAL_AGENTS = ['OAI-SearchBot', 'Claude-SearchBot', 'Claude-User', 'Perplexity-User'];

export function disallowedPaths(pagesDir) {
  return ['/search', '/styleguide', ...(existsSync(join(pagesDir, 'api')) ? ['/api'] : [])];
}

export function renderRobots(disallowed) {
  const agents = ['*', ...TRAINING_AGENTS, ...RETRIEVAL_AGENTS];
  const groups = agents
    .map((agent) => [`User-agent: ${agent}`, 'Allow: /', ...disallowed.map((path) => `Disallow: ${path}`)].join('\n'))
    .join('\n\n');
  return `${groups}\n\nSitemap: ${SITE_ORIGIN}/sitemap-index.xml\n`;
}

async function main() {
  const siteRoot = fileURLToPath(new URL('..', import.meta.url));
  const disallowed = disallowedPaths(join(siteRoot, 'src', 'pages'));
  await writeFile(join(siteRoot, 'public', 'robots.txt'), renderRobots(disallowed));
  console.log(`robots.txt written: ${TRAINING_AGENTS.length + RETRIEVAL_AGENTS.length + 1} groups`);
}

if (import.meta.filename === process.argv[1]) {
  await main();
}
