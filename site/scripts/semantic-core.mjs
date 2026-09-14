import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { extractPage } from './content-html.mjs';
import { judgePage, PROFILES } from './content-rows.mjs';
import { discoverRoutes } from './gate.mjs';

const DOC = '../docs/SEMANTIC-CORE.md';
const TITLE_SUFFIX = ' — meshin.co';

export const GENERATED_BEGIN = '<!-- semantic-core:begin generated -->';
export const GENERATED_END = '<!-- semantic-core:end generated -->';

const FAMILY_BY_PREFIX = [
  ['/blog/category/', 'blog-category'],
  ['/blog/tags', 'tag-index'],
  ['/blog/tag/', 'tag'],
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
  'tag-index': {
    pattern: 'Tags — meshin.co',
    meta: 'what tags exist and how many articles carry each one',
    intent: 'browse the tag list, then route into one tag',
  },
  tag: {
    pattern: '{tag name} — meshin.co',
    meta: 'every article tagged {tag}, newest first',
    intent: 'thin archive list; route straight to the tagged articles',
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
  'tag-index',
  'tag',
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
    const add = (rule, detail) => findings.push({ route, rule, detail, excerpt: '' });
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
    if (!built.has(route)) findings.push({ route, rule: 'query-without-route', detail: 'no built route', excerpt: '' });
  }
  for (const route of routes) {
    if (!known.has(route))
      findings.push({ route, rule: 'route-without-query', detail: 'no content-facts row', excerpt: '' });
  }

  return findings;
}

async function collectSemantic(distDir, facts, pages) {
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

async function collectGated(distDir) {
  const { collectPages } = await import('./content-gate.mjs');
  return collectPages(distDir);
}

async function readRouteHtml(distDir, route) {
  const candidates = route === '/' ? ['index.html'] : [`${route.slice(1)}/index.html`, `${route.slice(1)}.html`];
  for (const candidate of candidates) {
    try {
      return await readFile(join(distDir, candidate), 'utf8');
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`semantic-core: no built html for route ${route}`);
}

async function collectAllPages(distDir) {
  const routes = await discoverRoutes(distDir);
  const pages = [];
  for (const route of routes) pages.push(extractPage(route, await readRouteHtml(distDir, route)));
  return pages;
}

const routeCell = (line) => /^\|\s*`([^`]+)`/.exec(line)?.[1];

export function docDriftFindings(committedDoc, freshBlock) {
  const begin = committedDoc.indexOf(GENERATED_BEGIN);
  const end = committedDoc.indexOf(GENERATED_END);
  if (begin === -1 || end === -1) throw new Error('semantic-core: markers missing from docs/SEMANTIC-CORE.md');

  const committedBlock = committedDoc.slice(begin + GENERATED_BEGIN.length, end).trim();
  if (committedBlock === freshBlock.trim()) return [];

  const committedLines = new Map();
  for (const line of committedBlock.split('\n')) {
    const route = routeCell(line);
    if (route) committedLines.set(route, line);
  }
  const freshLines = new Map();
  for (const line of freshBlock.split('\n')) {
    const route = routeCell(line);
    if (route) freshLines.set(route, line);
  }

  const drifted = new Set();
  for (const [route, line] of freshLines) if (committedLines.get(route) !== line) drifted.add(route);
  for (const route of committedLines.keys()) if (!freshLines.has(route)) drifted.add(route);

  return [...drifted].sort().map((route) => ({
    route,
    rule: 'doc-drift',
    detail: 'generated table differs from docs/SEMANTIC-CORE.md',
    excerpt: '',
  }));
}

const PROMPTS_HEADING = '### The 30 buyer prompts';
const GAP_REGISTER_HEADING = '### GAP register';

export function parseBuyerPrompts(doc) {
  const start = doc.indexOf(PROMPTS_HEADING);
  if (start === -1) return [];
  const end = doc.indexOf(GAP_REGISTER_HEADING, start);
  const section = doc.slice(start, end === -1 ? undefined : end);

  const prompts = [];
  for (const block of section.split(/\n\n(?=\*\*\d+\.)/)) {
    const numbers = [...block.matchAll(/^\*\*(\d+)\./gm)].map((match) => Number(match[1]));
    if (numbers.length === 0) continue;

    const mustWinLine = /^Must win[^:\n]*:(.*)$/m.exec(block);
    const mustWinRoutes = mustWinLine
      ? [...mustWinLine[1].split(/\bsupport\b/i)[0].matchAll(/`([^`]+)`/g)].map((match) => match[1])
      : [];

    const passages = [...block.matchAll(/Passage:\s*"([^"]+)"\s*\(`([^`]+)`\)/g)].map((match) => ({
      text: match[1],
      route: match[2],
    }));
    if (passages.length === 0) {
      const bareQuote = /Passage:\s*"([^"]+)"/.exec(block);
      if (bareQuote && mustWinRoutes[0]) passages.push({ text: bareQuote[1], route: mustWinRoutes[0] });
    }

    for (const number of numbers) prompts.push({ number, mustWinRoutes, passages });
  }

  return prompts;
}

export function mustWinFindings(prompts, builtRoutes) {
  const built = new Set(builtRoutes);
  const findings = [];
  for (const prompt of prompts)
    for (const route of prompt.mustWinRoutes)
      if (!built.has(route))
        findings.push({
          route,
          rule: 'buyer-prompt-must-win-missing',
          detail: `prompt ${prompt.number} must-win route not built`,
          excerpt: '',
        });
  return findings;
}

export function passageFindings(prompts, pages) {
  const textByRoute = new Map(pages.map((page) => [page.route, page.text]));
  const findings = [];
  for (const prompt of prompts)
    for (const passage of prompt.passages) {
      const text = textByRoute.get(passage.route);
      if (text === undefined || text.includes(passage.text)) continue;
      findings.push({
        route: passage.route,
        rule: 'buyer-prompt-passage-missing',
        detail: `prompt ${prompt.number} passage no longer found on the page`,
        excerpt: passage.text.slice(0, 90),
      });
    }
  return findings;
}

export const ABSENCE_CLAIMS = [{ prompt: 16, term: 'Israel', claim: '"Israel" appears on no built page' }];

export function absenceFindings(pages, claims = ABSENCE_CLAIMS) {
  const findings = [];
  for (const claim of claims) {
    const hit = pages.find((page) => page.text.includes(claim.term));
    if (hit)
      findings.push({
        route: hit.route,
        rule: 'gap-claim-stale',
        detail: `prompt ${claim.prompt} GAP claim (${claim.claim}) no longer holds`,
        excerpt: claim.term,
      });
  }
  return findings;
}

export async function checkFindings(distDir, pages) {
  const facts = JSON.parse(await readFile('content-facts.json', 'utf8'));
  const queries = Object.keys(facts.targetQuery);
  const rows = await collectSemantic(distDir, facts, pages ?? (await collectGated(distDir)));
  const built = await discoverRoutes(distDir);
  const gated = rows.map((row) => row.route);

  const findings = orphanFindings(built, queries).filter((finding) => finding.rule === 'query-without-route');
  findings.push(...orphanFindings(gated, queries).filter((finding) => finding.rule === 'route-without-query'));
  findings.push(...titleFindings(rows));

  const doc = await readFile(DOC, 'utf8');
  findings.push(...docDriftFindings(doc, renderFamilies(rows)));

  const prompts = parseBuyerPrompts(doc);
  const allPages = await collectAllPages(distDir);
  findings.push(...mustWinFindings(prompts, built));
  findings.push(...passageFindings(prompts, allPages));
  findings.push(...absenceFindings(allPages));

  return findings;
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

  const rows = await collectSemantic('dist', facts, await collectGated('dist'));
  const doc = await readFile(DOC, 'utf8');
  await writeFile(DOC, spliceGenerated(doc, renderFamilies(rows)));
  const families = new Set(rows.map((row) => row.family));
  console.log(`semantic-core: ${rows.length} rows, ${families.size} families -> ${DOC}`);
}

if (import.meta.filename === process.argv[1]) {
  await main();
}
