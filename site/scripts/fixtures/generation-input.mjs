import { createHash } from 'node:crypto';

import { siteBrand } from '../site-brand.mjs';

export const ARTICLE_SLUG = 'how-to-build-an-ai-bill-of-materials';
export const TERM_SLUG = 'ai-bill-of-materials';
export const LEDGER = `audits/autowriter/${ARTICLE_SLUG}.json`;
export const MODEL_VARIABLE = 'OPENAI_WRITING_MODEL';
export const MODEL = 'gpt-6.1-terra';
export const RESOLVED_MODEL = 'gpt-6.1-terra-2026-10-01';
export const PRICE = { inputPerMillion: 1, outputPerMillion: 5 };

const digest = (text) => createHash('sha256').update(text).digest('hex');

export function callOf(role, { input = 12000, output = 3000 } = {}, tag = role) {
  return {
    role,
    vendor: 'openai',
    modelVariable: MODEL_VARIABLE,
    configuredModel: MODEL,
    resolvedModel: RESOLVED_MODEL,
    responseId: `resp-${tag}`,
    requestDigest: digest(`openai/${tag}`),
    tokens: { input, output },
    costUsd: (input * PRICE.inputPerMillion + output * PRICE.outputPerMillion) / 1e6,
    price: { ...PRICE },
    stopReason: 'completed',
  };
}

export const modelCheck = (extra = {}) => ({
  vendor: 'openai',
  modelVariable: MODEL_VARIABLE,
  model: MODEL,
  shutdownDate: null,
  note: null,
  ...extra,
});

const COMMIT_FILES = [
  `site/src/data/post/${ARTICLE_SLUG}.md`,
  `site/src/data/glossary/${TERM_SLUG}.md`,
  'docs/SEMANTIC-CORE.md',
  'site/content-facts.json',
  `audits/autowriter/generations/${ARTICLE_SLUG}.json`,
  `audits/autowriter/generations/${TERM_SLUG}.json`,
];

const LIMITS = {
  format: 'article',
  threshold: 12,
  minimumSentences: 8,
  justBelowFrom: 8,
  medianFloor: 13,
  medianCeiling: 19,
  belowThresholdCap: 0.51,
  justBelowCap: 0.294,
};

export const recordInput = () => ({
  claim: {
    schema: 1,
    slug: ARTICLE_SLUG,
    title: 'How do you build an AI bill of materials?',
    format: 'article',
    query: 'how to build an ai bill of materials',
    demand: { impressions: 9, position: 91.8 },
    prompt: { number: 6, text: 'Which artefacts should an AI register hold for each model?' },
    runId: '1234567890',
    status: 'claimed',
    claimedAt: '2026-11-02T07:00:00.000Z',
    expiresAt: '2026-11-16T07:00:00.000Z',
  },
  decision: {
    schema: 1,
    decision: 'write',
    claimPath: `audits/autowriter/claims/${ARTICLE_SLUG}.json`,
    ledgerPath: LEDGER,
    row: {
      '#': '6',
      Prompt: 'Which artefacts should an AI register hold for each model?',
      'Must win': '`/blog/how-to-build-an-ai-bill-of-materials`',
      Impressions: '9',
      Position: '91.8',
      'Carried by': 'unproven',
    },
    report: {
      path: 'audits/search-demand.md',
      measured: '2026-11-01',
      windowStart: '2026-08-01',
      windowEnd: '2026-10-30',
      property: `sc-domain:${siteBrand().name}`,
      generatedFrom: 'b5d0639',
      table: 'Buyer prompts',
    },
    refusals: [{ title: 'What is AI?', reason: 'taken', against: 'x', detail: 'y' }],
  },
  format: 'article',
  route: `/blog/${ARTICLE_SLUG}`,
  entryPath: `site/src/data/post/${ARTICLE_SLUG}.md`,
  ledger: LEDGER,
  generatedAt: '2026-11-02T07:05:09.123Z',
  calls: [
    callOf('draft', {}, 'article-draft'),
    callOf('correction', { input: 13000, output: 2000 }, 'article-correction'),
  ],
  published: { callIndex: 1 },
  modelChecks: [modelCheck()],
  prompt: {
    digest: digest('prompt'),
    schemaDigest: digest('schema'),
    files: [
      { path: 'docs/SEMANTIC-CORE.md', sha256: digest('core') },
      { path: 'site/.agents/skills/write-copy.md', sha256: digest('copy') },
    ],
  },
  tree: { parent: 'a'.repeat(40), fingerprint: digest('tree') },
  claimTable: [
    {
      sentence: 'An AI bill of materials lists the components of an AI system.',
      marker: 'sourced',
      source: { id: 'S1', title: 'NIST AI RMF', url: 'https://www.nist.gov/itl/ai-risk-management-framework' },
      span: 'lists the components',
    },
    { sentence: 'We would start with the model card.', marker: 'own-reading', source: null, span: null },
  ],
  band: {
    measuredOn: '2026-11-02',
    limits: { ...LIMITS },
    measured: {
      format: 'article',
      sentences: 21,
      median: 16,
      shareBelowThreshold: 0.29,
      shareJustBelow: 0.14,
      threshold: 12,
    },
  },
  files: [...COMMIT_FILES],
  gates: [
    { name: 'gate:content', exit: 0 },
    { name: 'gate:human', exit: 0 },
    { name: 'gate:editorial', exit: 0 },
    { name: 'gate:registers', exit: 0 },
    { name: 'gate:machine', exit: 0 },
  ],
});

export function termInput() {
  const input = recordInput();
  return {
    ...input,
    claim: {
      ...input.claim,
      slug: TERM_SLUG,
      title: 'What is an AI bill of materials?',
      format: 'term',
      query: 'ai bill of materials',
      demand: { impressions: 0, position: null },
    },
    decision: {
      ...input.decision,
      row: {
        '#': '7',
        Prompt: 'What is an AI bill of materials?',
        'Must win': `/glossary/${TERM_SLUG}`,
        Impressions: '0',
        Position: '-',
        'Carried by': 'unproven',
      },
    },
    format: 'term',
    route: `/glossary/${TERM_SLUG}`,
    entryPath: `site/src/data/glossary/${TERM_SLUG}.md`,
    calls: [callOf('draft', { input: 6000, output: 1200 }, 'term-draft')],
    published: { callIndex: 0 },
    claimTable: [input.claimTable[1]],
    band: {
      measuredOn: '2026-11-02',
      limits: { ...LIMITS, format: 'term', medianFloor: 12, medianCeiling: 20 },
      measured: {
        format: 'term',
        sentences: 9,
        median: 15,
        shareBelowThreshold: 0.34,
        shareJustBelow: 0.12,
        threshold: 12,
      },
    },
  };
}
