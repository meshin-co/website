import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { collectPages } from './content-gate.mjs';
import { judgePage, PROFILES } from './content-rows.mjs';
import { discoverRoutes } from './gate.mjs';

const DOC = '../docs/SEMANTIC-CORE.md';
const TITLE_SUFFIX = ' — meshin.co';

export const GENERATED_BEGIN = '<!-- semantic-core:begin generated -->';
export const GENERATED_END = '<!-- semantic-core:end generated -->';

const FAMILY_BY_PREFIX = [
  ['/blog/category/', 'blog-category'],
  ['/blog/', 'article'],
  ['/services/', 'service'],
  ['/resources/', 'resource'],
  ['/case-studies/', 'case-study'],
  ['/glossary/', 'term'],
  ['/faq/', 'faq-answer'],
];

export function familyFor(route) {
  for (const [prefix, family] of FAMILY_BY_PREFIX) {
    if (route.startsWith(prefix)) return family;
  }
  return 'static';
}

export const FAMILY_GRAMMAR = {
  static: {
    pattern: '{page name} — meshin.co',
    meta: 'value-proposition clause naming the offer and the buyer',
    intent: 'answer the query, then route to the next step',
  },
  service: {
    pattern: '{offer name} — meshin.co',
    meta: 'one outcome sentence: what ships, in what timeframe',
    intent: 'offer → deliverables → fit → CTA',
  },
  resource: {
    pattern: '{artifact name} — meshin.co',
    meta: 'one sentence naming the artifact and what you do with it',
    intent: 'what it is → what is inside → how to use it',
  },
  'case-study': {
    pattern: '{client} — {engagement} — meshin.co',
    meta: 'how the system went from demo to production',
    intent: 'problem → approach → outcome',
  },
  article: {
    pattern: '{short answer sentence} — meshin.co',
    meta: 'the shortAnswer sentence, uncut',
    intent: 'problem → mechanism → fix → takeaways',
  },
  'blog-category': {
    pattern: '{category name} — meshin.co',
    meta: 'what the category covers, scoped to the 30–300 person buyer',
    intent: 'curated list with one-line stakes per entry',
  },
  term: {
    pattern: 'What is {term}? — meshin.co',
    meta: 'the definition sentence',
    intent: 'definition → why it matters → adjacent terms',
  },
  'faq-answer': {
    pattern: '{question} — meshin.co',
    meta: 'first sentence of the answer',
    intent: 'direct answer → mechanism → next step',
  },
};

const FAMILY_ORDER = [
  'static',
  'service',
  'resource',
  'case-study',
  'article',
  'blog-category',
  'term',
  'faq-answer',
];

const STEM_RULES = {
  term: /^What\b.*\?$/,
  'faq-answer': /[?…]$/,
};

const decodeText = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

export function titleFindings(rows) {
  const findings = [];

  for (const { route, title } of rows) {
    const add = (rule, detail) => findings.push({ route, rule, detail });
    if (!title) {
      add('title-missing', 'no <title> element');
      continue;
    }
    if (!title.endsWith(TITLE_SUFFIX)) {
      add('title-suffix', `expected suffix "${TITLE_SUFFIX}"`);
      continue;
    }
    const stem = title.slice(0, -TITLE_SUFFIX.length);
    const rule = STEM_RULES[familyFor(route)];
    if (rule && !rule.test(stem)) add('title-stem', `stem "${stem}" breaks the ${familyFor(route)} pattern`);
  }

  return findings;
}

export function orphanFindings(routes, queries) {
  const built = new Set(routes);
  const known = new Set(queries);
  const findings = [];

  for (const route of queries) {
    if (!built.has(route)) findings.push({ route, rule: 'query-without-route', detail: 'no built route' });
  }
  for (const route of routes) {
    if (!known.has(route)) findings.push({ route, rule: 'route-without-query', detail: 'no content-facts row' });
  }

  return findings;
}

export async function collectSemantic(distDir, facts) {
  const pages = await collectPages(distDir);
  const rows = [];

  for (const page of pages) {
    const html = await readFile(join(distDir, page.route.slice(1), 'index.html'), 'utf8');
    const title = decodeText(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '');
    const descriptionTag = /<meta[^>]*name="description"[^>]*>/.exec(html)?.[0] ?? '';
    const description = decodeText(/content="([^"]*)"/.exec(descriptionTag)?.[1] ?? '');
    const query = facts.targetQuery[page.route];

    const queryFindings = judgePage(page, PROFILES[page.profile], facts, []).filter((finding) =>
      ['h1-query', 'query-opening'].includes(finding.rule)
    );
    const opening = !query ? '—' : queryFindings.length === 0 ? '✓' : '✗';

    rows.push({
      route: page.route,
      family: familyFor(page.route),
      query: query ?? '',
      title,
      description,
      h1: page.headings.h1[0] ?? '',
      links: page.links.internal.length,
      opening,
    });
  }

  return rows;
}

export async function checkFindings(distDir) {
  const facts = JSON.parse(await readFile('content-facts.json', 'utf8'));
  const rows = await collectSemantic(distDir, facts);
  const routes = await discoverRoutes(distDir);

  return [...orphanFindings(routes, Object.keys(facts.targetQuery)).filter((finding) => finding.rule === 'query-without-route'), ...orphanFindings(rows.map((row) => row.route), Object.keys(facts.targetQuery)).filter((finding) => finding.rule === 'route-without-query'), ...titleFindings(rows)];
}

const cell = (text) => `\`${text}\``;

export function renderFamilies(rows) {
  const byFamily = new Map(FAMILY_ORDER.map((family) => [family, []]));
  for (const row of rows) byFamily.get(row.family)?.push(row);

  const sections = [];
  for (const family of FAMILY_ORDER) {
    const familyRows = byFamily.get(family);
    if (!familyRows?.length) continue;
    const grammar = FAMILY_GRAMMAR[family];
    const head = `### ${family} (${familyRows.length})`;
    const grammarLine = `title \`${grammar.pattern}\` · meta: ${grammar.meta} · body intent: ${grammar.intent}`;
    const header = '| Route | Query | Title | Description | H1 | Links | Opening |';
    const divider = '|---|---|---|---|---|---|---|';
    const body = familyRows
      .map(
        (row) =>
          `| ${cell(row.route)} | ${row.query} | ${row.title} | ${row.description} | ${row.h1} | ${row.links} | ${row.opening} |`
      )
      .join('\n');
    sections.push(`${head}\n\n${grammarLine}\n\n${header}\n${divider}\n${body}`);
  }

  return sections.join('\n\n');
}

export function spliceGenerated(doc, block) {
  const begin = doc.indexOf(GENERATED_BEGIN);
  const end = doc.indexOf(GENERATED_END);
  if (begin === -1 || end === -1) throw new Error(`semantic-core markers missing from ${DOC}`);

  return `${doc.slice(0, begin + GENERATED_BEGIN.length)}\n${block}\n${doc.slice(end)}`;
}

async function main() {
  const facts = JSON.parse(await readFile('content-facts.json', 'utf8'));

  if (process.argv[2] === '--check') {
    const findings = await checkFindings(process.argv[3] ?? 'dist');
    for (const finding of findings) console.log(`${finding.route} ${finding.rule} [${finding.detail}]`);
    console.log(`semantic-core: ${findings.length} findings`);
    if (findings.length > 0) process.exitCode = 1;
    return;
  }

  const rows = await collectSemantic('dist', facts);
  const doc = await readFile(DOC, 'utf8');
  await writeFile(DOC, spliceGenerated(doc, renderFamilies(rows)));
  const families = new Set(rows.map((row) => row.family));
  console.log(`semantic-core: ${rows.length} rows, ${families.size} families -> ${DOC}`);
}

if (import.meta.filename === process.argv[1]) {
  await main();
}
