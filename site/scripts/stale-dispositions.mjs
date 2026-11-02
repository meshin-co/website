import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { applyDispositions, digestFor } from './dispositions.mjs';
import { buildReport } from './editorial-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const USAGE = 'usage: node scripts/stale-dispositions.mjs <site directory> <dist directory>';
const DISPOSITIONS = '../audits/phase-4.7/dispositions';

function entriesIn(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((file) =>
      JSON.parse(readFileSync(join(directory, file), 'utf8')).map((entry, index) => ({ ...entry, file, index }))
    );
}

function main() {
  const [, , siteDirectory, distDirectory] = process.argv;
  if (!siteDirectory || !distDirectory) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  const { rows } = buildReport(resolve(siteDirectory, distDirectory)).built;
  const { stale } = applyDispositions(rows, entriesIn(resolve(siteDirectory, DISPOSITIONS)));
  const changed = stale.flatMap(({ file, index, target, digest }) => {
    const current = digestFor(rows, target);
    return digest === current ? [] : [{ file, index, target, digest: current }];
  });
  console.log(JSON.stringify(changed));
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main();
