import { newClaim } from './autowriter-claim-store.mjs';
import { newLedger } from './autowriter-ledger.mjs';
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
  const { topic, format, demand, prompt } = entry;
  const claim = newClaim({
    slug: topic.slug,
    title: topic.title,
    format,
    query: topic.query,
    demand: { ...demand },
    prompt: { ...prompt },
    runId,
    now,
  });
  return { claimPath: recordPath('claim', topic.slug, claim.claimedAt), claim };
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
  const ledger = newLedger({ slug: postSlug, runId, pullRequest: null });
  if (refusals.length > 0) ledger.refusals = refusals;
  const ledgerPath = recordPath('ledger', postSlug, claims[0].claim.claimedAt);
  const entries = decision.entries.map(({ row, table, choice }, at) => ({ ...claims[at], row, table, choice }));
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
