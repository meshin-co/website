import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { repairedReason } from './disposition-restate.mjs';
import { renderEntry } from './entry-files.mjs';
import {
  BUILD,
  commandsIn,
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
import { fileTransaction, outputTail } from './route-transaction.mjs';
import { WriterError } from './writer-error.mjs';

const STATUS = ['status', '--porcelain', '-z', '--untracked-files=all'];
const MOVED = /[RC]/;

function refuse(message) {
  throw new WriterError('build', message);
}

function planRepair({ repoRoot, claim, draft, runDate, attempt }) {
  if (!claim || !draft) refuse('assembleRepair needs a claim and a draft');
  const entry = renderEntry({ claim, draft, runDate });
  if (!existsSync(join(repoRoot, entry.path)))
    refuse(`${entry.path} does not exist, and a repair never creates an entry`);
  return {
    entry,
    target: siteRelative(entry.path),
    reason: repairedReason({ route: entry.route, slug: claim.slug, attempt }),
  };
}

function changedPaths(stdout) {
  const fields = stdout.split('\0');
  const paths = [];
  for (let at = 0; at < fields.length; at += 1) {
    const field = fields[at];
    if (field === '') continue;
    const status = field.slice(0, 2);
    const path = field.slice(3);
    if (field[2] !== ' ' || path === '')
      refuse(`git ${STATUS.join(' ')} printed "${field.slice(0, 60)}", which is not a porcelain record`);
    if (status.includes('D')) refuse(`the repair deleted ${path}`);
    if (MOVED.test(status)) at += 1;
    paths.push(path);
  }
  return paths.sort();
}

async function changedFiles({ run, repoRoot }) {
  const result = await run('git', STATUS, { cwd: repoRoot });
  if (result.status !== 0) refuse(`git ${STATUS.join(' ')} ${outcomeOf(result)}:\n${outputTail(result)}`);
  return filesOf(repoRoot, changedPaths(result.stdout));
}

export async function assembleRepair({ repoRoot, claim, draft, runDate, run, attempt }) {
  const { entry, target, reason } = planRepair({ repoRoot, claim, draft, runDate, attempt });
  const transaction = fileTransaction(repoRoot);
  const { execute, succeed } = commandsIn({
    run,
    cwd: join(repoRoot, SITE_DIRECTORY),
    plans: [{ route: entry.route, target }],
  });
  try {
    transaction.track(SEMANTIC_CORE);
    transaction.write(entry.path, entry.text);
    await succeed(prettier(target));
    await succeed(BUILD);
    for (const command of REGENERATE) await succeed(command);
    const restated = await restateStale({ repoRoot, transaction, succeed, reason });
    if (restated.length > 0) await formatDispositions(succeed, restated);
    const blocking = await runBlockingChecks(succeed);
    const information = await runInformationGates(execute);
    return { files: await changedFiles({ run, repoRoot }), gates: [...blocking, ...information] };
  } finally {
    transaction.restore();
  }
}
