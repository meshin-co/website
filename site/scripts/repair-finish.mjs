import { ATTEMPT_CAP, ledgerFile, ledgerWithAttempt, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { resolveClaimTable } from './claim-sources.mjs';
import { bandOf } from './generation-facts.mjs';
import { callTotals, generationFile, recordAfterRepair, validateRecord } from './generation-record.mjs';
import { attemptFailure } from './repair-findings.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { scopeProblems } from './repair-scope.mjs';
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

function messageOf({ slug, number, failures, gates }) {
  const listed = failures.slice(0, LISTED_FAILURES).map(({ rule, path }) => '- ' + rule + ' on ' + path);
  const more = failures.length > LISTED_FAILURES ? ['- and ' + (failures.length - LISTED_FAILURES) + ' more'] : [];
  return [
    'fix(autowriter): repair ' + slug + ', attempt ' + number + ' of ' + ATTEMPT_CAP,
    ['Answers:', ...listed, ...more].join('\n'),
    'Provenance: ' + generationFile(slug),
    'Gates: ' + gates.map(({ name, exit }) => name + ' ' + exit).join(', '),
  ].join('\n\n');
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
  const { claim, slug, record, ledger, runDate, head } = situation;
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
  const { tokens, costUsd } = callTotals(calls);
  const nextLedger = ledgerWithAttempt(ledger, {
    judgedCommit: head,
    recordedAt: now.toISOString(),
    ...attemptFailure(failures),
    tokens,
    costUsd,
  });
  refuseInvalid(slug, [...validateRecord(nextRecord), ...validateLedger(nextLedger)]);
  const own = [generationFile(slug), ledgerFile(slug)];
  const files = [
    ...assembly.files.filter(({ path }) => !own.includes(path)),
    { path: generationFile(slug), text: textOf(nextRecord) },
    { path: ledgerFile(slug), text: textOf(nextLedger) },
  ];
  const outside = scopeProblems({ slug, format: claim.format, paths: files.map(({ path }) => path) });
  if (outside.length > 0)
    throw new RepairStop(
      'unrepairable',
      'the repair would touch files it may not: ' + outside.map(({ path, problem }) => path + ' ' + problem).join('; '),
      { calls }
    );
  const message = messageOf({ slug, number, failures, gates: assembly.gates });
  assertNoSecrets({ files, message }, secrets, 'the repair output');
  const { commit: sha } = await commit({ repoRoot, files, message, run });
  return { commit: sha, attempt: number, gates: assembly.gates };
}
