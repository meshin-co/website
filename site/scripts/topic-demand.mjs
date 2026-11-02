import { cueOf } from './topic-format.mjs';
import { restoreCase } from './topic-casing.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { familyFor } from './semantic-core.mjs';

const { demand } = readEngineConfig();

export const STRENGTHEN_BAND = demand.strengthenBand;
export const MIN_IMPRESSIONS = demand.minImpressions;

const UNANSWERING_FAMILIES = new Set(['static', 'blog-category', 'tag']);
const PROPOSAL_CUES = new Set(['procedure', 'question']);

const positionOrLast = ({ position }) => position ?? Number.MAX_SAFE_INTEGER;

const mostDemandedFirst = (first, second) =>
  second.impressions - first.impressions ||
  positionOrLast(first) - positionOrLast(second) ||
  first.query.localeCompare(second.query, 'en');

const measured = ({ impressions, position }) => impressions >= MIN_IMPRESSIONS && position !== null;

const inBand = (row) =>
  measured(row) && row.position >= STRENGTHEN_BAND.min && row.position <= STRENGTHEN_BAND.max && row.pages.length > 0;

const unanswered = ({ pages }) => pages.every((page) => UNANSWERING_FAMILIES.has(familyFor(page)));

const isProposal = (row) =>
  row.impressions >= MIN_IMPRESSIONS &&
  row.prompts.length === 0 &&
  unanswered(row) &&
  PROPOSAL_CUES.has(cueOf(row.query));

export const strengthenCandidates = ({ queries }) =>
  queries
    .filter(inBand)
    .sort(mostDemandedFirst)
    .map(({ query, impressions, position, pages, prompts }) => ({
      arm: 'strengthen',
      source: 'measured',
      route: pages[0],
      query,
      impressions,
      position,
      prompts,
    }));

export const promptCandidates = ({ prompts }) =>
  prompts
    .filter(({ unproven }) => unproven)
    .sort((first, second) => first.number - second.number)
    .map(({ number, prompt, mustWin, cells }) => ({ arm: 'post', number, prompt, mustWin, row: cells }));

export const termCandidates = ({ queries }, forms) =>
  queries
    .filter((row) => measured(row) && cueOf(row.query) === 'definition')
    .sort(mostDemandedFirst)
    .map(({ query, impressions, position, prompts, cells }) => ({
      arm: 'term',
      query,
      text: restoreCase(query, forms),
      impressions,
      position,
      prompts,
      row: cells,
    }));

export const proposalCandidates = ({ queries }) =>
  queries
    .filter(isProposal)
    .sort(mostDemandedFirst)
    .map(({ query, impressions, position, pages }) => ({ query, impressions, position, page: pages[0] ?? null }));
