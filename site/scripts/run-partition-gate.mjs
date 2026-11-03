import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { partitionReport, summaryLine } from './engine-partition-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { PartitionFactsError } from './engine-partition-facts.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const USAGE =
  'usage: node scripts/run-partition-gate.mjs [--root <repository>] [--list] [--allow site-bound=<number of files>]';
const ALLOWABLE = 'site-bound';
const CEILING = /^site-bound=(\d+)$/;

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
    options: { root: { type: 'string' }, list: { type: 'boolean' }, allow: { type: 'string', multiple: true } },
    strict: true,
    allowPositionals: false,
  });
  const ceilings = (values.allow ?? []).map((entry) => CEILING.exec(entry));
  if (ceilings.length > 1 || ceilings.includes(null)) {
    throw new Error(`--allow takes ${ALLOWABLE}=<number of files>, one ceiling and no other rule`);
  }
  return {
    root: values.root === undefined ? REPOSITORY_ROOT : resolve(values.root),
    list: values.list === true,
    ceiling: ceilings.length === 0 ? null : Number(ceilings[0][1]),
  };
}

function split(findings, ceiling) {
  const siteBound = findings.filter(({ rule }) => rule === ALLOWABLE);
  const others = findings.filter(({ rule }) => rule !== ALLOWABLE);
  if (ceiling === null) return { allowed: [], enforced: findings, siteBound, ceiling };
  if (siteBound.length <= ceiling) return { allowed: siteBound, enforced: others, siteBound, ceiling };
  return { allowed: [], enforced: findings, siteBound, ceiling };
}

function ceilingLines({ allowed, siteBound, ceiling }) {
  if (ceiling === null) return [];
  if (siteBound.length > ceiling) {
    return [
      `PARTITION site-bound-ceiling ${siteBound.length} files: ${ceiling} is allowed, so a new engine file names the site: move its fact into the config or a seeded data file`,
    ];
  }
  if (allowed.length < ceiling) {
    const noun = allowed.length === 1 ? 'file' : 'files';
    return [
      `NOTE site-bound: ${allowed.length} ${noun} names the site and ${ceiling} are allowed; lower --allow to site-bound=${allowed.length}`,
    ];
  }
  return [];
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
    const { allowed, enforced, siteBound } = split(report.findings, parsed.ceiling);
    if (parsed.list)
      for (const { file, class: name, rule } of report.rows) console.log(`${name ?? 'none'} ${rule ?? '-'} ${file}`);
    for (const { rule, where, detail } of enforced) console.log(`PARTITION ${rule} ${where}: ${detail}`);
    for (const { rule, where, detail } of allowed) console.log(`ALLOWED ${rule} ${where}: ${detail}`);
    for (const line of ceilingLines({ allowed, siteBound, ceiling: parsed.ceiling })) console.log(line);
    const suffix = allowed.length === 0 ? '' : `; ${allowed.length} allowed`;
    console.log(`${summaryLine({ ...report, findings: enforced })}${suffix}`);
    process.exitCode = enforced.length === 0 ? 0 : 1;
  } catch (error) {
    if (!(error instanceof PartitionFactsError)) throw error;
    console.log(`PARTITION facts-unreadable ${parsed.root}: ${error.message}`);
    console.log('partition: 0 engine, 0 site, 0 evidence files; 1 finding');
    process.exitCode = 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
