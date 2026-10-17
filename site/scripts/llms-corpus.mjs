import { LLMS_SHARD_MAX_ENTRIES } from '../src/utils/llms-collections.mjs';

const ENTRY_LINE = /^\[(https?:\/\/[^\]]+)\]\(\1\)$/gm;
const INDEX_LINE = /^- \[Entries (\d+)-(\d+)\]\(https?:\/\/[^)]*(\/llms\/[^)/]+\.txt)\): (\d+) entr/gm;

const entryUrls = (text) => [...text.matchAll(ENTRY_LINE)].map(([, url]) => url);
const paramOf = (path) => path.replace(/^\/llms\/|\.txt$/g, '');
const isShardOf = (name, param) => new RegExp(`^${name}-\\d+$`).test(param);

const indexRows = (text) =>
  [...text.matchAll(INDEX_LINE)].map(([, from, to, path, count]) => ({
    from: Number(from),
    to: Number(to),
    path,
    count: Number(count),
  }));

const countInLlmsTxt = (llmsTxt, name) =>
  new RegExp(`\\]\\(https?://[^)]*/llms/${name}\\.txt\\): (\\d+) entr`).exec(llmsTxt)?.[1];

function rowGaps(row, position, rows, text, state) {
  const gaps = [];
  const declared = /^## .*, entries (\d+)-(\d+)$/m.exec(text);
  if (!declared || Number(declared[1]) !== row.from || Number(declared[2]) !== row.to) {
    gaps.push(`${row.path} declares entries ${declared?.[1]}-${declared?.[2]}, the index says ${row.from}-${row.to}`);
  }
  if (row.from !== state.expectedFrom)
    gaps.push(`${row.path} starts at entry ${row.from}, expected ${state.expectedFrom}`);
  state.expectedFrom = row.to + 1;
  const urls = entryUrls(text);
  if (urls.length !== row.count || row.to - row.from + 1 !== row.count) {
    gaps.push(`${row.path} holds ${urls.length} entries, the index says ${row.count} (range ${row.from}-${row.to})`);
  }
  if (urls.length > LLMS_SHARD_MAX_ENTRIES) {
    gaps.push(`${row.path} holds ${urls.length} entries, over the ${LLMS_SHARD_MAX_ENTRIES} entry cap`);
  }
  for (const url of urls) {
    if (state.seen.has(url)) gaps.push(`${url} ships twice across the ${state.name} shards`);
    state.seen.add(url);
  }
  const next = rows[position + 1];
  const nextLink = /^Next part: \[https?:\/\/[^\]]*(\/llms\/[^\]/]+\.txt)\]/m.exec(text)?.[1];
  const isLast = /^This is the last part\.$/m.test(text);
  if (next && isLast) gaps.push(`${row.path} says it is the last part, the index lists a ${next.path}`);
  else if (next && nextLink !== next.path) gaps.push(`${row.path} does not link to ${next.path} as its next part`);
  if (!next && !isLast) gaps.push(`${row.path} is the last shard but does not say so`);
  return gaps;
}

function shardGaps(name, rows, files) {
  const listed = new Set(rows.map(({ path }) => paramOf(path)));
  const gaps = Object.keys(files)
    .filter((param) => isShardOf(name, param) && !listed.has(param))
    .map((param) => `/llms/${param}.txt ships but the ${name} index does not list it`);
  const state = { name, expectedFrom: 1, seen: new Set() };
  rows.forEach((row, position) => {
    const text = files[paramOf(row.path)];
    if (text === undefined) gaps.push(`the ${name} index lists ${row.path}, which did not ship`);
    else gaps.push(...rowGaps(row, position, rows, text, state));
  });
  return gaps;
}

export function llmsCorpusGaps({ llmsTxt, files, collections }) {
  return collections.flatMap(({ name }) => {
    const text = files[name];
    if (text === undefined) return [];
    const stated = countInLlmsTxt(llmsTxt, name);
    if (stated === undefined) return [`llms.txt has no count line for ${name}`];
    const rows = indexRows(text);
    const hasShards = Object.keys(files).some((param) => isShardOf(name, param));
    const gaps = rows.length > 0 || hasShards ? shardGaps(name, rows, files) : [];
    const shipped =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + entryUrls(files[paramOf(row.path)] ?? '').length, 0)
        : entryUrls(text).length;
    if (Number(stated) !== shipped)
      gaps.unshift(`llms.txt says ${stated} entries for ${name}, its files hold ${shipped}`);
    return gaps;
  });
}
