import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { applyDispositions, digestFor } from './dispositions.mjs';
import { buildReport } from './editorial-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { recordDirectory, recordFiles } from './record-layout.mjs';

const USAGE = 'usage: node scripts/stale-dispositions.mjs <site directory> <dist directory>';

function entriesIn(repoRoot) {
  const directory = recordDirectory('disposition');
  return recordFiles(repoRoot, 'disposition').flatMap((path) =>
    JSON.parse(readFileSync(join(repoRoot, path), 'utf8')).map((entry, index) => ({
      ...entry,
      file: path.slice(directory.length + 1),
      index,
    }))
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
  const { stale } = applyDispositions(rows, entriesIn(resolve(siteDirectory, '..')));
  const changed = stale.flatMap(({ file, index, target, digest }) => {
    const current = digestFor(rows, target);
    return digest === current ? [] : [{ file, index, target, digest: current }];
  });
  console.log(JSON.stringify(changed));
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main();
