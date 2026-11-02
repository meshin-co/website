import { stringify } from 'yaml';

import { COLLECTION_OF } from './entry-prose.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { WriterError } from './writer-error.mjs';
import { DATA_DIRECTORY } from './writer-tree.mjs';

const { formats } = readEngineConfig().content;
const ROUTE_PREFIX = { term: formats.term.routePrefix, article: formats.article.routePrefix };
const TERM_TITLE = /^What (?:is|are) (?:(?:a|an|the) )?(.+)\?$/;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ARTICLE_AUTHOR = formats.article.author;
const YAML_OPTIONS = { version: '1.1', lineWidth: 0, singleQuote: true, aliasDuplicateObjects: false };

export function writtenFormat(format) {
  if (!(format in ROUTE_PREFIX)) {
    const written = Object.keys(ROUTE_PREFIX).join(' and ');
    throw new WriterError('build', `the unattended writer writes ${written} entries, not "${format}"`);
  }
  return format;
}

export const entryPath = ({ format, slug }) => `${DATA_DIRECTORY}/${COLLECTION_OF[writtenFormat(format)]}/${slug}.md`;

export const entryRoute = ({ format, slug }) => `${ROUTE_PREFIX[writtenFormat(format)]}${slug}`;

export function termOf(title) {
  const match = TERM_TITLE.exec(title.trim());
  if (!match)
    throw new WriterError('build', `the title "${title}" does not have the shape What is|are {a|an|the }{term}?`);
  return match[1].trim();
}

function dayOf(runDate) {
  const day = new Date(`${runDate}T00:00:00Z`);
  const isCalendarDay =
    CALENDAR_DAY.test(runDate) && !Number.isNaN(day.getTime()) && day.toISOString().startsWith(runDate);
  if (!isCalendarDay)
    throw new WriterError('build', `runDate must be a calendar day written YYYY-MM-DD, not "${runDate}"`);
  return day;
}

const present = (value) => (value === '' || (Array.isArray(value) && value.length === 0) ? undefined : value);

const sourcesOf = (sources, runDate) =>
  sources.map(({ title, url, publisher }) => ({ title, url, publisher: present(publisher), retrieved: runDate }));

const FRONTMATTER = {
  term: ({ claim, fields, sources, day }) => ({
    title: claim.title,
    term: termOf(claim.title),
    description: fields.description,
    publishDate: day,
    updatedDate: day,
    shortDefinition: fields.shortDefinition,
    definition: fields.definition,
    relatedTerms: present(fields.relatedTerms),
    sources,
  }),
  article: ({ claim, fields, sources, day }) => ({
    title: claim.title,
    description: fields.description,
    publishDate: day,
    updatedDate: day,
    shortAnswer: fields.shortAnswer,
    fullAnswer: fields.fullAnswer,
    keyTakeaways: fields.keyTakeaways,
    faq: present(fields.faq),
    category: fields.category,
    tags: present(fields.tags),
    sources,
    author: ARTICLE_AUTHOR,
    relatedResources: present(fields.relatedResources),
  }),
};

const documentOf = (frontmatter, body) => {
  const prose = body.trim();
  return `---\n${stringify(frontmatter, YAML_OPTIONS)}---\n${prose === '' ? '' : `\n${prose}\n`}`;
};

export function renderEntry({ claim, draft, runDate }) {
  const format = writtenFormat(claim.format);
  const day = dayOf(runDate);
  const context = { claim, fields: draft.fields, sources: sourcesOf(draft.sources, runDate), day };
  return {
    path: entryPath(claim),
    route: entryRoute(claim),
    text: documentOf(FRONTMATTER[format](context), draft.body),
  };
}
