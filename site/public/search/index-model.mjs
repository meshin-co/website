const MINIMUM_WORD_LENGTH = 2;

export const MAXIMUM_WORD_LENGTH = 32;
export const MAXIMUM_QUERY_WORDS = 8;
export const MAXIMUM_RESULTS = 20;
export const INDEX_ROOT = '/search-index';

export const TITLE_WEIGHT = 8;
export const DESCRIPTION_WEIGHT = 3;
export const TEXT_WEIGHT = 1;

export const STOP_WORDS = new Set(
  'about after all also am an and any are as at be been but by can could did do does for from had has have how if in into is its just me more my not of on or our out so some such than that the their them then there these they this those to was we were what when where which who why will with would you your'.split(
    ' '
  )
);

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

const stripMarkdown = (markdown) =>
  collapse(
    markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_>]/g, '')
  );

const withoutTrailingSlash = (href) => (href.length > 1 ? href.replace(/\/$/, '') : href);

export function buildIndexEntry({ href, title, description, kind, body }) {
  return {
    href: withoutTrailingSlash(href),
    title,
    description: collapse(description),
    kind,
    text: stripMarkdown(body ?? ''),
  };
}

export const queryWords = (text) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MINIMUM_WORD_LENGTH)
    .map((word) => word.slice(0, MAXIMUM_WORD_LENGTH));

export const termsOf = (text) => queryWords(text).filter((word) => !STOP_WORDS.has(word));

export function searchWords(query) {
  const repeats = new Map();
  for (const word of termsOf(query)) {
    if (repeats.has(word) || repeats.size < MAXIMUM_QUERY_WORDS) repeats.set(word, (repeats.get(word) ?? 0) + 1);
  }
  return [...repeats].map(([word, repeat]) => ({ word, repeat }));
}

export function decodeChunk(flat) {
  const entries = [];

  for (let at = 0; at < flat.length;) {
    const count = flat[at + 1];
    const size = Math.abs(count);
    let id = 0;
    entries.push({
      key: flat[at],
      ids: flat.slice(at + 2, at + 2 + size).map((step) => (id += step)),
      weights: flat.slice(at + 2 + size, at + 2 + 2 * size),
      truncated: count < 0,
    });
    at += 2 + 2 * size;
  }

  return entries;
}

export function chunkFor(lastKeys, word) {
  let low = 0;
  let high = lastKeys.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    if (lastKeys[middle] < word) low = middle + 1;
    else high = middle;
  }

  return low < lastKeys.length ? low : -1;
}

export function entryFor(entries, word) {
  const found = entries.find(({ key }) => key >= word);
  return found?.key.startsWith(word) ? found : null;
}

export function kindOfId(kindRuns, id) {
  let low = 0;
  let high = kindRuns.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (kindRuns[middle][0] <= id) low = middle;
    else high = middle - 1;
  }

  return kindRuns[low][1];
}

export function rankLists(lists) {
  if (lists.length === 0 || lists.includes(null)) return [];

  const weightsById = lists.map(({ ids, weights }) => new Map(ids.map((id, index) => [id, weights[index]])));
  const filters = weightsById.filter((_, index) => !lists[index].truncated);
  const candidates =
    filters.length > 0
      ? [...filters.reduce((best, current) => (current.size < best.size ? current : best)).keys()].filter((id) =>
          filters.every((weights) => weights.has(id))
        )
      : [...new Set(weightsById.flatMap((weights) => [...weights.keys()]))];

  return candidates
    .map((id) => ({
      id,
      score: lists.reduce((sum, { repeat }, index) => sum + repeat * (weightsById[index].get(id) ?? 0), 0),
    }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

export function createSearch(fetchJson) {
  const files = new Map();

  const fetchOnce = (path) => {
    if (!files.has(path)) {
      files.set(
        path,
        fetchJson(path).catch((error) => {
          files.delete(path);
          throw error;
        })
      );
    }
    return files.get(path);
  };

  async function answer(query) {
    const words = searchWords(query);
    if (words.length === 0) return { kinds: [], rows: [] };

    const manifest = await fetchOnce(`${INDEX_ROOT}/manifest.json`);
    const root = `${INDEX_ROOT}/${manifest.version}`;
    const lists = await Promise.all(
      words.map(async ({ word, repeat }) => {
        const chunk = chunkFor(manifest.lastKeys, word);
        if (chunk < 0) return null;
        const entry = entryFor(decodeChunk(await fetchOnce(`${root}/t/${chunk}.json`)), word);
        return entry && { ...entry, repeat };
      })
    );

    const ranked = rankLists(lists);
    const top = ranked.slice(0, MAXIMUM_RESULTS);
    const pageOf = (id) => Math.floor(id / manifest.pageSize);
    const pages = new Map(
      await Promise.all(
        [...new Set(top.map(({ id }) => pageOf(id)))].map(async (page) => [
          page,
          await fetchOnce(`${root}/d/${page}.json`),
        ])
      )
    );

    return {
      kinds: ranked.map(({ id }) => kindOfId(manifest.kindRuns, id)),
      rows: top.map(({ id }) => {
        const [href, title, description] = pages.get(pageOf(id))[id % manifest.pageSize];
        return { href, title, description, kind: kindOfId(manifest.kindRuns, id) };
      }),
    };
  }

  return async (query) => {
    try {
      return await answer(query);
    } catch {
      files.clear();
      return answer(query);
    }
  };
}
