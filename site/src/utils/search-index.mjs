import { createHash } from 'node:crypto';

import {
  DESCRIPTION_WEIGHT,
  INDEX_ROOT,
  TEXT_WEIGHT,
  TITLE_WEIGHT,
  kindOfId,
  termsOf,
} from '../../public/search/index-model.mjs';

const CHUNK_BYTES = 12_288;
const MAXIMUM_POSTING_BYTES = 10;

export const INDEX_LIMITS = Object.freeze({
  chunkBytes: CHUNK_BYTES,
  pageDocuments: 6,
  listCap: Math.floor(CHUNK_BYTES / MAXIMUM_POSTING_BYTES),
});

export const ROW_LIMITS = Object.freeze({ href: 160, title: 160, description: 500 });

const MINIMUM_KEY_LENGTH = 2;
const compareHref = new Intl.Collator('en').compare;
const compareKeys = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export const manifestPath = `${INDEX_ROOT}/manifest.json`;
export const chunkPath = (version, chunk) => `${INDEX_ROOT}/${version}/t/${chunk}.json`;
export const pagePath = (version, page) => `${INDEX_ROOT}/${version}/d/${page}.json`;

export function indexPaths({ version, lastKeys, documents, pageSize }) {
  return [
    manifestPath,
    ...lastKeys.map((_, chunk) => chunkPath(version, chunk)),
    ...Array.from({ length: Math.ceil(documents / pageSize) }, (_, page) => pagePath(version, page)),
  ];
}

function termWeights({ title, description, text }) {
  const weights = new Map();
  const add = (source, weight) => {
    for (const term of termsOf(source)) weights.set(term, (weights.get(term) ?? 0) + weight);
  };

  add(title, TITLE_WEIGHT);
  add(description, DESCRIPTION_WEIGHT);
  add(text, TEXT_WEIGHT);
  return weights;
}

function mergeLists(lists) {
  const sums = new Map();
  for (const { ids, weights } of lists) ids.forEach((id, index) => sums.set(id, (sums.get(id) ?? 0) + weights[index]));

  const ids = [...sums.keys()].sort((a, b) => a - b);
  return { ids, weights: ids.map((id) => sums.get(id)) };
}

function keyedLists(postings) {
  const terms = [...postings.keys()].sort();
  const keys = [];

  const visit = (low, high, depth) => {
    if (depth < MINIMUM_KEY_LENGTH) {
      for (let at = low; at < high;) {
        let end = at + 1;
        while (end < high && terms[end][depth] === terms[at][depth]) end++;
        visit(at, end, depth + 1);
        at = end;
      }
      return null;
    }

    const sources = [];
    const own = terms[low].length === depth;
    if (own) sources.push(postings.get(terms[low]));

    for (let at = own ? low + 1 : low; at < high;) {
      let end = at + 1;
      while (end < high && terms[end][depth] === terms[at][depth]) end++;
      sources.push(visit(at, end, depth + 1));
      at = end;
    }

    const merged = sources.length === 1 ? sources[0] : mergeLists(sources);
    if (own || sources.length > 1) keys.push({ key: terms[low].slice(0, depth), ...merged });
    return merged;
  };

  visit(0, terms.length, 0);

  return keys;
}

const clipped = (text, limit) => (text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text);

function pageRow({ href, title, description }) {
  if (href.length > ROW_LIMITS.href)
    throw new Error(`search index: href longer than ${ROW_LIMITS.href} characters: ${href}`);
  return [href, clipped(title, ROW_LIMITS.title), clipped(description, ROW_LIMITS.description)];
}

function capped({ ids, weights }, listCap) {
  if (ids.length <= listCap) return { ids, weights, truncated: false };

  const best = ids
    .map((_, index) => index)
    .sort((a, b) => weights[b] - weights[a] || ids[a] - ids[b])
    .slice(0, listCap)
    .sort((a, b) => a - b);
  return { ids: best.map((index) => ids[index]), weights: best.map((index) => weights[index]), truncated: true };
}

function encoded({ key, ids, weights, truncated }) {
  let previous = 0;
  const steps = ids.map((id) => {
    const step = id - previous;
    previous = id;
    return step;
  });
  const count = truncated ? -ids.length : ids.length;
  return [JSON.stringify(key), count, ...steps, ...weights].join(',');
}

function cut(pieces, limit) {
  const chunks = [];
  let current = [];
  let size = 2;

  for (const piece of pieces) {
    const added = Buffer.byteLength(piece) + 1;
    if (current.length > 0 && size + added > limit) {
      chunks.push(current);
      current = [];
      size = 2;
    }
    current.push(piece);
    size += added;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

const sorted = (entries) =>
  [...entries].sort(
    (a, b) => compareHref(a.href, b.href) || compareHref(a.kind, b.kind) || compareHref(a.title, b.title)
  );

export function buildSearchIndex(entries, limits = INDEX_LIMITS) {
  const documents = sorted(entries);
  const postings = new Map();

  documents.forEach((document, id) => {
    for (const [term, weight] of termWeights(document)) {
      const list = postings.get(term) ?? { ids: [], weights: [] };
      list.ids.push(id);
      list.weights.push(weight);
      postings.set(term, list);
    }
  });

  const keys = keyedLists(postings).sort(compareKeys);
  const chunks = cut(
    keys.map((list) => ({ ...capped(list, limits.listCap), key: list.key })).map(encoded),
    limits.chunkBytes
  );
  const lastKeys = chunks.map((chunk) => JSON.parse(`[${chunk.at(-1)}]`)[0]);
  const pages = Array.from({ length: Math.ceil(documents.length / limits.pageDocuments) }, (_, page) =>
    documents.slice(page * limits.pageDocuments, (page + 1) * limits.pageDocuments).map(pageRow)
  );
  const kindRuns = documents.reduce(
    (runs, { kind }, id) => (runs.at(-1)?.[1] === kind ? runs : [...runs, [id, kind]]),
    []
  );

  const chunkTexts = chunks.map((chunk) => `[${chunk.join(',')}]`);
  const pageTexts = pages.map((rows) => JSON.stringify(rows));
  const version = createHash('sha1')
    .update(JSON.stringify([limits.pageDocuments, kindRuns, lastKeys]))
    .update(chunkTexts.join('\n'))
    .update(pageTexts.join('\n'))
    .digest('hex')
    .slice(0, 10);

  const manifest = { version, documents: documents.length, pageSize: limits.pageDocuments, lastKeys, kindRuns };
  const files = new Map([[manifestPath, JSON.stringify(manifest)]]);
  chunkTexts.forEach((text, chunk) => files.set(chunkPath(version, chunk), text));
  pageTexts.forEach((text, page) => files.set(pagePath(version, page), text));

  return { manifest, files };
}

export function readIndexDocuments(readText) {
  const manifest = JSON.parse(readText(manifestPath));
  const pageCount = Math.ceil(manifest.documents / manifest.pageSize);

  return Array.from({ length: pageCount }, (_, page) => JSON.parse(readText(pagePath(manifest.version, page)))).flatMap(
    (rows, page) =>
      rows.map(([href, title, description], row) => ({
        href,
        title,
        description,
        kind: kindOfId(manifest.kindRuns, page * manifest.pageSize + row),
      }))
  );
}
