import { MIN_IMPRESSIONS, STRENGTHEN_BAND, strengthenCandidates } from './topic-demand.mjs';

const { min, max } = STRENGTHEN_BAND;

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const positionText = (value) => `position ${value.toFixed(1)}`;
const measuredLine = ({ query, impressions, position }, measured) =>
  `"${query}", ${plural(impressions, 'impression')} at ${positionText(position)}, measured ${measured}`;

export const postChoice = ({ number }, { windowEnd }) =>
  `Choice: signal 2, prompt ${number}, unproven, 0 impressions in the window to ${windowEnd}`;

const orderName = (order) => (order.kind === 'prompt' ? `prompt ${order.number}` : `"${order.text}"`);

export const orderedChoice = (order) => `Choice: ordered, ${orderName(order)}, requested by hand`;

export const orderedReason = (order, { outcome, detail }) =>
  `The order for ${orderName(order)} was refused (${outcome}), so nothing was written and no other topic was tried: ${detail}`;

export const noSuchPrompt = (number, count) =>
  `the report holds no prompt numbered ${number}; it holds ${plural(count, 'prompt')}`;

export const retiredPrompt = (number) =>
  `prompt ${number} is retired in docs/SEMANTIC-CORE.md, so no article is written for it`;

export const termChoice = (row, { measured }) => `Choice: signal 3, ${measuredLine(row, measured)}`;

export const measuredChoice = (row, { measured }) => `Choice: signal 1, ${measuredLine(row, measured)}`;

const WEAKNESS_WORDS = {
  'no-buyer-prompt': 'no buyer prompt names it',
  'impressions-at-floor': `impressions at the floor of ${MIN_IMPRESSIONS}`,
  'position-beyond-strengthen-band': `position worse than ${max}`,
};

export const weakChoice = (row, { measured }) =>
  `Choice: signal 3, ${measuredLine(row, measured)}; ` +
  `weak demand: ${row.weakness.map((reason) => WEAKNESS_WORDS[reason]).join(', ')}`;

const standingText = ({ articles, newest }) => {
  if (articles === 0) return 'no article yet';
  return newest === null ? plural(articles, 'article') : `${plural(articles, 'article')}, newest ${newest}`;
};

export const categoryChoice = (standing) =>
  `Choice: category ${standing.category}, ${standingText(standing)}; ` +
  'no unproven prompt or weak query survived, so the rotation chose it';

export const keywordChoice = ({ phrase, exact, measured }) =>
  `Choice: keyword, "${phrase}", ${plural(exact, 'exact impression')} on Bing, measured ${measured}`;

export const strengthens = (choice, route) => `${choice}; strengthens ${route}`;

const windowText = ({ impressions, position }, { windowStart, windowEnd }) =>
  `${plural(impressions, 'impression')} at ${positionText(position)} over ${windowStart} to ${windowEnd}`;

export const measuredReason = (row, window) =>
  `query "${row.query}" has ${windowText(row, window)}, inside positions ${min} to ${max}: ` +
  'strengthen the route that already ranks and add no page';

export const promptReason = ({ number }, detail) => `prompt ${number} is unproven and ${detail}`;

export const termReason = (row, window, detail) =>
  `${detail}; the query "${row.query}" has ${windowText(row, window)}: strengthen that route and add no page`;

export const keywordReason = ({ exact, measured }, detail) =>
  `${detail}; the phrase has ${plural(exact, 'exact impression')} on Bing, measured ${measured}: ` +
  'strengthen that route and add no page';

const OUTCOME_LABELS = [
  ['retired', 'retired prompt'],
  ['definition', 'a definition, left to the term arm'],
  ['title-too-long', 'title too long for a page'],
  ['no-slug', 'no slug can be made'],
  ['register-owner', 'concept already in the register'],
  ['family-served', 'already answered in its own format'],
  ['route-exists', 'route already published'],
  ['title-collision', 'title already taken'],
  ['slug-held', 'slug already held'],
];

const nearest = (rows, toward) => {
  if (rows.length === 0) return '';
  const row = rows.reduce((best, next) => (toward(next.position, best.position) ? next : best));
  return ` (nearest "${row.query}" at ${positionText(row.position)})`;
};

function strengthenSentence(queries) {
  if (queries.length === 0) return 'Strengthen: the report lists no query row.';
  const placed = queries.filter(({ position }) => position !== null);
  const better = placed.filter(({ position }) => position < min);
  const worse = placed.filter(({ position }) => position > max);
  const inBand = strengthenCandidates({ queries }).length;
  return (
    `Strengthen: ${inBand} of ${plural(queries.length, 'query row')} between positions ${min} and ${max} with an impression; ` +
    `better than ${min}: ${better.length}${nearest(better, (next, best) => next > best)}; ` +
    `worse than ${max}: ${worse.length}${nearest(worse, (next, best) => next < best)}.`
  );
}

function writeSentence(prompts, trail) {
  const unproven = prompts.filter((prompt) => prompt.unproven).length;
  if (unproven === 0) return 'Write: no prompt is unproven.';
  const posts = trail.filter(({ arm }) => arm === 'post');
  const counts = OUTCOME_LABELS.map(([outcome, label]) => [
    label,
    posts.filter((step) => step.outcome === outcome).length,
  ])
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}: ${count}`);
  return `Write: ${plural(unproven, 'unproven prompt')} examined; ${counts.join('; ')}.`;
}

export function noneReason({ report, trail }) {
  if (report.queries.length === 0 && report.prompts.length === 0)
    return 'The report holds no query and no buyer prompt, so there is nothing to choose from.';
  return ['No candidate.', strengthenSentence(report.queries), writeSentence(report.prompts, trail)].join(' ');
}
