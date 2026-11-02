import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { partitionReport, summaryLine } from './engine-partition-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { PartitionFactsError } from './engine-partition-facts.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const USAGE = 'usage: node scripts/run-partition-gate.mjs [--root <repository>] [--list]';

export function trackedFiles(root) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\0')
    .filter((file) => file !== '' && existsSync(join(root, file)));
}

export const readerOf = (root) => (path) => {
  const file = join(root, path);
  return existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : null;
};

function options(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { root: { type: 'string' }, list: { type: 'boolean' } },
    strict: true,
    allowPositionals: false,
  });
  return { root: values.root === undefined ? REPOSITORY_ROOT : resolve(values.root), list: values.list === true };
}

export function main(argv) {
  let parsed;
  try {
    parsed = options(argv);
  } catch (error) {
    console.error(`partition: ${error.message}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  try {
    const report = partitionReport({ files: trackedFiles(parsed.root), read: readerOf(parsed.root) });
    if (parsed.list)
      for (const { file, class: name, rule } of report.rows) console.log(`${name ?? 'none'} ${rule ?? '-'} ${file}`);
    for (const { rule, where, detail } of report.findings) console.log(`PARTITION ${rule} ${where}: ${detail}`);
    console.log(summaryLine(report));
    process.exitCode = report.findings.length === 0 ? 0 : 1;
  } catch (error) {
    if (!(error instanceof PartitionFactsError)) throw error;
    console.log(`PARTITION facts-unreadable ${parsed.root}: ${error.message}`);
    console.log('partition: 0 engine, 0 site, 0 evidence files; 1 finding');
    process.exitCode = 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
