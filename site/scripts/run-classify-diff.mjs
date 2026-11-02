import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { classifyDiff } from './classify-diff.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const USAGE =
  'usage: node scripts/run-classify-diff.mjs --before <revision, or empty> --after <revision> [--repository <directory>]';
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const OPTIONS = {
  before: { type: 'string' },
  after: { type: 'string' },
  repository: { type: 'string' },
};

function readOptions(argv) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: OPTIONS, strict: true, allowPositionals: false }));
  } catch (error) {
    return { error: error.message };
  }
  if (!values.after) return { error: '--after is required' };
  return {
    before: values.before ?? '',
    after: values.after,
    repository: values.repository ? resolve(values.repository) : REPOSITORY_ROOT,
  };
}

export function main(argv) {
  const options = readOptions(argv);
  if (options.error !== undefined) {
    console.error(`classify: ${options.error}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  const { code, lines } = classifyDiff(options);
  for (const line of lines) console.error(`classify: ${line}`);
  console.log(`code=${code}`);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
