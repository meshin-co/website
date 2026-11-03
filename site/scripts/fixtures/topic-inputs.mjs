import { titleSuffix } from '../../src/utils/brand.mjs';
import { siteBrand } from '../site-brand.mjs';
import { casedForms } from '../topic-casing.mjs';

const BRAND = siteBrand().name;
const NOW = new Date('2026-11-02T07:00:00.000Z');
export const SUFFIX = titleSuffix({ name: BRAND });
const LIVE_UNTIL = '2026-11-15T07:00:00.000Z';
export const LAPSED_AT = '2026-11-02T07:00:00.000Z';

export const prompt = (number, text, extra = {}) => ({
  number,
  prompt: text,
  mustWin: null,
  unproven: true,
  impressions: 0,
  position: null,
  carriedBy: [],
  cells: {
    '#': String(number),
    Prompt: text,
    'Must win': '-',
    Impressions: 'unproven',
    Position: '-',
    'Carried by': '-',
  },
  ...extra,
});

export const provenPrompt = (number, text) =>
  prompt(number, text, { unproven: false, impressions: 3, position: 40, cells: { '#': String(number), Prompt: text } });

export const query = (text, impressions, position, pages = ['/glossary/a-term'], prompts = []) => ({
  query: text,
  impressions,
  clicks: 0,
  position,
  pages,
  prompts,
  cells: { Query: text, Impressions: String(impressions), Position: position === null ? '-' : position.toFixed(1) },
});

export const reportOf = (prompts, queries = []) => ({
  measured: '2026-11-01',
  windowStart: '2026-08-01',
  windowEnd: '2026-10-30',
  property: `sc-domain:${BRAND}`,
  generatedFrom: 'b5d0639',
  queries,
  pages: [],
  days: [],
  prompts,
});

export const sourcesOf = (byNumber) =>
  new Map(
    Object.entries(byNumber).map(([number, source]) => [Number(number), { routes: [], retired: false, ...source }])
  );

const CONCEPTS = [
  { concept: 'Evals', route: '/glossary/evals' },
  { concept: 'AI register', route: '/glossary/ai-register' },
  { concept: 'Guardrails', route: '/glossary/guardrails' },
];

export const GENERATED = [
  { family: 'term', route: '/glossary/ai-register', title: `What is an AI register?${SUFFIX}` },
  { family: 'term', route: '/glossary/guardrails', title: `What are guardrails?${SUFFIX}` },
];

export const inputsFor = (report, extra = {}) => ({
  report,
  concepts: CONCEPTS,
  generated: GENERATED,
  promptSources: new Map(),
  forms: casedForms(['AI', 'EU', 'NIST', 'RMF', 'LLM']),
  claims: [],
  ledgerSlugs: [],
  suffix: SUFFIX,
  now: NOW,
  settings: { termArm: true, termCap: 1 },
  ...extra,
});

export const claimed = (slug, title, extra = {}) => ({
  path: 'audits/autowriter/claims/' + slug + '.json',
  claim: {
    schema: 1,
    slug,
    title,
    format: 'article',
    query: 'q',
    demand: { impressions: 0, position: null },
    prompt: { number: 1, text: 'q' },
    runId: '1',
    status: 'claimed',
    claimedAt: '2026-11-01T07:00:00.000Z',
    expiresAt: LIVE_UNTIL,
    ...extra,
  },
});
