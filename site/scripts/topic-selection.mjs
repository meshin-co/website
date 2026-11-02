import { proposalCandidates, strengthenCandidates } from './topic-demand.mjs';
import { walkPosts, walkTerms } from './topic-walk.mjs';
import { measuredChoice, measuredReason, noneReason, postChoice, termChoice } from './topic-wording.mjs';

const measuredAdvisory = (row, report) => ({
  source: 'measured',
  route: row.route,
  query: row.query,
  number: row.prompts[0] ?? null,
  impressions: row.impressions,
  position: row.position,
  reason: measuredReason(row, report),
  choice: measuredChoice(row, report),
});

function publicAdvisory(advisory) {
  const { source, route, query, number, impressions, position, reason } = advisory;
  return { source, route, query, number, impressions, position, reason };
}

const postEntry = ({ candidate, topic }, report) => ({
  format: 'article',
  topic,
  prompt: { number: candidate.number, text: candidate.prompt },
  demand: { impressions: 0, position: null },
  table: 'Buyer prompts',
  row: candidate.row,
  choice: postChoice(candidate, report),
});

function promptOf({ prompts }, report, fallback) {
  const found = report.prompts.find(({ number }) => number === prompts[0]);
  return found ? { number: found.number, text: found.prompt } : fallback;
}

const termEntry = ({ candidate, topic }, { report, post }) => ({
  format: 'term',
  topic,
  prompt: promptOf(candidate, report, post.prompt),
  demand: { impressions: candidate.impressions, position: candidate.position },
  table: 'Queries',
  row: candidate.row,
  choice: termChoice(candidate, report),
});

const namedConcept = ({ candidate, topic }, why) => ({
  query: candidate.query,
  title: topic.title,
  slug: topic.slug,
  impressions: candidate.impressions,
  position: candidate.position,
  why,
});

function splitTerms(survivors, { termArm, termCap }) {
  const written = termArm ? survivors.slice(0, termCap) : [];
  const why = termArm ? 'cap' : 'term-arm-off';
  return { written, named: survivors.slice(written.length).map((survivor) => namedConcept(survivor, why)) };
}

function writeDecision({ inputs, chosen, survivors, advisories, shared }) {
  const { report, settings } = inputs;
  const post = postEntry(chosen, report);
  const { written, named } = splitTerms(survivors, settings);
  return {
    decision: 'write',
    choice: post.choice,
    reason: null,
    entries: [post, ...written.map((survivor) => termEntry(survivor, { report, post }))],
    strengthen: null,
    advisories: advisories.map(publicAdvisory),
    concepts: { named },
    ...shared,
  };
}

const strengthenDecision = (first, rest, shared) => ({
  decision: 'strengthen',
  choice: first.choice,
  reason: null,
  entries: [],
  strengthen: publicAdvisory(first),
  advisories: rest.map(publicAdvisory),
  concepts: { named: [] },
  ...shared,
});

const noneDecision = (report, shared) => ({
  decision: 'none',
  choice: null,
  reason: noneReason({ report, trail: shared.trail }),
  entries: [],
  strengthen: null,
  advisories: [],
  concepts: { named: [] },
  ...shared,
});

export function selectTopic(inputs) {
  const { report } = inputs;
  const posts = walkPosts(inputs);
  const terms = walkTerms(inputs, posts.chosen);
  const measured = strengthenCandidates(report).map((row) => measuredAdvisory(row, report));
  const advisories = [...measured, ...posts.advisories, ...terms.advisories];
  const shared = {
    refusals: [...posts.refusals, ...terms.refusals],
    proposals: proposalCandidates(report),
    trail: [...posts.trail, ...terms.trail],
  };
  if (posts.chosen) {
    return writeDecision({ inputs, chosen: posts.chosen, survivors: terms.survivors, advisories, shared });
  }
  const [first, ...rest] = advisories;
  return first ? strengthenDecision(first, rest, shared) : noneDecision(report, shared);
}
