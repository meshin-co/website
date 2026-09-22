import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

import { authoredRoutesOnly, groupByConcept, indexableOnly, orphanEntities, renderGaps } from './editorial-gaps.mjs';
import { conceptRegister, entityRegister, prosePassages, undefinedConceptFindings } from './registers.mjs';

const LEDGER = '../audits/phase-4.7/inventory.json';
const CORE = '../docs/SEMANTIC-CORE.md';
const OUT = '../audits/phase-4.7/gaps.md';

const pageOf = (dist, route) => {
  const nested = join(dist, route === '/' ? 'index.html' : join(route.slice(1), 'index.html'));
  return readFileSync(existsSync(nested) ? nested : join(dist, `${route.slice(1)}.html`), 'utf8');
};

const GAP_ROW = /^\| [\d, ]+\s*\| ([^|]+?)\s*\| ([^|]+?)\s*\|/gm;
const RECOGNISED_GAP_PHRASING =
  /no route|absent|missing|never appears|no anchor|no playbook|no prose owner|no artifact/i;

export function promptGapRows(coreDoc) {
  const rows = [...coreDoc.matchAll(GAP_ROW)];
  const unrecognised = rows.filter(([, , gap]) => !RECOGNISED_GAP_PHRASING.test(gap));
  if (unrecognised.length > 0) {
    const named = unrecognised.map(([, prompt, gap]) => `"${prompt.trim()} — ${gap.trim()}"`).join(', ');
    throw new Error(`generate-gaps: GAP register row(s) use phrasing the allowlist does not recognise: ${named}`);
  }
  return rows.map(([, prompt, gap]) => `${prompt.trim()} — ${gap.trim()}`);
}

function main() {
  const dist = process.argv[2] ?? 'dist';
  const terms = readdirSync('src/data/glossary')
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const slug = name.replace(/\.md$/, '');
      const frontmatter = parse(/^---\n([\s\S]*?)\n---/.exec(readFileSync(join('src/data/glossary', name), 'utf8'))[1]);
      return { slug, term: frontmatter.term, route: `/glossary/${slug}`, shortDefinition: frontmatter.shortDefinition };
    })
    .sort((a, b) => a.term.localeCompare(b.term));

  const routes = JSON.parse(readFileSync(join(dist, 'gate-routes.json'), 'utf8')).routes;
  const pages = routes.map((route) => {
    const html = pageOf(dist, route);
    const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
    return {
      route,
      noindex: [...html.matchAll(/<meta\b[^>]*>/gi)].some(([tag]) => /robots/i.test(tag) && /noindex/i.test(tag)),
      text: main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
      prose: prosePassages(main),
      hrefs: [...main.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replace(/\/$/, '') || '/'),
    };
  });
  const noindexRoutes = pages.filter((page) => page.noindex).map((page) => page.route);

  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  const rows = ledger.rows;
  const concepts = conceptRegister(terms);
  const promptGaps = promptGapRows(readFileSync(CORE, 'utf8'));

  const report = renderGaps({
    ledger: {
      rows: rows.length,
      unreviewed: rows.filter((row) => row.status === 'unreviewed').length,
      untraceable: ledger.counts.untraceable,
      dead: ledger.counts.dead,
    },
    concepts: groupByConcept(
      authoredRoutesOnly(indexableOnly(undefinedConceptFindings(concepts, pages), noindexRoutes))
    ),
    orphans: orphanEntities(entityRegister(terms, pages)),
    promptGaps,
  });

  writeFileSync(OUT, report);
  console.log(`gaps: ${OUT}, ${noindexRoutes.length} noindex routes excluded, ${promptGaps.length} prompt gaps`);
}

if (import.meta.filename === process.argv[1]) main();
