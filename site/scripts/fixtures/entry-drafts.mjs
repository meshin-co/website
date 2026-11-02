import jsYaml from 'js-yaml';

export const RUN_DATE = '2026-11-02';
export const RUN_DAY = new Date('2026-11-02T00:00:00Z');
export const FORMATS = ['term', 'article'];

const CLAIMS = {
  term: { slug: 'model-registry', title: 'What is a model registry?', query: 'model registry' },
  article: {
    slug: 'how-to-write-an-ai-incident-runbook',
    title: 'How to write an AI incident runbook',
    query: 'AI incident runbook',
  },
};

const PROMPTS = {
  term: { number: 2, text: 'what is a model registry' },
  article: { number: 22, text: 'AI incident response plan template' },
};

export const claimOf = (format) => ({
  schema: 1,
  format,
  demand: { impressions: 14, position: 11.2 },
  prompt: PROMPTS[format],
  runId: '9001',
  status: 'claimed',
  claimedAt: '2026-11-01T07:00:00.000Z',
  expiresAt: '2026-11-15T07:00:00.000Z',
  ...CLAIMS[format],
});

export const SOURCES = [
  {
    id: 'S1',
    title: 'NIST AI RMF Core: Govern and Manage',
    url: 'https://airc.nist.gov/airmf-resources/airmf/5-sec-core/',
    publisher: 'NIST',
  },
  {
    id: 'S2',
    title: 'Regulation (EU) 2024/1689',
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
    publisher: '',
  },
];

export const RESOLVED_SOURCES = [
  {
    title: 'NIST AI RMF Core: Govern and Manage',
    url: 'https://airc.nist.gov/airmf-resources/airmf/5-sec-core/',
    publisher: 'NIST',
    retrieved: RUN_DATE,
  },
  { title: 'Regulation (EU) 2024/1689', url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj', retrieved: RUN_DATE },
];

export const DRAFTS = {
  term: {
    format: 'term',
    fields: {
      description: 'A model registry is the list of every model a company runs, with its version and its owner.',
      shortDefinition:
        'A model registry is the list of every model a company runs. Each row names a version and an owner.',
      definition:
        'A registry row says which model runs where.\n\nIt is not the AI register: that one lists systems, this one lists models.',
      relatedTerms: ['ai-register', 'model-provenance'],
    },
    body: '## Why it comes up\n\nA reviewer asks which model answered a customer.\n\n## What to do about it\n\nKeep one row per deployed model.',
    sources: SOURCES,
    claims: [],
    passage: 'A registry row says which model runs where.',
  },
  article: {
    format: 'article',
    fields: {
      description:
        'How to write an AI incident runbook: who is paged, what stops the system and who tells the customer.',
      shortAnswer:
        'Write the runbook around three decisions: who is paged, what stops the system and who tells the customer.',
      fullAnswer: 'A runbook is a page one person can follow at three in the morning. It names an owner.',
      keyTakeaways: ['Name one owner: not a team.', 'Write the stop switch down.', 'Rehearse it once a quarter.'],
      faq: [{ q: 'Who should be paged first?', a: 'The named owner of the system.' }],
      category: 'governance',
      tags: ['ai-governance', 'production-readiness'],
      relatedResources: ['ai-governance-starter-kit'],
    },
    body: '## Who is paged\n\nThe owner.\n\n- one\n- two\n',
    sources: SOURCES,
    claims: [],
    passage: 'A runbook is a page one person can follow at three in the morning.',
  },
};

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;

export const splitEntry = (text) => {
  const block = FRONT_MATTER.exec(text);
  const frontmatter = jsYaml.load(block[1]);
  return { frontmatter, keys: Object.keys(frontmatter), body: text.slice(block[0].length) };
};
