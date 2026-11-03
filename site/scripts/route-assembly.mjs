import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { restatedReason } from './disposition-restate.mjs';
import { renderEntry } from './entry-files.mjs';
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
    passage: { promptNumber: claim.prompt.number, passage: draft.passage, route: entry.route },
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
    core: plans.reduce((text, { passage }) => insertPassage(text, passage), read(SEMANTIC_CORE)),
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

export async function assembleRoute({ repoRoot, entries, runDate, run }) {
  const plan = planRoute({ repoRoot, entries, runDate });
  const transaction = fileTransaction(repoRoot);
  const { execute, succeed } = commandsIn({ run, cwd: join(repoRoot, SITE_DIRECTORY), plans: plan.plans });
  try {
    await requireGreenBaseline(execute);
    await writeSources({ plan, transaction, succeed });
    await succeed(BUILD);
    for (const command of REGENERATE) await succeed(command);
    const ledger = await regenerateRouteLedger({ repoRoot, transaction, succeed });
    for (const planned of plan.plans) await writeDisposition({ planned, runDate, transaction, succeed });
    const restated = await restateStale({
      repoRoot,
      transaction,
      succeed,
      reason: plan.reason,
      mayNotBeStale: plan.generated,
    });
    await formatDispositions(succeed, [...plan.generated, ...restated]);
    const blocking = await runBlockingChecks(succeed);
    const information = await runInformationGates(execute);
    const carried = ledger.changed ? [ledger.path] : [];
    return { files: filesOf(repoRoot, [...plan.paths, ...carried, ...restated]), gates: [...blocking, ...information] };
  } finally {
    transaction.restore();
  }
}
