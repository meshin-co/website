export const FUNCTION_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'do',
  'does',
  'for',
  'from',
  'how',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
]);

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const trimRoute = (route) => route.replace(/\/+$/, '') || '/';

export function routeOf(page) {
  try {
    return trimRoute(new URL(page).pathname);
  } catch {
    return trimRoute(String(page));
  }
}

const wordsOf = (text) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word !== '' && !FUNCTION_WORDS.has(word))
  );

const within = (inner, outer) => [...inner].every((word) => outer.has(word));
const fits = (a, b) => a.size > 0 && b.size > 0 && (within(a, b) || within(b, a));

export const sameDemand = (query, prompt) => fits(wordsOf(query), wordsOf(prompt));

const shaped = ({ keys = [], clicks = 0, impressions = 0, position = 0 }) => ({ keys, clicks, impressions, position });

function combine(rows, keyOf) {
  const sums = new Map();
  for (const { keys, clicks, impressions, position } of rows.map(shaped)) {
    if (impressions <= 0) continue;
    const key = keyOf(keys);
    const id = JSON.stringify(key);
    const sum = sums.get(id) ?? { key, impressions: 0, clicks: 0, weighted: 0 };
    sum.impressions += impressions;
    sum.clicks += clicks;
    sum.weighted += position * impressions;
    sums.set(id, sum);
  }
  return [...sums.values()].map(({ key, impressions, clicks, weighted }) => ({
    key,
    impressions,
    clicks,
    ctr: clicks / impressions,
    position: weighted / impressions,
  }));
}

const loudest = (a, b) => b.impressions - a.impressions || b.clicks - a.clicks || compare(a.key, b.key);
const tally = (counts, key, impressions) => counts.set(key, (counts.get(key) ?? 0) + impressions);
const ranked = (counts) => [...counts].sort(([a, x], [b, y]) => y - x || compare(a, b)).map(([key]) => key);
const sum = (rows) => rows.reduce((total, row) => total + row.impressions, 0);

function totalsOf(row) {
  const { clicks, impressions, position } = shaped(row ?? {});
  return impressions === 0
    ? { impressions: 0, clicks: 0, ctr: 0, position: null }
    : { impressions, clicks, ctr: clicks / impressions, position };
}

const askedBy = (prompt) => ({
  number: prompt.number,
  routes: new Set([prompt.mustWin, ...prompt.support].filter(Boolean).map(trimRoute)),
  words: wordsOf(prompt.prompt),
});

function promptRow(prompt, proofs) {
  const own = proofs.filter(({ numbers }) => numbers.includes(prompt.number)).map(({ pair }) => pair);
  const impressions = sum(own);
  const routes = new Map();
  for (const pair of own) tally(routes, pair.key[1], pair.impressions);
  const weighted = own.reduce((total, pair) => total + pair.position * pair.impressions, 0);
  return {
    number: prompt.number,
    prompt: prompt.prompt,
    mustWin: prompt.mustWin,
    impressions,
    position: impressions === 0 ? null : weighted / impressions,
    carriedBy: ranked(routes),
  };
}

function queryRow({ key, ...measured }, group) {
  const routes = new Map();
  for (const { pair } of group) tally(routes, pair.key[1], pair.impressions);
  const numbers = new Set(group.flatMap((proof) => proof.numbers));
  return { query: key, ...measured, pages: ranked(routes), prompts: [...numbers].sort((a, b) => a - b) };
}

export function buildDemand({ window, property, prompts, data }) {
  const totals = totalsOf(data.totals);
  const pairs = combine(data.pairs, ([query, page]) => [query, routeOf(page)]);
  const asking = prompts.map(askedBy);
  const proofs = pairs.map((pair) => ({
    pair,
    numbers: asking
      .filter(({ routes, words }) => routes.has(pair.key[1]) && fits(wordsOf(pair.key[0]), words))
      .map(({ number }) => number),
  }));
  const proofsByQuery = Map.groupBy(proofs, ({ pair }) => pair.key[0]);

  const queries = combine(data.queries, ([query]) => query)
    .sort(loudest)
    .map((row) => queryRow(row, proofsByQuery.get(row.key) ?? []));
  const pages = combine(data.pages, ([page]) => routeOf(page))
    .sort(loudest)
    .map(({ key, ...measured }) => ({ route: key, ...measured }));
  const days = combine(data.days, ([day]) => day)
    .sort((a, b) => compare(a.key, b.key))
    .map(({ key, ...measured }) => ({ day: key, ...measured }));
  const busiest = days.reduce((best, day) => (best === null || day.impressions > best.impressions ? day : best), null);

  return {
    window,
    property,
    totals,
    queries,
    withheld: Math.max(0, totals.impressions - sum(queries)),
    pages,
    pageImpressions: sum(pages),
    days,
    firstDay: days[0]?.day ?? null,
    busiestDay: busiest && { day: busiest.day, impressions: busiest.impressions },
    prompts: prompts.map((prompt) => promptRow(prompt, proofs)),
  };
}
