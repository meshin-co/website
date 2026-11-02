import { COLLECTION_OF, proseBlocks, proseSentences, wordCount } from './entry-prose.mjs';
import { splitSentences } from './prose-rules.mjs';
import { CARRY_SHARE, CARRY_SHARE_WHOLE_ENTRY, uncarried } from './repair-carry.mjs';

export const WORD_FLOOR = 0.9;
export const WORD_FLOOR_WHOLE_ENTRY = 0.75;
export const MAY = ['takeaways', 'faq', 'sources', 'claims', 'headings', 'words-down'];

const SHOWN_CHARACTERS = 240;
const HEADING = /^\s{0,3}#{2,6}\s/;
const FENCE = /^\s{0,3}(```|~~~)/;
const FLOAT_SLACK = 1e-9;

const problem = (rule, detail) => ({ rule, detail });
const shown = (text) => (text.length > SHOWN_CHARACTERS ? `${text.slice(0, SHOWN_CHARACTERS)}...` : text);

function proseOf(draft) {
  const collection = COLLECTION_OF[draft.format];
  const blocksOf = (frontmatter, body) => proseBlocks({ collection, frontmatter, body });
  return {
    all: blocksOf(draft.fields, draft.body),
    takeaways: blocksOf({ keyTakeaways: draft.fields.keyTakeaways }, ''),
    faq: blocksOf({ faq: draft.fields.faq }, ''),
  };
}

const wordsIn = (blocks) => blocks.reduce((total, block) => total + wordCount(block), 0);

function headingCount(body) {
  let fenced = false;
  let count = 0;
  for (const line of body.split('\n')) {
    if (FENCE.test(line)) fenced = !fenced;
    else if (!fenced && HEADING.test(line)) count += 1;
  }
  return count;
}

function sourcedByUrl({ sources, claims }) {
  const urlOf = new Map(sources.map(({ id, url }) => [id, url]));
  const counts = new Map();
  for (const { marker, sourceId } of claims) {
    if (marker === 'sourced' && urlOf.has(sourceId))
      counts.set(urlOf.get(sourceId), (counts.get(urlOf.get(sourceId)) ?? 0) + 1);
  }
  return counts;
}

function exemptSentences({ before, prose, may }) {
  const exempt = new Set();
  if (may.includes('takeaways')) for (const sentence of proseSentences(prose.takeaways)) exempt.add(sentence);
  if (may.includes('faq')) for (const sentence of proseSentences(prose.faq)) exempt.add(sentence);
  if (may.includes('claims')) for (const { sentence } of before.claims) exempt.add(sentence);
  return exempt;
}

function textProblems({ before, after, may }) {
  const prose = { before: proseOf(before), after: proseOf(after) };
  const wholeEntry = may.includes('words-down');
  const exempt = exemptSentences({ before, prose: prose.before, may });
  const required = proseSentences(prose.before.all).filter((sentence) => !exempt.has(sentence));
  const removed = uncarried({
    before: required,
    after: prose.after.all.map(splitSentences),
    share: wholeEntry ? CARRY_SHARE_WHOLE_ENTRY : CARRY_SHARE,
  });
  const had = wordsIn(prose.before.all);
  const has = wordsIn(prose.after.all);
  const floor = Math.ceil(had * (wholeEntry ? WORD_FLOOR_WHOLE_ENTRY : WORD_FLOOR) - FLOAT_SLACK);
  const sentencesHad = proseSentences(prose.before.all).length;
  const sentencesHas = proseSentences(prose.after.all).length;
  return [
    ...removed.map((sentence) =>
      problem(
        'text-removed',
        `"${shown(sentence)}" is gone from the entry: a repair rewrites a sentence; it never deletes one`
      )
    ),
    ...(wholeEntry && removed.length === 0 && sentencesHas < sentencesHad
      ? [
          problem(
            'text-removed',
            `the entry had ${sentencesHad} sentences and now has ${sentencesHas}: a whole-entry rewrite changes words, never the number of sentences`
          ),
        ]
      : []),
    ...(has < floor
      ? [
          problem(
            'text-below-floor',
            `the prose is down to ${has} words: a repair keeps at least ${floor} of the ${had} it had`
          ),
        ]
      : []),
  ];
}

const countProblem = (rule, label, had, has) =>
  has < had ? [problem(rule, `the entry had ${had} ${label} and now has ${has}`)] : [];

function structureProblems({ before, after, may }) {
  const count = (draft, field) => (draft.fields[field] ?? []).length;
  return [
    ...(may.includes('headings')
      ? []
      : countProblem('heading-removed', 'headings', headingCount(before.body), headingCount(after.body))),
    ...(may.includes('faq') ? [] : countProblem('faq-removed', 'FAQ items', count(before, 'faq'), count(after, 'faq'))),
    ...(may.includes('takeaways')
      ? []
      : countProblem('takeaway-removed', 'key takeaways', count(before, 'keyTakeaways'), count(after, 'keyTakeaways'))),
  ];
}

function sourceProblems({ before, after, may }) {
  const kept = new Set(after.sources.map(({ url }) => url));
  const cited = sourcedByUrl(after);
  const dropped = may.includes('sources') ? [] : before.sources.filter(({ url }) => !kept.has(url));
  const unclaimed = may.includes('claims')
    ? []
    : [...sourcedByUrl(before)].filter(([url, rows]) => (cited.get(url) ?? 0) < rows);
  return [
    ...dropped.map(({ url }) => problem('source-removed', `the source ${url} was dropped`)),
    ...unclaimed.map(([url, rows]) =>
      problem('claim-removed', `${rows} sourced claim rows rested on ${url} and ${cited.get(url) ?? 0} do now`)
    ),
  ];
}

const passageProblems = ({ before, after }) =>
  before.passage === after.passage
    ? []
    : [
        problem(
          'passage-changed',
          'the passage is the sentence a buyer prompt is answered with, and a repair leaves it as it was'
        ),
      ];

export function removalProblems({ before, after, may = [] }) {
  const unknown = may.find((name) => !MAY.includes(name));
  if (unknown !== undefined) throw new Error(`unknown allowance ${unknown}; the guard knows ${MAY.join(', ')}`);
  return [
    ...textProblems({ before, after, may }),
    ...structureProblems({ before, after, may }),
    ...sourceProblems({ before, after, may }),
    ...passageProblems({ before, after }),
  ];
}
