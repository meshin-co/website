import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { diffRoutes } from './routes-gate.mjs';
import { WriterError } from './writer-error.mjs';

export const ROUTE_LEDGER = 'audits/routes.json';
export const WRITE_ROUTE_LEDGER = ['npm', 'run', 'assets:routes'];
const EXPLANATIONS = 'audits/routes-removed.json';

function routesIn(text) {
  let routes;
  try {
    routes = JSON.parse(text);
  } catch (error) {
    throw new WriterError('build', `${ROUTE_LEDGER} is not JSON: ${error.message}`);
  }
  if (!Array.isArray(routes) || !routes.every((route) => typeof route === 'string'))
    throw new WriterError('build', `${ROUTE_LEDGER} is not a list of routes`);
  return routes;
}

function readLedger(repoRoot) {
  try {
    return readFileSync(join(repoRoot, ROUTE_LEDGER), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT')
      throw new WriterError('build', `${ROUTE_LEDGER} does not exist, so no route can be compared`);
    throw error;
  }
}

export async function regenerateRouteLedger({ repoRoot, transaction, succeed }) {
  const before = readLedger(repoRoot);
  const previous = routesIn(before);
  transaction.track(ROUTE_LEDGER);
  await succeed(WRITE_ROUTE_LEDGER);
  const after = readLedger(repoRoot);
  const { removed } = diffRoutes({ previous, current: routesIn(after), explained: [] });
  if (removed.length > 0)
    throw new WriterError(
      'build',
      `the build drops ${removed.join(', ')} from ${ROUTE_LEDGER}; the writer never explains a removal, so a person restores the page or lists the route in ${EXPLANATIONS}`
    );
  return { path: ROUTE_LEDGER, changed: after !== before };
}
