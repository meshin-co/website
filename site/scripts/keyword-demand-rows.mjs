import { recordsOf, tablesIn } from './markdown-table.mjs';
import { unticked } from './report-reading.mjs';
import { within, wordsOf } from './search-demand-rows.mjs';

const ROUTE_COLUMNS = ['Route', 'Query', 'Title'];
const TITLE_PLACEHOLDER = '{title}';
const CONCEPT_PLACEHOLDER = '{concept}';

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const phraseOf = (text) => text.toLowerCase().replaceAll('?', '').replace(/\s+/g, ' ').trim();

const withoutSuffix = (title, suffix) =>
  suffix !== '' && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;

export function readRouteFacts(coreDoc, suffix) {
  return tablesIn(typeof coreDoc === 'string' ? coreDoc : '')
    .filter(({ header }) => ROUTE_COLUMNS.every((name) => header.includes(name)))
    .flatMap(recordsOf)
    .map(({ Route, Query, Title }) => ({ route: unticked(Route), query: Query, title: withoutSuffix(Title, suffix) }));
}

export const termTitles = (routes, routePrefix) =>
  routes.filter(({ route }) => route.startsWith(routePrefix)).map(({ title }) => title);

export function expandPhrases({ concepts, titles, templates }) {
  const phrases = new Set();
  for (const template of templates) {
    const [placeholder, subjects] = template.includes(TITLE_PLACEHOLDER)
      ? [TITLE_PLACEHOLDER, titles]
      : [CONCEPT_PLACEHOLDER, concepts];
    for (const subject of subjects) phrases.add(phraseOf(template.replace(placeholder, () => subject)));
  }
  return [...phrases].filter((phrase) => wordsOf(phrase).size > 0);
}

export function servedBy(phrase, routes) {
  const words = wordsOf(phrase);
  if (words.size === 0) return [];
  const serving = routes
    .filter(({ query, title }) => [query, title].some((text) => within(words, wordsOf(text))))
    .map(({ route }) => route);
  return [...new Set(serving)].sort(compare);
}

const total = (weeks, field) => weeks.reduce((sum, week) => sum + week[field], 0);

const loudest = (a, b) => b.exact - a.exact || b.broad - a.broad || compare(a.phrase, b.phrase);

const pricedRow = ({ phrase, weeks }, measured) => ({
  phrase,
  exact: total(weeks, 'exact'),
  broad: total(weeks, 'broad'),
  weeks: weeks.length,
  measured,
});

export function buildKeywords({ measured, market, stats, carried = [], unmeasured = [], routes }) {
  const phrases = [...stats.map((stat) => pricedRow(stat, measured)), ...carried]
    .map((row) => ({ ...row, servedBy: servedBy(row.phrase, routes) }))
    .sort(loudest);
  const days = stats.flatMap(({ weeks }) => weeks.map(({ day }) => day)).sort();
  return {
    window: { measured, startDate: days[0] ?? null, endDate: days.at(-1) ?? null },
    market,
    run: { priced: stats.length, carried: carried.length },
    phrases,
    candidates: phrases
      .filter(({ exact, servedBy: serving }) => exact > 0 && serving.length === 0)
      .map(({ phrase, exact, broad }) => ({ phrase, exact, broad })),
    unmeasured: [...unmeasured].sort(compare),
  };
}
