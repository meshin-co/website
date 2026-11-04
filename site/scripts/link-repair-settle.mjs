import { join } from 'node:path';

import { linkRepairedReason } from './disposition-restate.mjs';
import { recordFiles } from './record-layout.mjs';
import { BUILD, SITE_DIRECTORY, commandsIn, formatDispositions as formatFiles, restateStale } from './route-steps.mjs';
import { fileTransaction } from './route-transaction.mjs';
import { runProcess } from './writer-cli.mjs';

export async function settleRepair({ repoRoot, result, run = runProcess }) {
  if (result.entries.length === 0 || recordFiles(repoRoot, 'disposition').length === 0) return [];
  const { succeed } = commandsIn({ run, cwd: join(repoRoot, SITE_DIRECTORY), plans: [] });
  await formatFiles(succeed, result.entries);
  await succeed(BUILD);
  const restated = await restateStale({
    repoRoot,
    transaction: fileTransaction(repoRoot),
    succeed,
    reason: linkRepairedReason({ entries: result.entries }),
  });
  if (restated.length > 0) await formatFiles(succeed, restated);
  return restated;
}
