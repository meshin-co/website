import { newClaim } from './autowriter-claim-store.mjs';
import { newLedger } from './autowriter-ledger.mjs';
import { callTotals, ledgerWithGeneration } from './generation-record.mjs';
import { recordPath } from './record-layout.mjs';

const reportBlock = (report, path) => ({
  path,
  measured: report.measured,
  windowStart: report.windowStart,
  windowEnd: report.windowEnd,
  property: report.property,
  generatedFrom: report.generatedFrom,
});

function claimOf(entry, { runId, now }) {
  const { topic, format, demand, prompt, origin, category, weakness } = entry;
  const claim = newClaim({
    slug: topic.slug,
    title: topic.title,
    format,
    query: topic.query,
    demand: { ...demand },
    prompt: prompt && { ...prompt },
    origin,
    category,
    weakness: weakness && [...weakness],
    runId,
    now,
  });
  return { claimPath: recordPath('claim', topic.slug, claim.claimedAt), claim };
}

function openLedger({ slug, runId, proposal }) {
  const ledger = newLedger({ slug, runId, pullRequest: null });
  return proposal === undefined ? ledger : ledgerWithGeneration(ledger, callTotals(proposal.calls));
}

function assertWritable({ decision: kind, entries }) {
  if (kind !== 'write') throw new Error(`buildRun needs a write decision, got a ${kind} decision`);
  if (entries.length === 0) throw new Error('buildRun needs a write decision with an entry, got no entry');
  if (entries[0].format !== 'article') {
    throw new Error(`the first entry of a write decision must be the article, got a ${entries[0].format}`);
  }
}

export function buildRun({ decision, report, runId, now, reportPath }) {
  assertWritable(decision);
  const claims = decision.entries.map((entry) => claimOf(entry, { runId, now }));
  const refusals = decision.refusals.map((refusal) => ({ ...refusal }));
  const postSlug = decision.entries[0].topic.slug;
  const ledger = openLedger({ slug: postSlug, runId, proposal: decision.entries[0].proposal });
  if (refusals.length > 0) ledger.refusals = refusals;
  const ledgerPath = recordPath('ledger', postSlug, claims[0].claim.claimedAt);
  const entries = decision.entries.map(({ row, table, choice, proposal }, at) => ({
    ...claims[at],
    row,
    table,
    choice,
    ...(proposal === undefined ? {} : { proposal: structuredClone(proposal) }),
  }));
  const file = {
    schema: 1,
    decision: 'write',
    ledgerPath,
    entries,
    report: reportBlock(report, reportPath),
    refusals,
  };
  return { ledgerPath, ledger, claims, file };
}
