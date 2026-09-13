import { readFile } from 'node:fs/promises';

import { discoverRoutes } from './gate.mjs';

const LD_BLOCK = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

const ROUTE_TYPES = [
  { pattern: /^\/$/, types: ['Organization', 'Person', 'WebSite'] },
  { pattern: /^\/blog$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/blog\/category\/[^/]+$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/blog\/tags$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/blog\/tag\/[^/]+$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/blog\/page\/\d+$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/blog\/category\/[^/]+\/page\/\d+$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/blog\/[^/]+$/, types: ['BlogPosting', 'BreadcrumbList'] },
  { pattern: /^\/glossary$/, types: ['DefinedTermSet', 'CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/glossary\/[^/]+$/, types: ['DefinedTerm', 'DefinedTermSet', 'BreadcrumbList'] },
  { pattern: /^\/resources$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/resources\/[^/]+$/, types: ['CreativeWork|SoftwareSourceCode', 'BreadcrumbList'] },
  { pattern: /^\/services$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/services\/[^/]+$/, types: ['Service', 'FAQPage', 'BreadcrumbList'] },
  { pattern: /^\/case-studies$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/case-studies\/[^/]+$/, types: ['BlogPosting', 'BreadcrumbList'] },
  { pattern: /^\/faq$/, types: ['CollectionPage', 'BreadcrumbList'] },
  { pattern: /^\/faq\/[^/]+$/, types: ['FAQPage', 'BreadcrumbList'] },
  { pattern: /^\/about$/, types: ['ProfilePage', 'Person', 'BreadcrumbList'] },
  { pattern: /^\/contact$/, types: ['ContactPage', 'BreadcrumbList'] },
  { pattern: /^\/pricing$/, types: ['Service', 'BreadcrumbList'] },
  { pattern: /^\/approach$/, types: ['BreadcrumbList'] },
  { pattern: /^\/now$/, types: ['BreadcrumbList'] },
  { pattern: /^\/(privacy|terms|imprint|security|ai-policy)$/, types: ['BreadcrumbList'] },
];

const GRAPH_EXEMPT = new Set(['/404', '/search', '/styleguide']);

export function extractGraphs(html) {
  const graphs = [];
  for (const [, body] of html.matchAll(LD_BLOCK)) {
    try {
      graphs.push(JSON.parse(body));
    } catch (error) {
      throw new Error('jsonld: could not parse an ld+json block', { cause: error });
    }
  }
  return graphs;
}

const nodesOf = (graphs) => graphs.flatMap((document) => document['@graph'] ?? [document]);

function references(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) references(item, found);
    return found;
  }
  if (!value || typeof value !== 'object') return found;

  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === '@id') found.push(value['@id']);
  for (const key of keys) references(value[key], found);
  return found;
}

export function danglingIds(graphs) {
  const nodes = nodesOf(graphs);
  const declared = new Set(nodes.map((node) => node['@id']).filter(Boolean));
  return [...new Set(references(nodes).filter((id) => !declared.has(id)))];
}

export function duplicateIds(graphs) {
  const seen = new Set();
  const duplicates = new Set();
  for (const node of nodesOf(graphs)) {
    const id = node['@id'];
    if (!id) continue;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

export function missingTypes(graphs, required) {
  const present = new Set(nodesOf(graphs).flatMap((node) => [node['@type']].flat()));
  return required.filter((type) => !type.split('|').some((option) => present.has(option)));
}

export const requiredTypesFor = (route) => ROUTE_TYPES.find(({ pattern }) => pattern.test(route))?.types;

export async function main(distDir) {
  const routes = await discoverRoutes(distDir);
  const failures = [];
  let checked = 0;

  for (const route of routes) {
    if (GRAPH_EXEMPT.has(route)) continue;
    const required = requiredTypesFor(route);
    if (!required) {
      failures.push(`${route} matches no known jsonld route family`);
      continue;
    }
    const file = route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;
    const html = await readFile(`${distDir}/${file}`, 'utf8').catch(() =>
      readFile(`${distDir}/${route.slice(1)}.html`, 'utf8')
    );
    const graphs = extractGraphs(html);
    if (graphs.length === 0) {
      failures.push(`${route} carries no ld+json graph`);
      continue;
    }

    checked += 1;
    for (const id of danglingIds(graphs)) failures.push(`${route} references undeclared ${id}`);
    for (const id of duplicateIds(graphs)) failures.push(`${route} declares ${id} twice`);
    for (const type of missingTypes(graphs, required)) failures.push(`${route} has no ${type} node`);
  }

  console.log(`jsonld: ${checked} of ${routes.length} routes carry a graph`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`JSONLD ${failure}`);
    process.exitCode = 1;
  }
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist');
}
