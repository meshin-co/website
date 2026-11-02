import { ATTEMPT_CAP } from './autowriter-ledger.mjs';
import { verifiedModel } from './generation-facts.mjs';
import { callTotals } from './generation-record.mjs';
import { finishRepair } from './repair-finish.mjs';
import { earlierAttemptWithSameFailure, failuresOf, readFindings } from './repair-findings.mjs';
import { openRepair } from './repair-open.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { rewriteEntry } from './repair-rewrite.mjs';
import { ownPaths } from './repair-scope.mjs';

const describeRefusals = (refused) =>
  refused.map(({ gate, rule, reason }) => gate + ' ' + rule + ' (' + reason + ')').join('; ');

function refuseWhatCannotStart({ situation, documents, failures, kinds }) {
  const { slug, claim, ledger, route } = situation;
  const earlier = earlierAttemptWithSameFailure({ attempts: ledger.attempts, failures });
  if (earlier !== null)
    throw new RepairStop('no-convergence', 'the same rule failed on the same path after attempt ' + earlier.number);
  if (ledger.attempts.length >= ATTEMPT_CAP)
    throw new RepairStop('no-convergence', slug + ' has used its ' + ATTEMPT_CAP + ' attempts');
  const verdict = kinds.judgeFindings({
    documents,
    entry: { slug, format: claim.format, route, paths: ownPaths({ slug, format: claim.format }) },
  });
  if (verdict.refused.length > 0)
    throw new RepairStop('unrepairable', 'a rewrite cannot answer ' + describeRefusals(verdict.refused));
  if (verdict.rewrite.length === 0) throw new RepairStop('unrepairable', 'no finding asks for a rewrite');
  return verdict.rewrite;
}

function refuseWhenCeilingReached({ ceiling, repoRoot, now }) {
  const status = ceiling({ repoRoot, now });
  if (status.reached)
    throw new RepairStop(
      'spend-ceiling',
      'the spend of ' + status.spentUsd + ' USD has reached the ceiling of ' + status.ceilingUsd + ' USD this month'
    );
}

export async function repairRun(io) {
  const { repoRoot, now, run, api, adapter, kinds, secrets = [] } = io;
  const situation = await io.open();
  const documents = await io.findingsOf({ api, run: situation.run });
  const failures = failuresOf(documents);
  const rewrite = refuseWhatCannotStart({ situation, documents, failures, kinds });
  refuseWhenCeilingReached({ ceiling: io.ceiling, repoRoot, now });
  const modelCheck = await verifiedModel(adapter);
  const calls = [];
  try {
    const { draft } = await rewriteEntry({
      repoRoot,
      adapter,
      claim: situation.claim,
      before: situation.before,
      runDate: situation.runDate,
      findings: rewrite,
      allowances: kinds.allowancesOf({ rewrite }),
      attempt: { number: situation.ledger.attempts.length + 1, of: ATTEMPT_CAP },
      calls,
    });
    const done = await finishRepair({
      repoRoot,
      situation,
      draft,
      calls,
      modelCheck,
      failures,
      now,
      run,
      assemble: io.assemble,
      commit: io.commit,
      secrets,
    });
    return {
      outcome: 'repaired',
      commit: done.commit,
      slug: situation.slug,
      attempt: done.attempt,
      gates: done.gates,
      spend: callTotals(calls),
    };
  } catch (error) {
    if (calls.length > 0) {
      error.spend ??= callTotals(calls);
      if (error instanceof RepairStop) error.details = { ...error.details, calls };
    }
    throw error;
  }
}

export async function repairWithDefaults({ api, adapter, repoRoot, number, head, now, run, secrets }) {
  const [kinds, { assembleRepair }, { commitRepair }, { ceilingStatus }] = await Promise.all([
    import('./repair-kinds.mjs'),
    import('./repair-assembly.mjs'),
    import('./entry-commit.mjs'),
    import('./spend-ceiling.mjs'),
  ]);
  return repairRun({
    repoRoot,
    now,
    run,
    api,
    adapter,
    secrets,
    kinds,
    open: () => openRepair({ api, repoRoot, number, head, now, run }),
    findingsOf: readFindings,
    ceiling: (options) => ceilingStatus(options),
    assemble: assembleRepair,
    commit: commitRepair,
  });
}
