import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { EXPORT_MANIFEST, isSeed, seedTarget } from './engine-partition.mjs';
import { PartitionFactsError } from './engine-partition-facts.mjs';
import { partitionReport } from './engine-partition-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { readerOf, trackedFiles } from './run-partition-gate.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const USAGE = 'usage: node scripts/export-engine.mjs [--root <repository>] <empty directory>';
const BLOCKING_RULES = new Set(['unclassified', 'anchor-unserved']);
const DEFAULT_IO = { out: (line) => console.log(line), err: (line) => console.error(line) };

const refused = (refusals) => ({ refusals, written: [], manifest: null });

function targetRefusal(target) {
  if (!existsSync(target)) return null;
  if (!statSync(target).isDirectory()) return `${target} exists and is not a directory`;
  return readdirSync(target).length === 0 ? null : `${target} is not empty`;
}

function readReport(root, files) {
  try {
    return { report: partitionReport({ files, read: readerOf(root) }) };
  } catch (error) {
    if (!(error instanceof PartitionFactsError)) throw error;
    return { refusals: [`facts-unreadable ${root}: ${error.message}`] };
  }
}

function planOf({ rows, counts, findings }) {
  const copies = rows
    .filter(({ class: name }) => name === 'engine')
    .map(({ file }) => ({ from: file, to: isSeed(file) ? seedTarget(file) : file }));
  const manifest = {
    counts,
    seeds: copies.filter(({ from }) => isSeed(from)).map(({ to }) => to),
    siteBound: findings.filter(({ rule }) => rule === 'site-bound').map(({ where }) => where),
  };
  return { copies, manifest };
}

export function exportEngine({ root, target, files = trackedFiles(root) }) {
  const blocked = targetRefusal(target);
  if (blocked !== null) return refused([blocked]);
  const { report, refusals } = readReport(root, files);
  if (refusals) return refused(refusals);
  const blocking = report.findings.filter(({ rule }) => BLOCKING_RULES.has(rule));
  if (blocking.length > 0) return refused(blocking.map(({ rule, where, detail }) => `${rule} ${where}: ${detail}`));

  const { copies, manifest } = planOf(report);
  mkdirSync(target, { recursive: true });
  for (const { from, to } of copies) {
    mkdirSync(dirname(join(target, to)), { recursive: true });
    cpSync(join(root, from), join(target, to));
  }
  writeFileSync(join(target, EXPORT_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return { refusals: [], written: copies.map(({ to }) => to), manifest };
}

function options(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { root: { type: 'string' } },
    strict: true,
    allowPositionals: true,
  });
  if (positionals.length !== 1) throw new Error('give exactly one target directory');
  return { root: values.root === undefined ? REPOSITORY_ROOT : resolve(values.root), target: resolve(positionals[0]) };
}

export function main(argv, io = DEFAULT_IO) {
  let parsed;
  try {
    parsed = options(argv);
  } catch (error) {
    io.err(`export: ${error.message}\n${USAGE}`);
    return 2;
  }
  const { refusals, written, manifest } = exportEngine(parsed);
  if (refusals.length > 0) {
    for (const reason of refusals) io.err(`export: refused: ${reason}`);
    return 1;
  }
  const { counts, seeds, siteBound } = manifest;
  io.out(
    `export: ${written.length} engine files written to ${parsed.target}, ${seeds.length} of them seeds written at their target paths`
  );
  io.out(
    `export: ${counts.site} site and ${counts.evidence} evidence files stayed behind; ${siteBound.length} carried files still name the source site, listed in ${EXPORT_MANIFEST}`
  );
  return 0;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = main(process.argv.slice(2));
