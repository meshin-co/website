import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { restatedReason } from './disposition-restate.mjs';
import { entryPath, entryRoute, renderEntry } from './entry-files.mjs';
import { recordPath } from './record-layout.mjs';
import { regenerateRouteLedger } from './route-ledger.mjs';
import { addTargetQuery, dispositionFor, insertPassage, targetQueryFor } from './route-derive.mjs';
import {
  BUILD,
  commandsIn,
  digestOf,
  EDITORIAL,
  filesOf,
  formatDispositions,
  outcomeOf,
  prettier,
  REGENERATE,
  restateStale,
  runBlockingChecks,
  runInformationGates,
  SEMANTIC_CORE,
  SITE_DIRECTORY,
  siteRelative,
} from './route-steps.mjs';
import { fileTransaction, outputHead, outputTail } from './route-transaction.mjs';
import { WriterError } from './writer-error.mjs';

const CONTENT_FACTS = `${SITE_DIRECTORY}/content-facts.json`;

function planEntry({ claim, draft, runDate }) {
  const entry = renderEntry({ claim, draft, runDate });
  return {
    claim,
    entry,
    route: entry.route,
    disposition: recordPath('disposition', claim.slug, claim.claimedAt),
    target: siteRelative(entry.path),
    query: targetQueryFor({ claim }),
    passage: claim.prompt ? { promptNumber: claim.prompt.number, passage: draft.passage, route: entry.route } : null,
  };
}

function refuseUnwritable(repoRoot, plans) {
  const seen = new Set();
  for (const { entry, disposition } of plans)
    for (const path of [entry.path, disposition]) {
      if (seen.has(path)) throw new WriterError('build', `${path} is written by two entries of this run`);
      if (existsSync(join(repoRoot, path)))
        throw new WriterError('build', `${path} already exists and is never overwritten`);
      seen.add(path);
    }
}

function planRoute({ repoRoot, entries, runDate }) {
  if (!Array.isArray(entries) || entries.length === 0 || !entries.every((item) => item?.claim && item?.draft))
    throw new WriterError('build', 'assembleRoute needs entries: a non-empty list of { claim, draft }');
  const plans = entries.map(({ claim, draft }) => planEntry({ claim, draft, runDate }));
  refuseUnwritable(repoRoot, plans);

  const read = (path) => readFileSync(join(repoRoot, path), 'utf8');
  const generated = plans.map(({ disposition }) => disposition);
  return {
    plans,
    generated,
    reason: restatedReason({
      routes: plans.map(({ route }) => route),
      generationPaths: plans.map(({ claim }) => recordPath('generation', claim.slug, claim.claimedAt)),
    }),
    paths: [...plans.map(({ entry }) => entry.path), CONTENT_FACTS, SEMANTIC_CORE, ...generated],
    facts: plans.reduce((text, { route, query }) => addTargetQuery(text, route, query), read(CONTENT_FACTS)),
    core: plans.reduce(
      (text, { passage }) => (passage === null ? text : insertPassage(text, passage)),
      read(SEMANTIC_CORE)
    ),
  };
}

async function writeSources({ plan, transaction, succeed }) {
  for (const { entry, target } of plan.plans) {
    transaction.write(entry.path, entry.text);
    await succeed(prettier(target));
  }
  transaction.write(CONTENT_FACTS, plan.facts);
  await succeed(prettier(siteRelative(CONTENT_FACTS)));
  transaction.write(SEMANTIC_CORE, plan.core);
}

async function writeDisposition({ planned, runDate, transaction, succeed }) {
  const { claim } = planned;
  const claimPath = recordPath('claim', claim.slug, claim.claimedAt);
  const generationPath = recordPath('generation', claim.slug, claim.claimedAt);
  const rows = [];
  for (const target of [planned.target, planned.route])
    rows.push(dispositionFor({ claimPath, generationPath, target, digest: await digestOf(succeed, target), runDate }));
  transaction.write(planned.disposition, `${JSON.stringify(rows, null, 2)}\n`);
}

function baselineFailure({ name, command, result, excerpt }) {
  const verdict = `the baseline already fails ${name} (${command.join(' ')} ${outcomeOf(result)})`;
  return new WriterError('build', `${verdict}; the writer will not write on a red baseline:\n${excerpt(result)}`);
}

async function requireGreenBaseline(execute) {
  const build = await execute(BUILD);
  if (build.status !== 0)
    throw baselineFailure({ name: 'the build', command: BUILD, result: build, excerpt: outputTail });
  const { name, command } = EDITORIAL;
  const gate = await execute(command);
  if (gate.status !== 0) throw baselineFailure({ name, command, result: gate, excerpt: outputHead });
}

async function regenerate({ repoRoot, transaction, execute, succeed, reason, generated, settle }) {
  await succeed(BUILD);
  for (const command of REGENERATE) await succeed(command);
  const ledger = await regenerateRouteLedger({ repoRoot, transaction, succeed });
  await settle();
  const restated = await restateStale({ repoRoot, transaction, succeed, reason, mayNotBeStale: generated });
  await formatDispositions(succeed, [...generated, ...restated]);
  const blocking = await runBlockingChecks(succeed);
  const information = await runInformationGates(execute);
  return { ledger, restated, gates: [...blocking, ...information] };
}

export async function assembleRoute({ repoRoot, entries, runDate, run }) {
  const plan = planRoute({ repoRoot, entries, runDate });
  const transaction = fileTransaction(repoRoot);
  const { execute, succeed } = commandsIn({ run, cwd: join(repoRoot, SITE_DIRECTORY), plans: plan.plans });
  try {
    await requireGreenBaseline(execute);
    await writeSources({ plan, transaction, succeed });
    const settle = async () => {
      for (const planned of plan.plans) await writeDisposition({ planned, runDate, transaction, succeed });
    };
    const { ledger, restated, gates } = await regenerate({
      repoRoot,
      transaction,
      execute,
      succeed,
      reason: plan.reason,
      generated: plan.generated,
      settle,
    });
    const carried = ledger.changed ? [ledger.path] : [];
    return { files: filesOf(repoRoot, [...plan.paths, ...carried, ...restated]), gates };
  } finally {
    transaction.restore();
  }
}

function healedPlan({ claim, passage }) {
  const route = entryRoute(claim);
  return {
    claim,
    route,
    disposition: recordPath('disposition', claim.slug, claim.claimedAt),
    target: siteRelative(entryPath(claim)),
    query: targetQueryFor({ claim }),
    passage: passage === null ? null : { promptNumber: claim.prompt.number, passage, route },
  };
}

const withQuery = (text, { route, query }) =>
  JSON.parse(text).targetQuery?.[route] === query ? text : addTargetQuery(text, route, query);

async function redigest({ planned, repoRoot, transaction, succeed }) {
  const rows = JSON.parse(readFileSync(join(repoRoot, planned.disposition), 'utf8'));
  const fresh = [];
  for (const row of rows) fresh.push({ ...row, digest: await digestOf(succeed, row.target) });
  transaction.write(planned.disposition, `${JSON.stringify(fresh, null, 2)}\n`);
}

export async function healRoute({ repoRoot, entries, run }) {
  const plans = entries.map(healedPlan);
  const generated = plans.map(({ disposition }) => disposition);
  const transaction = fileTransaction(repoRoot);
  const { execute, succeed } = commandsIn({ run, cwd: join(repoRoot, SITE_DIRECTORY), plans });
  const read = (path) => readFileSync(join(repoRoot, path), 'utf8');
  try {
    transaction.write(CONTENT_FACTS, plans.reduce(withQuery, read(CONTENT_FACTS)));
    await succeed(prettier(siteRelative(CONTENT_FACTS)));
    const withPassage = (text, { passage }) => (passage === null ? text : insertPassage(text, passage));
    transaction.write(SEMANTIC_CORE, plans.reduce(withPassage, read(SEMANTIC_CORE)));
    const settle = async () => {
      for (const planned of plans) await redigest({ planned, repoRoot, transaction, succeed });
    };
    const { ledger, restated, gates } = await regenerate({
      repoRoot,
      transaction,
      execute,
      succeed,
      reason: restatedReason({
        routes: plans.map(({ route }) => route),
        generationPaths: plans.map(({ claim }) => recordPath('generation', claim.slug, claim.claimedAt)),
      }),
      generated,
      settle,
    });
    return { files: filesOf(repoRoot, [CONTENT_FACTS, SEMANTIC_CORE, ledger.path, ...generated, ...restated]), gates };
  } finally {
    transaction.restore();
  }
}
