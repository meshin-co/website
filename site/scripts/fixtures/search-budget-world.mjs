import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { decodeChunk } from '../../public/search/index-model.mjs';
import {
  INDEX_LIMITS,
  ROW_LIMITS,
  buildSearchIndex,
  chunkPath,
  manifestPath,
  pagePath,
} from '../../src/utils/search-index.mjs';
import { FIRST_QUERY_BUDGET_BYTES, searchIndexProblems } from '../search-budget.mjs';

const VOCABULARY = Array.from({ length: 60 }, (_, index) => `term${index.toString(36).padStart(2, '0')}`);

export const ROW_SHAPE = `[href, title, description] strings of at most ${ROW_LIMITS.href}, ${ROW_LIMITS.title} and ${ROW_LIMITS.description} characters`;

export const firstQueryLine = (bytes) =>
  `search-index: first query worst case ${bytes} bytes gz (over ${FIRST_QUERY_BUDGET_BYTES})`;

const sequence = (seed) => {
  let state = seed;
  return (limit) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return Math.floor(state / 65536) % limit;
  };
};

export const articles = (count, { words = 1200 } = {}) => {
  const next = sequence(7);
  const phrase = (length) => Array.from({ length }, () => VOCABULARY[next(VOCABULARY.length)]).join(' ');
  return Array.from({ length: count }, (_, index) => ({
    href: `/blog/article-${String(index).padStart(4, '0')}`,
    title: phrase(3),
    description: phrase(8),
    kind: 'Writing',
    text: phrase(words),
  }));
};

export const sharedTermIndex = (count, limits = INDEX_LIMITS) =>
  buildSearchIndex(
    Array.from({ length: count }, (_, index) => ({
      href: `/blog/shared-${String(index).padStart(5, '0')}`,
      title: 'sharedterm',
      description: '',
      kind: 'Writing',
      text: '',
    })),
    limits
  );

export const ARTICLES = articles(600);
export const GREEN = buildSearchIndex(ARTICLES);
export const CHUNKS = GREEN.manifest.lastKeys.length;
export const PAGES = Math.ceil(GREEN.manifest.documents / GREEN.manifest.pageSize);
export const LAST_KEY = GREEN.manifest.lastKeys.at(-1);

export const chunk = (index) => chunkPath(GREEN.manifest.version, index);
export const page = (index) => pagePath(GREEN.manifest.version, index);
export const quoted = (text) => JSON.stringify(text);

export const change = (files, path, text) => new Map(files).set(path, text);

export const without = (files, path) => {
  const copy = new Map(files);
  copy.delete(path);
  return copy;
};

export const withManifest = (files, edit) =>
  change(files, manifestPath, JSON.stringify({ ...GREEN.manifest, ...edit }));

const flatOf = (entries) =>
  entries.flatMap(({ key, ids, weights, truncated = false }) => [
    key,
    truncated ? -ids.length : ids.length,
    ...ids.map((id, at) => id - (at === 0 ? 0 : ids[at - 1])),
    ...weights,
  ]);

export const entriesOf = (files, index) => decodeChunk(JSON.parse(files.get(chunk(index))));
export const withEntries = (files, index, entries) => change(files, chunk(index), JSON.stringify(flatOf(entries)));
export const rowsOf = (files, index) => JSON.parse(files.get(page(index)));
export const withRows = (files, index, rows) => change(files, page(index), JSON.stringify(rows));

export const withFirstEntry = (files, index, edit) => {
  const [first, ...rest] = entriesOf(files, index);
  return withEntries(files, index, [{ ...first, ...edit }, ...rest]);
};

export const withLastKeyRenamed = (key) => {
  const entries = entriesOf(GREEN.files, CHUNKS - 1);
  const renamed = withEntries(GREEN.files, CHUNKS - 1, [...entries.slice(0, -1), { ...entries.at(-1), key }]);
  return withManifest(renamed, { lastKeys: [...GREEN.manifest.lastKeys.slice(0, -1), key] });
};

export const padded = (text, bytes) => text + ' '.repeat(bytes - Buffer.byteLength(text));

export const scratch = (files) => {
  const site = mkdtempSync(join(tmpdir(), 'search-budget-'));
  const dist = join(site, 'dist');
  for (const [path, text] of files) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), text);
  }
  return { site, dist, discard: () => rmSync(site, { recursive: true, force: true }) };
};

export const withDist = (files, run) => {
  const { dist, discard } = scratch(files);
  try {
    return run(dist);
  } finally {
    discard();
  }
};

export const problemsOf = (files) => withDist(files, searchIndexProblems);
