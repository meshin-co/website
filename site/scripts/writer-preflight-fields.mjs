import { countWords } from '../src/utils/content-rules.mjs';
import { CATEGORIES, COUNT_LIMITS, META_DESCRIPTION_MAX_CHARS, WORD_LIMITS } from './entry-limits.mjs';
import { COLLECTION_OF, RESOURCE_COLLECTION, wordCount } from './entry-prose.mjs';

export const SOURCE_MINIMUM = { article: 3, term: 1 };
export const PASSAGE_WORD_CAP = 40;
const PASSAGE_QUOTES = /["\u201c\u201d]/;
const PASSAGE_MARKDOWN = /[*_`#[\]|>\\~]/;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const FENCED = /^\s{0,3}(`{3,}|~{3,})[\s\S]*?(?:^\s{0,3}\1\s*$|(?![\s\S]))/gm;
const HEADING_ONE = /^\s{0,3}#\s/m;
const RAW_HTML = /<\/?(?!https?:)[a-zA-Z][^>]*>/;
const IMAGE = /!\[[^\]]*\]\(/;
const LINK = /\]\(([^)\s]+)\)|<(https?:\/\/[^>\s]+)>/g;

const problem = (rule, detail) => ({ rule, detail });
const rangeText = ({ min, max }) => (min <= 1 ? `at most ${max}` : `${min}-${max}`);

function wordRange(field, text, limit) {
  const count = countWords(text);
  const inside = count >= limit.min && count <= limit.max;
  return inside
    ? []
    : [problem('word-range', `${field} has ${count} words; content.config.ts allows ${rangeText(limit)}`)];
}

function countRange(field, items, limit) {
  const inside = items.length >= limit.min && items.length <= limit.max;
  return inside
    ? []
    : [problem('count-range', `${field} has ${items.length} entries; allowed ${limit.min}-${limit.max}`)];
}

function descriptionProblems(description) {
  if (description.trim() === '') return [problem('description-length', 'description is empty')];
  if (description.length <= META_DESCRIPTION_MAX_CHARS) return [];
  return [
    problem(
      'description-length',
      `description has ${description.length} characters; the cap is ${META_DESCRIPTION_MAX_CHARS}`
    ),
  ];
}

const unknown = (rule, field, values, known) =>
  values
    .filter((value) => !known.includes(value))
    .map((value) => problem(rule, `${field} "${value}" is not in the site's list`));

function faqProblems(faq) {
  const blank = ({ q, a }) => q.trim() === '' || a.trim() === '';
  return faq.flatMap((entry, index) =>
    blank(entry) ? [problem('faq-entry', `faq[${index}] needs a question and an answer`)] : []
  );
}

function sourceProblems(sources, format) {
  const minimum = SOURCE_MINIMUM[format];
  const found =
    sources.length >= minimum
      ? []
      : [problem('source-count', `sources has ${sources.length} entries; a ${format} needs at least ${minimum}`)];
  const ids = new Set();
  const urls = new Map();
  sources.forEach(({ id, title, url }, index) => {
    const label = id.trim() === '' ? `#${index + 1}` : id;
    if (id.trim() === '' || ids.has(id)) found.push(problem('source-id', `source ${label} has a blank or repeated id`));
    ids.add(id);
    if (title.trim() === '') found.push(problem('source-title', `source ${label} has no title`));
    if (!URL.canParse(url) || new URL(url).protocol !== 'https:')
      found.push(problem('source-url', `source ${label} has the url "${url}", which is not an https url`));
    else if (urls.has(url))
      found.push(problem('source-url-duplicate', `source ${label} repeats the url of ${urls.get(url)}`));
    else urls.set(url, label);
  });
  return found;
}

function passageProblems(passage) {
  const words = wordCount(passage);
  const found = [];
  if (words === 0 || words > PASSAGE_WORD_CAP)
    found.push(
      problem(
        'passage-length',
        `the passage has ${words} words; it must be one sentence of 1-${PASSAGE_WORD_CAP} words`
      )
    );
  if (PASSAGE_QUOTES.test(passage)) found.push(problem('passage-characters', 'the passage holds a quotation mark'));
  if (PASSAGE_MARKDOWN.test(passage))
    found.push(problem('passage-characters', 'the passage holds a markdown character'));
  return found;
}

function bodyProblems(body, routes) {
  if (body.trim() === '') return [problem('body-empty', 'the body is empty')];
  const text = body.replace(FENCED, '');
  const found = [];
  if (HEADING_ONE.test(text))
    found.push(problem('body-heading', 'the body holds an h1; the page already has one, so start at ##'));
  if (RAW_HTML.test(text)) found.push(problem('body-markup', 'the body holds raw html; write markdown only'));
  if (IMAGE.test(text)) found.push(problem('body-markup', 'the body holds an image; write a table instead'));
  for (const [, inline, auto] of text.matchAll(LINK)) {
    const href = inline ?? auto;
    const path = href.split(/[?#]/)[0].replace(/(.)\/$/, '$1');
    if (href.startsWith('https://') || href.startsWith('#')) continue;
    if (!href.startsWith('/'))
      found.push(problem('body-link', `the link ${href} is neither an https url nor a route of this site`));
    else if (!routes.includes(path)) found.push(problem('body-link', `the link ${href} points at no known route`));
  }
  return found;
}

function dayProblems(runDate) {
  const day = new Date(`${runDate}T00:00:00Z`);
  const valid = CALENDAR_DAY.test(runDate) && !Number.isNaN(day.getTime()) && day.toISOString().startsWith(runDate);
  return valid ? [] : [problem('run-date', `the run date must be a calendar day written YYYY-MM-DD, not "${runDate}"`)];
}

const FORMAT_FIELDS = {
  term: ({ fields }, { slugs }) => [
    ...wordRange('shortDefinition', fields.shortDefinition, WORD_LIMITS.shortDefinition),
    ...wordRange('definition', fields.definition, WORD_LIMITS.definition),
    ...unknown('unknown-related-term', 'relatedTerms', fields.relatedTerms, slugs[COLLECTION_OF.term]),
  ],
  article: ({ fields }, { slugs, tags }) => [
    ...wordRange('shortAnswer', fields.shortAnswer, WORD_LIMITS.shortAnswer),
    ...wordRange('fullAnswer', fields.fullAnswer, WORD_LIMITS.fullAnswer),
    ...countRange('keyTakeaways', fields.keyTakeaways, COUNT_LIMITS.keyTakeaways),
    ...countRange('faq', fields.faq, COUNT_LIMITS.faq),
    ...faqProblems(fields.faq),
    ...(CATEGORIES.includes(fields.category)
      ? []
      : [problem('category', `category "${fields.category}" is not one of ${CATEGORIES.join(', ')}`)]),
    ...unknown('unknown-tag', 'tags', fields.tags, tags),
    ...unknown('unknown-related-resource', 'relatedResources', fields.relatedResources, slugs[RESOURCE_COLLECTION]),
  ],
};

export function fieldProblems({ draft, claim, context, runDate }) {
  const format = claim.format;
  const mismatch =
    draft.format === format
      ? []
      : [problem('format-mismatch', `the draft is a ${draft.format} and the claim is a ${format}`)];
  return [
    ...mismatch,
    ...dayProblems(runDate),
    ...descriptionProblems(draft.fields.description),
    ...FORMAT_FIELDS[format](draft, context),
    ...sourceProblems(draft.sources, format),
    ...passageProblems(draft.passage),
    ...bodyProblems(draft.body, context.routes),
  ];
}
