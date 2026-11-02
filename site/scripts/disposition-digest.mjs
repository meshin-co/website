import { resolve } from 'node:path';

import { digestFor } from './dispositions.mjs';
import { buildReport } from './editorial-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const USAGE = 'usage: node scripts/disposition-digest.mjs <site directory> <dist directory> <target>';

const argumentsInEditorialGateOrder = ([, , siteDirectory, distDirectory, target]) => ({
  siteDirectory,
  distDirectory,
  target,
});

const digestOfNoRows = (target) => digestFor([], target);

function main() {
  const { siteDirectory, distDirectory, target } = argumentsInEditorialGateOrder(process.argv);
  if (!siteDirectory || !distDirectory || !target) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  const { rows } = buildReport(resolve(siteDirectory, distDirectory)).built;
  const digest = digestFor(rows, target);
  if (digest === digestOfNoRows(target)) {
    console.error(`no editorial row names ${target}`);
    process.exitCode = 1;
    return;
  }
  console.log(digest);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main();
