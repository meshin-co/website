import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

import {
import { invokedDirectly } from './invoked-directly.mjs';
  conceptRegister,
  entityRegister,
  relationshipPairs,
  registerDriftFindings,
  renderRegisters,
  spliceRegisters,
  undefinedConceptFindings,
  prosePassages,
} from './registers.mjs';

const DOC = '../docs/SEMANTIC-CORE.md';

function glossaryTerms() {
  return readdirSync('src/data/glossary')
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const slug = name.replace(/\.md$/, '');
      const raw = readFileSync(join('src/data/glossary', name), 'utf8');
      const frontmatter = parse(/^---\n([\s\S]*?)\n---/.exec(raw)[1]);
      return {
        slug,
        term: frontmatter.term,
        route: `/glossary/${slug}`,
        shortDefinition: frontmatter.shortDefinition,
        relatedTerms: frontmatter.relatedTerms ?? [],
      };
    })
    .sort((a, b) => a.term.localeCompare(b.term));
}

function builtPages(dist) {
  const routes = JSON.parse(readFileSync(join(dist, 'gate-routes.json'), 'utf8')).routes;
  return routes.map((route) => {
    const file = join(dist, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    const html = readFileSync(file, 'utf8');
    const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
    return {
      route,
      text: main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
      prose: prosePassages(main),
      hrefs: [...main.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replace(/\/$/, '') || '/'),
    };
  });
}

function build(dist) {
  const terms = glossaryTerms();
  const pages = builtPages(dist);
  const concepts = conceptRegister(terms);
  return {
    block: renderRegisters({
      entities: entityRegister(terms, pages),
      concepts,
      relationships: relationshipPairs(terms),
    }),
    undefined: undefinedConceptFindings(concepts, pages),
    terms: terms.length,
  };
}

function main() {
  const dist = process.argv[3] ?? 'dist';
  const built = build(dist);

  if (process.argv[2] === '--check') {
    const findings = registerDriftFindings(readFileSync(DOC, 'utf8'), built.block);
    for (const finding of findings) console.log(`${finding.rule} [${finding.detail}]`);
    console.log(`registers: ${findings.length} findings, ${built.undefined.length} unlinked concept uses`);
    if (findings.length > 0) process.exitCode = 1;
    return;
  }

  writeFileSync(DOC, spliceRegisters(readFileSync(DOC, 'utf8'), built.block));
  console.log(`registers: ${built.terms} entities and concepts -> ${DOC}`);
  console.log(`unlinked concept uses: ${built.undefined.length}`);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main();
