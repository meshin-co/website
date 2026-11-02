export const RUN_DATE = '2026-11-02';

const CLAIMS = {
  term: {
    slug: 'gap-assessment',
    title: 'What is a gap assessment?',
    query: 'gap assessment',
    prompt: { number: 24, text: 'ISO 42001 gap assessment' },
  },
  article: {
    slug: 'how-to-write-an-ai-incident-response-plan',
    title: 'How to write an AI incident response plan',
    query: 'AI incident response plan',
    prompt: { number: 22, text: 'AI incident response plan template' },
  },
};

const sentences = (...parts) => parts.join(' ');
const paragraphs = (...parts) => parts.join('\n\n');
const lines = (...parts) => parts.join('\n');

const source = (id, title, url, publisher) => ({ id, title, url, publisher });

const ISO = source('S1', 'ISO/IEC 42001:2023 - AI management systems', 'https://www.iso.org/standard/42001', 'ISO');
const NIST = source(
  'S2',
  'NIST AI Risk Management Framework',
  'https://www.nist.gov/itl/ai-risk-management-framework',
  'NIST'
);
const EU = source(
  'S3',
  'Regulation (EU) 2024/1689 (the AI Act)',
  'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
  'EUR-Lex'
);
const OWASP = source(
  'S4',
  'OWASP Top 10 for Large Language Model Applications',
  'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  'OWASP'
);

const TERM_PASSAGE = 'A gap assessment compares what a company does today with what a standard or a law asks.';
const ARTICLE_PASSAGE =
  'An AI incident response plan names who is paged, what stops the system, who tells the customer and who reviews the cause.';

const TERM = {
  format: 'term',
  fields: {
    description:
      'A gap assessment compares what a company does today with what a standard asks, and lists each difference as work to close.',
    shortDefinition: sentences(TERM_PASSAGE, 'The result is a short list of gaps, each with an owner and a due date.'),
    definition: paragraphs(
      sentences(
        'A gap assessment starts from a target such as a standard, a framework or a legal duty.',
        'The assessor reads each requirement and looks for the evidence the company already holds.',
        'A requirement with no evidence is a gap.'
      ),
      sentences(
        'The result is a ranked list, not a score.',
        'Each gap names the requirement, the missing evidence, the person who will close it and a date.',
        'A good list is short enough to act on, so the assessor groups small gaps and puts the riskiest ones first.'
      ),
      sentences(
        'A gap assessment is not an audit, because nobody certifies the company and nobody signs the result.',
        'It tells the team what to build before an auditor or a customer asks for the proof.'
      )
    ),
    relatedTerms: ['ai-management-system', 'iso-iec-42001', 'conformity-assessment'],
  },
  body: lines(
    '## When does a team run one?',
    '',
    sentences(
      'A team runs one before it applies for a certificate, before it answers a large customer questionnaire and after a new law takes effect.',
      'Each run starts from one target, so the lists from different runs stay comparable.'
    ),
    '',
    '## What does the assessor need?',
    '',
    '- The policies the company has written down.',
    '- The register of AI systems the company runs today.',
    '- The records that show each policy is followed in practice.',
    '',
    'The assessor does not ask for new documents, because the point is to see what the company already holds.',
    '',
    '## How does it relate to other terms?',
    '',
    sentences(
      'ISO/IEC 42001 is the international standard for an AI management system.',
      'A [conformity assessment](/glossary/conformity-assessment) checks a result against a standard, while a gap assessment only measures the distance to it.',
      'The [AI management system](/glossary/ai-management-system) is the thing the gaps are measured against.'
    )
  ),
  sources: [ISO, NIST],
  claims: [
    {
      sentence: 'ISO/IEC 42001 is the international standard for an AI management system.',
      marker: 'sourced',
      sourceId: 'S1',
      span: 'AI management systems',
    },
    {
      sentence: 'It tells the team what to build before an auditor or a customer asks for the proof.',
      marker: 'own-reading',
      sourceId: null,
      span: null,
    },
  ],
  passage: TERM_PASSAGE,
};

const ARTICLE = {
  format: 'article',
  fields: {
    description:
      'Write an AI incident response plan in five parts: scope, owners, triggers, steps and a rehearsal. Keep it short enough to follow at night.',
    shortAnswer: sentences(
      ARTICLE_PASSAGE,
      'Write it as one page for one system, keep a single named owner and rehearse it before a real incident forces the first run.'
    ),
    fullAnswer: sentences(
      'An AI incident is any event where an AI system causes harm, leaks data or behaves in a way nobody approved.',
      'A plan for it has five parts: scope, owners, triggers, steps and a rehearsal.',
      'Scope says which systems the plan covers, and owners name one person per system and one deputy.',
      'Triggers say what counts as an incident, so nobody argues about it at night.',
      'Steps list what to do in the first hour: stop the system, keep the logs, tell the owner and tell the customer.',
      'The rehearsal tests all of it before a real event does, so the first run is not the real one.',
      'A plan that nobody has run is a guess.',
      'The sections that follow show how to write each part, who signs it and how to keep it current as the systems change.'
    ),
    keyTakeaways: [
      'Write one plan for each system, because one plan for all AI will fit none of them.',
      'Name one owner and one deputy for each system, and write both names down.',
      'Define every trigger before an incident, in words a night shift can follow.',
      'Rehearse the plan every quarter, and again after any change to the system it covers.',
    ],
    faq: [
      {
        q: 'Who should own the plan?',
        a: sentences(
          'The person who owns the system in production owns the plan.',
          'A security lead or a risk lead reviews it without running it.'
        ),
      },
      {
        q: 'How long should the plan be?',
        a: sentences(
          'One page for each system is enough.',
          'If the steps need more room, the plan covers too many systems.'
        ),
      },
      {
        q: 'When do we have to tell regulators?',
        a: sentences(
          'It depends on the system and on the law.',
          'The EU AI Act sets a duty for providers of high-risk systems to report serious incidents.'
        ),
      },
    ],
    category: 'governance',
    tags: ['ai-governance', 'production-readiness'],
    relatedResources: ['ai-governance-starter-kit'],
  },
  body: lines(
    '## What goes into the plan?',
    '',
    'The plan has five parts, and each part answers one question, so keep each part to a short paragraph or a short list.',
    '',
    '| Part | What it settles | Who writes it |',
    '| --- | --- | --- |',
    '| Scope | The systems the plan covers | System owner |',
    '| Owners | Who decides and who is the deputy | Risk lead |',
    '| Triggers | What counts as an incident | System owner and security |',
    '| Steps | What happens in the first hour | System owner |',
    '| Rehearsal | Whether the plan works when someone runs it | Risk lead |',
    '',
    '## How do you define a trigger?',
    '',
    sentences(
      'A trigger is a fact that someone can observe.',
      'One example is a customer who reports a wrong answer.',
      'Another is a log that shows the system sent data where it should not.',
      'A third is an evaluation score that falls below the floor the team agreed for that system.'
    ),
    '',
    sentences(
      'Write each trigger as a sentence with a clear yes or no answer.',
      'Vague triggers such as serious harm invite a debate while the system keeps running.'
    ),
    '',
    '## What happens in the first hour?',
    '',
    'The first hour has four jobs, and the owner works through them in this order:',
    '',
    '- Stop the system or cut its access to data.',
    '- Keep the logs and the inputs that led to the event.',
    '- Tell the owner, then the deputy if the owner does not answer.',
    '- Tell the affected customer in plain words and say what you know so far.',
    '',
    'Do not look for the cause in the first hour, because the cause comes after the system is safe.',
    '',
    '## What do the standards say?',
    '',
    sentences(
      'The NIST AI Risk Management Framework groups its guidance into four functions: Govern, Map, Measure and Manage.',
      'An incident plan belongs to the Manage function, because it describes what you do once a risk becomes real.',
      'OWASP lists prompt injection as the first risk in its guide to LLM applications, which makes it a likely trigger.'
    ),
    '',
    '## How do you keep the plan current?',
    '',
    sentences(
      'Review the plan each quarter and after every change to a system that it covers.',
      'Each review checks three things.',
      'The owner still works here, the triggers still match the system and the last rehearsal found nothing the team could not fix.'
    ),
    '',
    sentences(
      'Link the plan to your [AI register](/glossary/ai-register) so that a new system never ships without a plan.',
      'If the owner changes, read [handing over AI leadership](/blog/handing-over-ai-leadership-to-an-internal-owner) before you move the plan to a new person.'
    )
  ),
  sources: [NIST, OWASP, EU],
  claims: [
    {
      sentence:
        'The NIST AI Risk Management Framework groups its guidance into four functions: Govern, Map, Measure and Manage.',
      marker: 'sourced',
      sourceId: 'S2',
      span: 'Govern, Map, Measure, Manage',
    },
    {
      sentence:
        'OWASP lists prompt injection as the first risk in its guide to LLM applications, which makes it a likely trigger.',
      marker: 'sourced',
      sourceId: 'S4',
      span: 'LLM01: Prompt Injection',
    },
    {
      sentence: 'The EU AI Act sets a duty for providers of high-risk systems to report serious incidents.',
      marker: 'sourced',
      sourceId: 'S3',
      span: 'serious incident',
    },
    { sentence: 'A plan that nobody has run is a guess.', marker: 'own-reading', sourceId: null, span: null },
  ],
  passage: ARTICLE_PASSAGE,
};

const DRAFTS = { term: TERM, article: ARTICLE };

export const claimFor = (format, overrides = {}) => ({
  schema: 1,
  format,
  ...CLAIMS[format],
  demand: { impressions: 14, position: 11.2 },
  runId: '9001',
  status: 'claimed',
  claimedAt: '2026-11-01T07:00:00.000Z',
  expiresAt: '2026-11-15T07:00:00.000Z',
  ...overrides,
});

export const cleanDraft = (format) => structuredClone(DRAFTS[format]);
