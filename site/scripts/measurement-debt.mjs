import { fingerprint as fingerprintOfFiles } from './lh-evidence.mjs';

export const CLEAR_COMMAND = 'cd site && GATE_PHASE=<bucket> npm run gate:lh && GATE_PHASE=<bucket> npm run lh:record';

export const treeFingerprint = (treeEntries) =>
  fingerprintOfFiles(treeEntries.filter(({ type }) => type !== 'tree').map(({ path, sha }) => [path, sha]));

export function ledgerWithDebt(ledger, { mergedCommit, fingerprint, now }) {
  const recordedAt = now.toISOString();
  return {
    ...ledger,
    verdict: { state: 'merged', reason: null, decidedAt: recordedAt },
    measurementDebt: { mergedCommit, fingerprint, recordedAt, clear: CLEAR_COMMAND },
  };
}

export function debtFinding({ number, mergedCommit, fingerprint, error }) {
  const tree =
    fingerprint === null
      ? 'The fingerprint of the merged tree was not computed.'
      : `Fingerprint of the merged tree: ${fingerprint}`;
  return {
    kind: 'hard-stop',
    title: `Autowriter pull request #${number} was merged, but its measurement debt was not recorded`,
    detail: [
      `Pull request #${number} was merged as ${mergedCommit}, and no Lighthouse run has measured that tree.`,
      `Recording the debt in the ledger on the base branch failed: ${error.message}`,
      tree,
      `The owner clears it on a quiet machine: ${CLEAR_COMMAND}`,
    ].join('\n'),
  };
}
