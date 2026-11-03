import { siteBrand } from './site-brand.mjs';
import { PRIMARY_DOMAINS } from './claim-sources.mjs';
import { entryRoute } from './entry-files.mjs';
import { COLLECTION_OF, RESOURCE_COLLECTION } from './entry-prose.mjs';
import { CATEGORIES, COUNT_LIMITS, META_DESCRIPTION_MAX_CHARS, WORD_LIMITS } from './entry-limits.mjs';
import { targetQueryFor } from './route-derive.mjs';
import { BAND_FILE } from './sentence-band.mjs';
import { headingOf } from './writer-page.mjs';
import { PASSAGE_WORD_CAP, SOURCE_MINIMUM } from './writer-preflight-fields.mjs';
import { DATA_DIRECTORY } from './writer-tree.mjs';

const NOUN = { term: 'glossary term', article: 'blog article' };

const wordsIn = ({ min, max }) => (min <= 1 ? `at most ${max} words` : `${min} to ${max} words`);
const between = ({ min, max }) => `${min} to ${max}`;
const sourcesIn = (minimum) => `${minimum} source${minimum === 1 ? '' : 's'}`;
const share = (cap) => `${Math.floor(cap * 1000) / 10}%`;
const bullets = (items) => items.map((item) => `- ${item}`).join('\n');
const fromList = (member, list) => `${member}: slugs that exist, taken from the ${list} in the request.`;
const description = `description: one plain sentence for the meta description, at most ${META_DESCRIPTION_MAX_CHARS} characters.`;

const FIELD_NOTES = {
  term: () => [
    description,
    `shortDefinition: the definition on its own, ${wordsIn(WORD_LIMITS.shortDefinition)}. It names the term and needs no other text to be understood.`,
    `definition: the longer definition, ${wordsIn(WORD_LIMITS.definition)}, in paragraphs separated by one blank line.`,
    `${fromList('relatedTerms', 'glossary list')} An empty list when none fits.`,
  ],
  article: () => [
    description,
    `shortAnswer: the answer on its own, ${wordsIn(WORD_LIMITS.shortAnswer)}. It needs no other text to be understood.`,
    `fullAnswer: the lead paragraph, ${wordsIn(WORD_LIMITS.fullAnswer)}.`,
    `keyTakeaways: ${between(COUNT_LIMITS.keyTakeaways)} plain sentences, each one a thing the reader keeps.`,
    `faq: ${between(COUNT_LIMITS.faq)} objects with q and a. q is the question as a buyer asks it. a answers it in full sentences.`,
    `category: one of ${CATEGORIES.join(', ')}.`,
    fromList('tags', 'tag list'),
    `${fromList('relatedResources', 'resource list')} An empty list when none fits.`,
  ],
};

const intro = (format) =>
  `You are the writer of ${siteBrand().name}. You write one ${NOUN[format]} for the claim in the request. It is published without a person reading it first, and nothing on the page says a machine wrote it. It has to read as careful human work and pass every gate of the repository the first time it is built.`;

const rules = (texts) =>
  [
    '# The rules of the repository',
    'Each block below is copied word for word from the file named in its tag. Together they are the rules your entry is checked against. They were written for people who edit the site by hand. Where a rule names a file you cannot edit, such as the ledger, the facts file or the registers, the pipeline that publishes your entry does that work, and you do only what this prompt asks.',
    ...texts.map(({ path, blocks }) => `<file path="${path}">\n${blocks.join('\n\n')}\n</file>`),
  ].join('\n\n');

const members = (format) =>
  [
    `- format: "${format}".`,
    '- fields: an object with these members:',
    ...FIELD_NOTES[format]().map((note) => `  - ${note}`),
    '- body: the markdown that follows the lead on the page. Start at ##, because the page has its h1. Write paragraphs, lists, tables and bold only: no raw HTML, no image, no h1. Link to this site with a route from the list in the request, and to the outside with an https url. Do not repeat a field inside the body.',
    `- sources: at least ${sourcesIn(SOURCE_MINIMUM[format])} that you cite. Each has id (a short label, never repeated), title (the document's title), url (https, one url per source) and publisher. Cite a document only when you are sure it exists at that url and says what you rest on it.`,
    '- claims: one row for every sentence of the entry that states a fact. A sentence states a fact when it holds a figure, a date or a month, or names a standard, a law or a regulation (ISO, IEC, NIST, OWASP, GDPR, the AI Act, an article or an annex). A row has these members:',
    '  - sentence: the sentence copied word for word from the entry.',
    '  - marker: "sourced" or "own-reading".',
    '  - sourceId: the id of the one source it rests on, or null.',
    '  - span: the words of that source that support the sentence, quoted exactly, or null.',
    `- passage: one sentence of the entry, copied word for word, at most ${PASSAGE_WORD_CAP} words, with no quotation mark and no markdown character. It is the sentence a reader or a search engine should quote for the buyer prompt.`,
  ].join('\n');

const claimRules = [
  'A sentence that states a fact is never marked "own-reading". It is "sourced", with its sourceId and its span.',
  'A claim marked "own-reading" is interpretation only: a judgement, a recommendation or an explanation by the author. Its sourceId and span are null.',
  `A sentence about a standard, a law or a regulation rests on a source from a primary domain: ${PRIMARY_DOMAINS.join(', ')}.`,
  'Do not write TODO(owner) or any placeholder, and do not invent a source. A fact you cannot source is left out.',
];

const contract = (format) =>
  [
    '# What you return',
    'Return one JSON object that matches the schema you are given, and nothing else. Its members:',
    members(format),
    '# How the claims are checked',
    bullets(claimRules),
  ].join('\n\n');

const numbers = (allowed) =>
  [
    '# Numbers',
    `Write no number except years, dates and standard or article numbers (ISO/IEC 42001, Article 6)${allowed.length === 0 ? '. No other number is verified, so write none' : `, and the allowed numbers: ${allowed.join(', ')}`}.`,
    'Any other figure fails the gate as unsourced-number. State the idea without the figure, and never invent one to fit.',
  ].join('\n\n');

const words = ({ bannedPhrases, controlledWords }) =>
  [
    '# Banned phrases',
    `Never write one of these, in any case or inflection: ${bannedPhrases.join(', ')}.`,
    '# Plain words',
    'Write the word on the right of each arrow, never the word on its left.',
    Object.entries(controlledWords)
      .map(([word, use]) => `${word} -> ${use}`)
      .join('\n'),
  ].join('\n\n');

const lengths = (band, format) =>
  [
    '# Sentence length',
    `Measured on the hand-written ${NOUN[format]} entries of this site and recorded in ${BAND_FILE}. The band is the check, and it is also the target:`,
    bullets([
      `Median sentence: ${band.medianFloor} to ${band.medianCeiling} words.`,
      `At most ${share(band.belowThresholdCap)} of the sentences have fewer than ${band.threshold} words.`,
      `At most ${share(band.justBelowCap)} of the sentences have ${band.justBelowFrom} to ${band.threshold - 1} words.`,
      `Write at least ${band.minimumSentences} sentences.`,
    ]),
    `A sentence of ${band.threshold} words or more that also stands on another route fails the duplicate rule. The answer is not to cut every sentence to ${band.threshold - 1} words: write the lengths a careful person writes, short and long, inside the band.`,
  ].join('\n\n');

export const systemPrompt = ({ claim, read }) =>
  [
    intro(claim.format),
    rules(read.texts),
    contract(claim.format),
    numbers(read.data.numbers),
    words(read.data),
    lengths(read.data.band, claim.format),
  ].join('\n\n');

const demandText = ({ impressions, position }, row) =>
  [
    `Demand when the topic was chosen: ${impressions} impressions, ${position === null ? 'no position' : `average position ${position}`}.`,
    row === undefined
      ? ''
      : `The Search Console row it was chosen from:\n${bullets(Object.entries(row).map(([key, value]) => `${key}: ${value}`))}`,
  ]
    .filter(Boolean)
    .join('\n');

export const claimFacts = (claim) => [
  `Format: ${NOUN[claim.format]}`,
  `Slug: ${claim.slug}`,
  `Route: ${entryRoute(claim)}`,
  `Title: ${claim.title}`,
  `Page heading (h1): ${headingOf(claim)}`,
  `Query it answers: ${claim.query}`,
  `Declared target query: ${targetQueryFor({ claim })}`,
  `Buyer prompt ${claim.prompt.number}: ${claim.prompt.text}`,
];

const claimText = (claim, runDate) =>
  bullets([
    ...claimFacts(claim),
    `Run date: ${runDate}. The published date and the updated date of the entry are this day.`,
  ]);

const listOf = (heading, items, separator) => `${heading}\n${items.join(separator)}`;

export const contextLists = (read) => [
  listOf('Routes that exist (audits/routes.json). A link to this site is exactly one of them:', read.data.routes, '\n'),
  listOf(`Glossary terms that exist (${DATA_DIRECTORY}/${COLLECTION_OF.term}):`, read.data.glossary, ', '),
  listOf(`Resources that exist (${DATA_DIRECTORY}/${RESOURCE_COLLECTION}):`, read.data.resource, ', '),
  listOf(`Tags that exist (${DATA_DIRECTORY}/tags.mjs):`, read.data.tags, ', '),
];

export const userPrompt = ({ claim, demandRow, runDate, read }) =>
  [
    'Write this entry.',
    claimText(claim, runDate),
    demandText(claim.demand, demandRow),
    `The block of docs/SEMANTIC-CORE.md for this buyer prompt, copied from the file:\n${read.data.promptBlock}`,
    ...contextLists(read),
  ].join('\n\n');
