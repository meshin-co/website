import { join } from 'node:path';

import { claimFile, validateClaim } from './autowriter-claims.mjs';
import { validateLedger, writeLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { resolveClaimTable } from './claim-sources.mjs';
import { commitRoute } from './entry-commit.mjs';
import { entryPath, entryRoute } from './entry-files.mjs';
import { bandOf, verifiedModel } from './generation-facts.mjs';
import {
  buildRecord,
  callTotals,
  entryCost,
  generationFile,
  ledgerWithGeneration,
  validateRecord,
} from './generation-record.mjs';
import { headFingerprint } from './lh-evidence.mjs';
import { BRANCH_PREFIX } from './pr-classify.mjs';
import { assembleRoute } from './route-assembly.mjs';
import { spendReportFile } from './spend-report.mjs';
import { REPORT_PATH } from './spend-report-text.mjs';
import { CORRECTION_ROUNDS, draftEntry } from './write-draft.mjs';
import { openRun } from './write-open.mjs';
import { createAdapter } from './writer-adapter.mjs';
import { WriterError } from './writer-error.mjs';
import { OUTPUT_SCHEMA_NAME, outputSchema, parseOutput } from './writer-output.mjs';
import { claimProblems, correctionMessage, loadPreflightContext, preflight } from './writer-preflight.mjs';
import { buildPrompt } from './writer-prompt.mjs';
import { assertNoSecrets, secretsOf } from './writer-redact.mjs';

const SKIPPABLE_KINDS = ['claim', 'output', 'vendor'];
const REASON_LIMIT = 300;

const textOf = (value) => `${JSON.stringify(value, null, 2)}\n`;
const firstLine = (text) => text.split('\n')[0];
const rulesOf = (problems) => [...new Set(problems.map(({ rule }) => rule))].join(', ');
const allCalls = (states) => states.flatMap(({ calls }) => calls);

async function treeOfHead({ repoRoot, run }) {
  const head = await run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
  return { parent: head.stdout.trim(), fingerprint: await headFingerprint(repoRoot) };
}

function requireWritable({ claim, context }) {
  const problems = claimProblems({ claim, context });
  if (problems.length > 0)
    throw new WriterError(
      'claim',
      `claim ${claim.slug} cannot be written: ${problems.map(({ detail }) => detail).join('; ')}`
    );
}

async function draftOne({ state, stage }) {
  const { claim, row } = state;
  const { repoRoot, context, adapter, runDate } = stage;
  requireWritable({ claim, context });
  const prompt = buildPrompt({ repoRoot, claim, demandRow: row, runDate });
  const request = {
    system: prompt.system,
    user: prompt.user,
    schema: outputSchema(claim.format),
    schemaName: OUTPUT_SCHEMA_NAME,
    maxOutputTokens: prompt.maxOutputTokens,
  };
  const check = (json) => {
    const draft = parseOutput(json, { format: claim.format });
    return { draft, problems: preflight({ draft, claim, context, runDate }) };
  };
  const outcome = await draftEntry({ adapter, request, check, correct: correctionMessage, calls: state.calls });
  if (outcome.draft === null)
    throw new WriterError(
      'output',
      `no draft of ${claim.slug} passed the writer's own checks after ${CORRECTION_ROUNDS} correction: ${rulesOf(outcome.problems)}`
    );
  Object.assign(state, { prompt, draft: outcome.draft, finalCall: outcome.finalCall });
}

async function attempt(state, work) {
  try {
    await work();
  } catch (error) {
    const skippable = error instanceof WriterError && SKIPPABLE_KINDS.includes(error.kind);
    if (state.anchor || !skippable) throw error;
    state.skipped = firstLine(error.message);
  }
}

const assemblyInput = ({ stage, states }) => ({
  repoRoot: stage.repoRoot,
  entries: states.map(({ claim, draft }) => ({ claim, draft })),
  runDate: stage.runDate,
  run: stage.run,
});

async function assemble({ stage, states }) {
  const shipped = states.filter(({ skipped }) => !skipped);
  try {
    return { assembly: await stage.assemble(assemblyInput({ stage, states: shipped })), shipped };
  } catch (error) {
    const companions = shipped.filter(({ anchor }) => !anchor);
    if (!(error instanceof WriterError) || error.kind !== 'build' || companions.length === 0) throw error;
    for (const state of companions)
      state.skipped = `the assembly failed while it was included: ${firstLine(error.message)}`;
    const alone = shipped.filter(({ anchor }) => anchor);
    return { assembly: await stage.assemble(assemblyInput({ stage, states: alone })), shipped: alone };
  }
}

function recordFor({ state, stage, opened, files, assembly, tree }) {
  const { claim, draft } = state;
  const { format, slug } = claim;
  const record = buildRecord({
    claim,
    decision: { row: state.row, report: { ...stage.decision.report, table: state.table } },
    format,
    route: entryRoute({ format, slug }),
    entryPath: entryPath({ format, slug }),
    ledger: opened.ledgerPath,
    generatedAt: stage.now().toISOString(),
    calls: state.calls,
    published: { callIndex: state.calls.indexOf(state.finalCall) },
    modelChecks: [stage.modelCheck],
    prompt: { digest: state.prompt.digest, schemaDigest: state.prompt.schemaDigest, files: state.prompt.files },
    tree,
    claimTable: resolveClaimTable({ claims: draft.claims, sources: draft.sources }),
    band: bandOf({ repoRoot: stage.repoRoot, claim, draft }),
    files,
    gates: assembly.gates,
  });
  const problems = validateRecord(record);
  if (problems.length > 0)
    throw new WriterError(
      'output',
      `the generation record of ${slug} is invalid: ${problems.map(describeProblem).join('; ')}`
    );
  return record;
}

function writtenClaim(claim) {
  const written = { ...claim, status: 'written' };
  const problems = validateClaim(written);
  if (problems.length > 0)
    throw new WriterError(
      'claim',
      `the written claim ${claim.slug} is invalid: ${problems.map(describeProblem).join('; ')}`
    );
  return written;
}

function ledgerFor({ ledger, calls }) {
  const next = ledgerWithGeneration(ledger, callTotals(calls));
  const problems = validateLedger(next);
  if (problems.length > 0)
    throw new WriterError('output', `the run ledger would be invalid: ${problems.map(describeProblem).join('; ')}`);
  return next;
}

function commitMessage({ shipped, assembly }) {
  const [first] = shipped;
  const more = shipped.length > 1 ? ` and ${shipped.length - 1} more` : '';
  const sections = shipped.map(({ claim, choice }) =>
    [
      `${claim.format} ${claim.slug}: ${claim.title}`,
      choice,
      `Serves buyer prompt ${claim.prompt.number}: ${claim.prompt.text}`,
      `Provenance: ${generationFile(claim.slug)}`,
    ]
      .filter(Boolean)
      .join('\n')
  );
  const gates = assembly.gates.map(({ name, exit }) => `${name} ${exit}`).join(', ');
  return [`feat(autowriter): write ${first.claim.slug}${more}`, ...sections, `Gates: ${gates}`].join('\n\n');
}

function keepSpend({ opened, states, error, stage }) {
  const calls = allCalls(states);
  if (calls.length === 0) return;
  const reason = `generation failed (${error.kind ?? 'unexpected'}): ${firstLine(error.message)}`.slice(
    0,
    REASON_LIMIT
  );
  const stopped = { state: 'stopped', reason, decidedAt: stage.now().toISOString() };
  writeLedger(join(stage.repoRoot, opened.ledgerPath), {
    ...ledgerWithGeneration(opened.ledger, callTotals(calls)),
    verdict: stopped,
  });
}

async function execute({ opened, states, stage }) {
  stage.modelCheck = await verifiedModel(stage.adapter);
  for (const state of states) await attempt(state, () => draftOne({ state, stage }));
  const { assembly, shipped } = await assemble({ stage, states });
  const calls = allCalls(states);
  const ownFiles = [
    ...shipped.flatMap(({ claim }) => [generationFile(claim.slug), claimFile(claim.slug)]),
    opened.ledgerPath,
    REPORT_PATH,
  ];
  const files = [...assembly.files.map(({ path }) => path), ...ownFiles];
  const tree = await stage.treeOf({ repoRoot: stage.repoRoot, run: stage.run });
  const records = shipped.map((state) => recordFor({ state, stage, opened, files, assembly, tree }));
  const written = [
    ...shipped.map(({ claim }, at) => ({ path: generationFile(claim.slug), text: textOf(records[at]) })),
    ...shipped.map(({ claim }) => ({ path: claimFile(claim.slug), text: textOf(writtenClaim(claim)) })),
    { path: opened.ledgerPath, text: textOf(ledgerFor({ ledger: opened.ledger, calls })) },
  ];
  const report = spendReportFile({ repoRoot: stage.repoRoot, written, revision: tree.parent });
  const committed = [...assembly.files, ...written, { path: report.path, text: report.text }];
  const message = commitMessage({ shipped, assembly });
  assertNoSecrets({ files: committed, message }, secretsOf([stage.vendor]), 'the run output');
  const anchor = shipped.find((state) => state.anchor);
  const branch = `${BRANCH_PREFIX}${anchor.claim.slug}`;
  const { commit } = await stage.commit({
    repoRoot: stage.repoRoot,
    branch,
    files: committed,
    message,
    run: stage.run,
  });
  return { shipped, records, assembly, branch, commit, anchor };
}

function summaryOf({ outcome, states, stage }) {
  const { shipped, records, assembly, branch, commit, anchor } = outcome;
  return {
    ok: true,
    slug: anchor.claim.slug,
    route: entryRoute(anchor.claim),
    branch,
    commit,
    entries: shipped.map(({ claim }, at) => ({
      slug: claim.slug,
      format: claim.format,
      route: entryRoute(claim),
      path: entryPath(claim),
      provider: records[at].provider,
      model: records[at].model,
      calls: records[at].calls.length,
      spend: entryCost(records[at]),
    })),
    skipped: states
      .filter(({ skipped }) => skipped)
      .map(({ claim, calls, skipped }) => ({
        slug: claim.slug,
        format: claim.format,
        reason: skipped,
        spend: callTotals(calls),
      })),
    spend: callTotals(allCalls(states)),
    notes: [stage.modelCheck.note].filter(Boolean),
    gates: assembly.gates,
  };
}

export async function generateRun({
  repoRoot,
  decision,
  config,
  now,
  fetch,
  run,
  makeAdapter = createAdapter,
  assemble: assembleEntries = assembleRoute,
  commit = commitRoute,
  treeOf = treeOfHead,
}) {
  const opened = openRun({ repoRoot, decision });
  const states = opened.entries.map((entry) => ({ ...entry, calls: [], skipped: null }));
  const stage = {
    repoRoot,
    decision,
    now,
    run,
    vendor: config.vendor,
    adapter: makeAdapter({ vendor: config.vendor, fetch }),
    context: loadPreflightContext(repoRoot),
    runDate: now().toISOString().slice(0, 10),
    assemble: assembleEntries,
    commit,
    treeOf,
  };
  try {
    return summaryOf({ outcome: await execute({ opened, states, stage }), states, stage });
  } catch (error) {
    keepSpend({ opened, states, error, stage });
    error.spend = callTotals(allCalls(states));
    throw error;
  }
}
