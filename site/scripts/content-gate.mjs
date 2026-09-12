import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { discoverRoutes } from './gate.mjs';
import { extractPage } from './content-html.mjs';
import { judgePage, PROFILES } from './content-rows.mjs';
import { duplicateSentences } from './prose-rules.mjs';

const DUPLICATE_MINIMUM_WORDS = 12;

const UNGATED = new Set(['/404', '/search', '/styleguide']);

const PROFILE_BY_PREFIX = [
  ['/blog/category/', 'page'],
  ['/blog/', 'article'],
  ['/services/', 'offer'],
  ['/resources/', 'offer'],
  ['/case-studies/', 'offer'],
  ['/glossary/', 'term'],
  ['/faq/', 'faq-answer'],
];

export function profileFor(route) {
  for (const [prefix, name] of PROFILE_BY_PREFIX) {
    if (route.startsWith(prefix)) return name;
  }
  return 'page';
}

const routeFile = (route) => (route === '/404' ? '404.html' : join(route.slice(1), 'index.html'));

export async function collectPages(distDir) {
  const routes = await discoverRoutes(distDir);
  const pages = [];

  for (const route of routes) {
    if (UNGATED.has(route)) continue;
    const html = await readFile(join(distDir, routeFile(route)), 'utf8');
    pages.push({ ...extractPage(route, html), profile: profileFor(route) });
  }

  return pages;
}

export function gateFindings(pages, facts, bannedPhrases) {
  const findings = pages.flatMap((page) => judgePage(page, PROFILES[page.profile], facts, bannedPhrases));

  const prose = pages.map((page) => ({
    route: page.route,
    text: [page.lead, ...page.paragraphs].filter(Boolean).join(' '),
  }));

  for (const duplicate of duplicateSentences(prose, DUPLICATE_MINIMUM_WORDS)) {
    findings.push({
      route: duplicate.routes.join(' + '),
      rule: 'duplicate-sentence',
      excerpt: duplicate.sentence.slice(0, 90),
      detail: `${duplicate.routes.length} routes`,
    });
  }

  return findings;
}

async function main(distDir) {
  const facts = JSON.parse(await readFile('content-facts.json', 'utf8'));
  const bannedPhrases = JSON.parse(await readFile('banned-phrases.json', 'utf8'));

  const pages = await collectPages(distDir);
  const findings = gateFindings(pages, facts, bannedPhrases);

  const byRule = new Map();
  for (const finding of findings) byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1);

  console.log(`content: ${pages.length} pages gated`);
  for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1])) console.log(`  ${rule}: ${count}`);
  for (const finding of findings)
    console.log(`${finding.route} ${finding.rule} [${finding.detail}] ${finding.excerpt}`);

  if (findings.length > 0) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist');
}
