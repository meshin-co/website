import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ATTEMPT_CAP, ledgerWithAttempt, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { resolveClaimTable } from './claim-sources.mjs';
import { bandOf } from './generation-facts.mjs';
import { callTotals, recordAfterRepair, validateRecord } from './generation-record.mjs';
import { recordPath } from './record-layout.mjs';
import { attemptFailure } from './repair-findings.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { scopeProblems } from './repair-scope.mjs';
import { spendReportFile } from './spend-report.mjs';
import { WriterError } from './writer-error.mjs';
import { assertNoSecrets } from './writer-redact.mjs';

const LISTED_FAILURES = 8;
const textOf = (value) => JSON.stringify(value, null, 2) + '\n';
const firstLine = (text) => text.split('\n')[0];

async function assembled({ assemble, input, calls }) {
  try {
    return await assemble(input);
  } catch (error) {
    if (error instanceof WriterError && error.kind === 'build')
      throw new RepairStop('unrepairable', 'the rewrite broke the build: ' + firstLine(error.message), { calls });
    throw error;
  }
}

function refuseInvalid(slug, problems) {
  if (problems.length > 0)
    throw new WriterError(
      'output',
      'the repair of ' + slug + ' would be invalid: ' + problems.map(describeProblem).join('; ')
    );
}

function messageOf({ slug, number, failures, gates, generationPath }) {
  const listed = failures.slice(0, LISTED_FAILURES).map(({ rule, path }) => '- ' + rule + ' on ' + path);
  const more = failures.length > LISTED_FAILURES ? ['- and ' + (failures.length - LISTED_FAILURES) + ' more'] : [];
  return [
    'fix(autowriter): repair ' + slug + ', attempt ' + number + ' of ' + ATTEMPT_CAP,
    ['Answers:', ...listed, ...more].join('\n'),
    'Provenance: ' + generationPath,
    'Gates: ' + gates.map(({ name, exit }) => name + ' ' + exit).join(', '),
  ].join('\n\n');
}

function ledgerAfterAttempt({ situation, failures, calls, now }) {
  const { tokens, costUsd } = callTotals(calls);
  return ledgerWithAttempt(situation.ledger, {
    judgedCommit: situation.head,
    recordedAt: now.toISOString(),
    ...attemptFailure(failures),
    tokens,
    costUsd,
  });
}

function reportFiles({ repoRoot, written, situation, now }) {
  const report = spendReportFile({ repoRoot, written, revision: situation.head, at: now.toISOString() });
  const target = join(repoRoot, report.path);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  return current === report.text ? [] : [{ path: report.path, text: report.text }];
}

function spendMessageOf({ slug, outcome, calls, generationPath }) {
  return [
    'fix(autowriter): record the spend of a repair of ' + slug + ' that ended as ' + outcome,
    'The repair made ' +
      calls.length +
      ' model call' +
      (calls.length === 1 ? '' : 's') +
      ' and ended without a repaired entry, so the ledger gains an attempt that carries the spend and nothing else changes.',
    'Provenance: ' + generationPath,
  ].join('\n\n');
}

export async function recordFailedSpend({ repoRoot, situation, calls, failures, outcome, now, run, commit, secrets }) {
  const { claim, slug } = situation;
  const nextLedger = ledgerAfterAttempt({ situation, failures, calls, now });
  refuseInvalid(slug, validateLedger(nextLedger));
  const written = [{ path: recordPath('ledger', slug, claim.claimedAt), text: textOf(nextLedger) }];
  const files = [...written, ...reportFiles({ repoRoot, written, situation, now })];
  const message = spendMessageOf({
    slug,
    outcome,
    calls,
    generationPath: recordPath('generation', slug, claim.claimedAt),
  });
  assertNoSecrets({ files, message }, secrets, 'the record of the spend');
  const { commit: sha } = await commit({ repoRoot, files, message, run });
  return sha;
}

export async function finishRepair({
  repoRoot,
  situation,
  draft,
  calls,
  modelCheck,
  failures,
  now,
  run,
  assemble,
  commit,
  secrets,
}) {
  const { claim, slug, record, ledger, runDate } = situation;
  const number = ledger.attempts.length + 1;
  const assembly = await assembled({
    assemble,
    input: { repoRoot, claim, draft, runDate, run, attempt: { number, of: ATTEMPT_CAP } },
    calls,
  });
  const band = bandOf({ repoRoot, claim, draft });
  const nextRecord = recordAfterRepair({
    record,
    calls,
    modelChecks: [modelCheck],
    claimTable: resolveClaimTable({ claims: draft.claims, sources: draft.sources }),
    measured: band.measured,
    measuredOn: band.measuredOn,
    gates: assembly.gates,
  });
  const nextLedger = ledgerAfterAttempt({ situation, failures, calls, now });
  refuseInvalid(slug, [...validateRecord(nextRecord), ...validateLedger(nextLedger)]);
  const generationPath = recordPath('generation', slug, claim.claimedAt);
  const ledgerPath = recordPath('ledger', slug, claim.claimedAt);
  const own = [generationPath, ledgerPath];
  const written = [
    { path: generationPath, text: textOf(nextRecord) },
    { path: ledgerPath, text: textOf(nextLedger) },
  ];
  const files = [
    ...assembly.files.filter(({ path }) => !own.includes(path)),
    ...written,
    ...reportFiles({ repoRoot, written, situation, now }),
  ];
  const outside = scopeProblems({
    slug,
    format: claim.format,
    claimedAt: claim.claimedAt,
    paths: files.map(({ path }) => path),
  });
  if (outside.length > 0)
    throw new RepairStop(
      'unrepairable',
      'the repair would touch files it may not: ' + outside.map(({ path, problem }) => path + ' ' + problem).join('; '),
      { calls }
    );
  const message = messageOf({ slug, number, failures, gates: assembly.gates, generationPath });
  assertNoSecrets({ files, message }, secrets, 'the repair output');
  const { commit: sha } = await commit({ repoRoot, files, message, run });
  return { commit: sha, attempt: number, gates: assembly.gates };
}
