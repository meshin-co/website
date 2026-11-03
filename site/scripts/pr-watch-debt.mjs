import { LedgerError, newLedger, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { variable } from './escalate-channels.mjs';
import { debtFinding, ledgerWithDebt, treeFingerprint } from './measurement-debt.mjs';
import { BOT_IDENTITY, slugOfBranch } from './pr-classify.mjs';
import { recordPath } from './record-layout.mjs';

async function commitDebt(step, { mergedCommit, fingerprint }) {
  const { io, reader, writer, env, number, snapshot, now } = step;
  const slug = slugOfBranch(snapshot.pullRequest.head.ref);
  const stored = await io.readLedgerAt(reader, { slug, ref: mergedCommit });
  const path = stored?.path ?? recordPath('ledger', slug, now());
  const runId = variable(env, 'GITHUB_RUN_ID') || 'local';
  const started = stored?.value ?? newLedger({ slug, runId, pullRequest: number });
  const ledger = ledgerWithDebt(started, { mergedCommit, fingerprint, now: now() });
  const problems = validateLedger(ledger);
  if (problems.length > 0) throw new LedgerError(path, problems.map(describeProblem));
  await io.putLedger(writer, {
    path,
    text: `${JSON.stringify(ledger, null, 2)}\n`,
    blobSha: stored?.blobSha ?? null,
    branch: snapshot.pullRequest.base.ref,
    message: `chore(autowriter): record the measurement debt of ${slug}`,
    identity: BOT_IDENTITY,
  });
}

export async function recordDebt(step, mergedCommit, stop) {
  let fingerprint = null;
  try {
    fingerprint = treeFingerprint(await step.io.readTree(step.reader, mergedCommit));
    await commitDebt(step, { mergedCommit, fingerprint });
  } catch (error) {
    const finding = debtFinding({ number: step.number, mergedCommit, fingerprint, error });
    const undelivered = await stop(finding).then(
      () => null,
      (failure) => failure
    );
    if (undelivered === null) throw error;
    throw new Error(`${finding.detail}\n${undelivered.message}`, { cause: error });
  }
}
