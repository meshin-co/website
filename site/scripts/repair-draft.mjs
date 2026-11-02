import { isDeepStrictEqual } from 'node:util';

import { describeProblem } from './autowriter-records.mjs';
import { resolveClaimTable } from './claim-sources.mjs';
import { parseEntrySource } from './entry-prose.mjs';
import { validateJsonSchema } from './json-schema.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { outputSchema } from './writer-output.mjs';

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const OPTIONAL_LISTS = ['faq', 'tags', 'relatedResources', 'relatedTerms'];

const stop = (message) => new RepairStop('failed', message);

function readEntry(entryText) {
  let entry;
  try {
    entry = parseEntrySource(entryText);
  } catch (error) {
    throw stop(`the entry front matter is unreadable: ${error.message}`);
  }
  if (typeof entry.frontmatter !== 'object' || Array.isArray(entry.frontmatter))
    throw stop('the entry front matter is not a mapping');
  return entry;
}

function dayOf(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value !== 'string' || !CALENDAR_DAY.test(value)) return null;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value) ? value : null;
}

export function publishDateOf(entryText) {
  const { publishDate } = readEntry(entryText).frontmatter;
  const day = dayOf(publishDate);
  if (day === null) throw stop(`the entry publishDate ${JSON.stringify(publishDate)} is not a calendar day`);
  return day;
}

function fieldsOf(format, frontmatter) {
  const schema = outputSchema(format).properties.fields;
  const fields = {};
  const missing = [];
  for (const name of Object.keys(schema.properties)) {
    const value = frontmatter[name] ?? (OPTIONAL_LISTS.includes(name) ? [] : undefined);
    if (value === undefined) missing.push(name);
    else fields[name] = value;
  }
  if (missing.length > 0) throw stop(`the ${format} entry front matter lacks ${missing.join(', ')}`);
  const problems = validateJsonSchema(schema, fields);
  if (problems.length > 0)
    throw stop(`the entry front matter does not fit a ${format}: ${describeProblem(problems[0])}`);
  return fields;
}

function idFinder(claimTable, listed) {
  const idOfUrl = new Map();
  for (const { source } of claimTable) if (source && !idOfUrl.has(source.url)) idOfUrl.set(source.url, source.id);
  for (const url of idOfUrl.keys())
    if (!listed.includes(url)) throw stop(`the claim table names the source ${url}, which the entry does not list`);
  const used = new Set(idOfUrl.values());
  const taken = new Set();
  return (url, position) => {
    const known = idOfUrl.get(url);
    if (known !== undefined && !taken.has(known)) return taken.add(known) && known;
    let id = `source-${position}`;
    for (let copy = 2; used.has(id); copy += 1) id = `source-${position}-${copy}`;
    used.add(id);
    return id;
  };
}

function sourcesOf(frontmatter, claimTable) {
  const { sources } = frontmatter;
  const isListed = (source) => typeof source?.title === 'string' && typeof source.url === 'string';
  if (!Array.isArray(sources) || !sources.every(isListed))
    throw stop('the entry sources are not a list of title and url');
  const idFor = idFinder(
    claimTable,
    sources.map(({ url }) => url)
  );
  return sources.map(({ title, url, publisher }, index) => ({
    id: idFor(url, index + 1),
    title,
    url,
    publisher: typeof publisher === 'string' ? publisher : '',
  }));
}

export function draftOfEntry({ claim, entryText, claimTable, passage }) {
  const { frontmatter, body } = readEntry(entryText);
  const fields = fieldsOf(claim.format, frontmatter);
  const sources = sourcesOf(frontmatter, claimTable);
  const claims = claimTable.map(({ sentence, marker, source, span }) => ({
    sentence,
    marker,
    sourceId: source?.id ?? null,
    span,
  }));
  return { format: claim.format, fields, body: body.trim(), sources, claims, passage };
}

const withoutIds = ({ sentence, marker, source, span }) => ({
  sentence,
  marker,
  source: source && { title: source.title, url: source.url },
  span,
});

const comparableTable = ({ claims, sources }) => {
  try {
    return resolveClaimTable({ claims, sources }).map(withoutIds);
  } catch {
    return null;
  }
};

const comparableSources = (sources) => sources.map(({ title, url, publisher }) => ({ title, url, publisher }));

export function sameEntry(left, right) {
  const leftTable = comparableTable(left);
  const rightTable = comparableTable(right);
  return (
    leftTable !== null &&
    rightTable !== null &&
    isDeepStrictEqual(left.fields, right.fields) &&
    left.body.trim() === right.body.trim() &&
    isDeepStrictEqual(comparableSources(left.sources), comparableSources(right.sources)) &&
    isDeepStrictEqual(leftTable, rightTable) &&
    left.passage === right.passage
  );
}
