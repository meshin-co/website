import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { readEngineConfig } from './engine-config.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { WRITE_DAILY_PATH, withSchedule } from './schedule-workflow.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const CONFIG_PATH = 'site/engine.config.json';
const USAGE = 'usage: node scripts/generate-schedule.mjs [--root <repository root>]';

export function generateSchedule(root = REPOSITORY_ROOT) {
  const times = readEngineConfig(join(root, CONFIG_PATH)).loop.writeTimesUtc;
  const workflowFile = join(root, WRITE_DAILY_PATH);
  const current = readFileSync(workflowFile, 'utf8');
  const next = withSchedule(current, times);
  const changed = next !== current;
  if (changed) writeFileSync(workflowFile, next);
  return { path: WRITE_DAILY_PATH, times, changed };
}

function readRoot(argv) {
  try {
    const { values } = parseArgs({ args: argv, options: { root: { type: 'string' } }, strict: true });
    const root = values.root === undefined ? REPOSITORY_ROOT : resolve(values.root);
    return statSync(root).isDirectory() ? { root } : { error: `${root} is not a directory` };
  } catch (error) {
    return { error: error.code === 'ENOENT' ? `${error.path} does not exist` : error.message };
  }
}

export function main(argv) {
  const { root, error } = readRoot(argv);
  if (error !== undefined) {
    console.error(`schedule: ${error}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  try {
    const { path, times, changed } = generateSchedule(root);
    const listed = times.join(', ');
    console.log(
      changed
        ? `schedule: wrote ${times.length} cron ${times.length === 1 ? 'entry' : 'entries'} into ${path} for ${listed} (loop.writeTimesUtc)`
        : `schedule: ${path} already holds the cron entries for ${listed} (loop.writeTimesUtc); nothing written`
    );
  } catch (failure) {
    console.error(`schedule: ${failure.message}`);
    process.exitCode = 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
