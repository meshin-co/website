import { COLLECTION_OF, RESOURCE_COLLECTION } from '../entry-prose.mjs';
import { GENERATED_LAYER, REGISTERS } from './semantic-core-doc.mjs';

const TERMS = [
  'ai-management-system',
  'ai-register',
  'conformity-assessment',
  'iso-iec-42001',
  'serious-incident-reporting',
];
const ARTICLES = [
  'evals-in-ci-for-llm-agents',
  'handing-over-ai-leadership-to-an-internal-owner',
  'why-your-ai-pilot-never-reached-production',
];
const RESOURCES = ['ai-governance-starter-kit', 'ai-readiness-scorecard'];

export const ENTRIES = {
  [COLLECTION_OF.term]: TERMS,
  [COLLECTION_OF.article]: ARTICLES,
  [RESOURCE_COLLECTION]: RESOURCES,
};

export const TAGS = ['ai-governance', 'ai-pilots', 'evals-in-ci', 'production-readiness', 'shadow-ai'];

export const ROUTES = [
  '/',
  '/blog',
  '/glossary',
  '/resources',
  ...ARTICLES.map((slug) => `/blog/${slug}`),
  ...TERMS.map((slug) => `/glossary/${slug}`),
  ...RESOURCES.map((slug) => `/resources/${slug}`),
].sort();

export const FACTS = {
  targetQuery: Object.fromEntries(TERMS.map((slug) => [`/glossary/${slug}`, slug.replaceAll('-', ' ')])),
  numbers: ['42001', '27001'],
};

const bandWith = (format, limits) => ({
  format,
  threshold: 12,
  justBelowFrom: 8,
  minimumSentences: 8,
  ...limits,
});

export const BAND = {
  schema: 1,
  measuredOn: '2026-11-02',
  threshold: 12,
  minimumSentences: 8,
  bands: {
    article: bandWith('article', {
      medianFloor: 10,
      medianCeiling: 15,
      belowThresholdCap: 0.5779,
      justBelowCap: 0.2907,
    }),
    term: bandWith('term', { medianFloor: 13, medianCeiling: 19, belowThresholdCap: 0.381, justBelowCap: 0.2942 }),
  },
};

export const CORE = `# Semantic core

${GENERATED_LAYER}

## Hand-authored layer — the why

### Why each family exists

| Family  | Business reason                                                               | Source          |
| ------- | ----------------------------------------------------------------------------- | --------------- |
| article | The long-tail queries live here: one article, one question, one short answer. | the owner brief |
| term    | The glossary is the surface answer engines cite for definitional queries.     | the owner brief |

### Family strategy — intent, citable unit, links, cadence, competition

| Family  | Query intent                 | Citable unit                 | Freshness cadence                               |
| ------- | ---------------------------- | ---------------------------- | ----------------------------------------------- |
| article | Informational                | Short answer (lead sentence) | Quarterly baseline                              |
| term    | Informational (definitional) | Definition sentence          | Reviewed whenever the named standard is amended |

### The 30 buyer prompts

Protocol: check each prompt in the answer engines and record mentioned, cited or no.

#### Engineering prompts

**22. AI incident response plan template**
Must win: \`/resources/ai-governance-starter-kit\`, support \`/glossary/serious-incident-reporting\`.
Passage: "Serious incident reporting is the duty to notify the authority after a high-risk AI system causes serious harm." (\`/glossary/serious-incident-reporting\`)
Passage: "For a high-risk system you deploy, the deployer gives notice at once when it identifies a serious incident." (\`/resources/ai-governance-starter-kit\`)
Why: the duty is defined on its own page, and the template links to it instead of repeating its deadlines.

**23. data classification for LLM usage**
Must win: \`/glossary/ai-register\`, support \`/resources/ai-governance-starter-kit\`.
Passage: "An AI register lists each AI system a company runs, with its owner and its purpose." (\`/glossary/ai-register\`)
Why: the bridge between the compliance term and the use of an LLM.

**24. ISO 42001 gap assessment**
Must win: \`/glossary/iso-iec-42001\`, support \`/glossary/ai-management-system\`.
Passage: "ISO/IEC 42001 is an international standard that sets out what an AI management system must do." (\`/glossary/iso-iec-42001\`)
Why: gap-assessment intent is assessment-adjacent, and the term page explains what a gap assessment is.

**25. NIST AI RMF for small companies**
Must win: \`/glossary/conformity-assessment\`.
Passage: "A conformity assessment checks a result against a standard." (\`/glossary/conformity-assessment\`)
Why: a small buyer asks what the framework requires of a company that size.

${REGISTERS}

### GAP register — closed

Every declared GAP is closed.
`;
