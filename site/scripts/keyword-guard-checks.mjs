import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = {
  selection: 'scripts/topic-selection.mjs',
  keywords: 'scripts/topic-keywords.mjs',
  scene: 'scripts/fixtures/topic-inputs.mjs',
  limits: 'scripts/entry-limits.mjs',
};
const PILOTS = 'why do AI pilots fail to reach production';
const TOP = {
  phrase: 'ai governance framework',
  exact: 803,
  slug: 'ai-governance-framework',
  held: 'Another title entirely',
};
const NEXT = { phrase: 'ai governance policy', exact: 32, slug: 'ai-governance-policy', held: 'Yet another title' };
const OWNED = { phrase: 'evals checklist', exact: 1200, route: '/glossary/evals' };
const ALSO_OWNED = { phrase: 'ai register template', exact: 900, route: '/glossary/ai-register' };
const RECORDED_AT = 100;

const pass = (reason) => ({ ok: true, reason });
const fail = (reason) => ({ ok: false, reason });
const writtenBy = ({ entries }) => entries.map(({ topic }) => JSON.stringify(topic.title)).join(', ') || 'nothing';
const holding = (scene, { slug, held }) => scene.claimed(slug, held);

function sceneInputs({ scene, limits }, { rows, prompts = [], claims = [], handled = [] }) {
  const keywords = rows.map(({ phrase, exact }) => scene.keywordRow(phrase, exact));
  return scene.inputsFor(scene.reportOf(prompts), {
    rotation: limits.CATEGORIES.slice(0, 2),
    keywords: scene.keywordsOf(keywords, { handled }),
    claims,
  });
}

const select = (modules, scene) => modules.selection.selectTopic(sceneInputs(modules, scene));

function takesTheSlotAheadOfTheRotation(modules) {
  const decision = select(modules, { rows: [NEXT, TOP] });
  if (decision.decision !== 'write') {
    return `with no Search Console lead, keyword candidates ended in a ${decision.decision} decision, not a write ahead of the category rotation`;
  }
  const [entry] = decision.entries;
  if (decision.entries.length !== 1 || entry.origin !== 'keyword' || entry.topic.query !== TOP.phrase) {
    return `the keyword with the most exact impressions was not the only entry written, marked keyword: the decision writes ${writtenBy(decision)}`;
  }
  if (entry.demand.impressions !== TOP.exact || entry.demand.position !== null) {
    return `the keyword entry carries demand ${JSON.stringify(entry.demand)}, not its exact count with no position`;
  }
  if (decision.fallback !== null) return 'a keyword pick left a category rotation for a model call to try';
  return null;
}

function yieldsToSearchConsole(modules) {
  const prompts = [modules.scene.prompt(9, PILOTS)];
  const decision = select(modules, { rows: [TOP, NEXT], prompts });
  const origins = decision.entries.map(({ origin }) => origin);
  if (decision.decision !== 'write' || origins.includes('keyword') || !origins.includes('demand')) {
    return `a Search Console lead lost to a keyword candidate: the decision writes ${writtenBy(decision)}`;
  }
  if (decision.trail.some(({ arm }) => arm === 'keyword'))
    return 'a Search Console lead still walked keyword candidates';
  return null;
}

function skipsWhatIsOccupied(modules) {
  const { scene } = modules;
  const taken = select(modules, { rows: [TOP, NEXT], claims: [holding(scene, TOP)] });
  if (taken.decision !== 'write' || taken.entries.length !== 1) {
    return `a candidate a claim holds was not skipped: the decision is ${taken.decision} and writes ${writtenBy(taken)}`;
  }
  if (taken.entries[0].topic.slug !== NEXT.slug) {
    return `a candidate a claim holds was not skipped for the next one: the decision writes ${writtenBy(taken)}`;
  }
  const all = select(modules, { rows: [TOP, NEXT], claims: [holding(scene, TOP), holding(scene, NEXT)] });
  if (all.decision === 'write' || all.entries.length > 0) {
    return `occupied candidates were written: the decision writes ${writtenBy(all)}`;
  }
  if (!(all.fallback?.categories.length > 0)) return 'occupied candidates left no category rotation to fall to';
  const walked = all.trail.filter(({ arm, outcome }) => arm === 'keyword' && outcome !== 'chosen');
  return walked.length === 2 ? null : `occupied candidates left ${walked.length} refused steps in the trail, not 2`;
}

function advisesWhatTheRegisterOwns(modules) {
  const decision = select(modules, { rows: [OWNED, TOP] });
  if (decision.entries.length !== 1 || decision.entries[0].topic.slug !== TOP.slug) {
    return `a candidate that names a register concept was not set aside for the next one: the decision writes ${writtenBy(decision)}`;
  }
  const advised = [decision.strengthen, ...decision.advisories].find((row) => row?.route === OWNED.route);
  if (advised?.source !== 'register-owner' || advised.impressions !== OWNED.exact) {
    return `no advisory names ${OWNED.route} with the ${OWNED.exact} exact impressions of the phrase that names its concept`;
  }
  return null;
}

const recorded = ({ phrase, route }, impressions) => ({
  phrase,
  route,
  impressions,
  handledOn: '2026-11-10',
  reason: 'Added a section that answers the phrase.',
});

const advisedFor = (decision, { route, phrase }) =>
  [decision.strengthen, ...decision.advisories].some((row) => row?.route === route && row.query === phrase);

function quietsWhatIsHandled(modules) {
  const rows = [OWNED, ALSO_OWNED, TOP];
  const handled = select(modules, { rows, handled: [recorded(OWNED, OWNED.exact)] });
  if (advisedFor(handled, OWNED)) {
    return `a pair recorded as handled was advised again: ${OWNED.route} for ${JSON.stringify(OWNED.phrase)}`;
  }
  if (!advisedFor(handled, ALSO_OWNED)) {
    return `handling one pair silenced ${ALSO_OWNED.route}, which was never recorded as handled`;
  }
  const grown = select(modules, { rows, handled: [recorded(OWNED, RECORDED_AT)] });
  if (!advisedFor(grown, OWNED)) {
    return `a handled pair whose exact impressions grew from ${RECORDED_AT} to ${OWNED.exact} was not advised again`;
  }
  return null;
}

function toleratesNoReport(modules) {
  const { keywords } = modules;
  let report;
  try {
    report = keywords.readKeywords(join(import.meta.dirname, 'no-such-tree'));
  } catch (error) {
    return `a missing keyword report is an error: ${error.message}`;
  }
  if (keywords.keywordCandidates(report).length > 0) return 'a missing keyword report offered candidates';
  const decision = select(modules, { rows: [] });
  if (decision.entries.length > 0 || !(decision.fallback?.categories.length > 0)) {
    return 'a report with no candidate did not leave the decision to the category rotation';
  }
  return null;
}

const PROBLEMS = [
  takesTheSlotAheadOfTheRotation,
  yieldsToSearchConsole,
  skipsWhatIsOccupied,
  advisesWhatTheRegisterOwns,
  quietsWhatIsHandled,
  toleratesNoReport,
];

export function keywordRungCheck(modules) {
  for (const problemOf of PROBLEMS) {
    const problem = problemOf(modules);
    if (problem !== null) return fail(problem);
  }
  return pass(
    `with no Search Console lead the keyword with the most exact impressions (${JSON.stringify(TOP.phrase)}, ${TOP.exact}) ` +
      'is the only entry written, marked keyword, with no model call; a Search Console lead still wins; ' +
      'a candidate a claim holds is skipped and, when all are held, the category rotation takes over with every step kept; ' +
      `${JSON.stringify(OWNED.phrase)} is advised against ${OWNED.route}, not written, until a ledger row records it as handled, and then again once its exact impressions double; ` +
      'a missing report is no candidates and no error'
  );
}

export const KEYWORD_CHECKS = {
  'keyword-rung-in-the-ladder': keywordRungCheck,
};

export async function loadKeywordModules(copySite) {
  const loaded = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => [key, await import(pathToFileURL(join(copySite, file)).href)])
  );
  return Object.fromEntries(loaded);
}

export async function runKeywordCheck(name, copySite) {
  if (!Object.hasOwn(KEYWORD_CHECKS, name)) throw new Error(`no keyword check named ${name}`);
  return KEYWORD_CHECKS[name](await loadKeywordModules(copySite));
}
