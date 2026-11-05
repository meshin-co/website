import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { EngineConfigError, readEngineConfig } from './engine-config.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { REGENERATE_COMMAND, WRITE_DAILY_PATH, scheduleFindings } from './schedule-workflow.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const CONFIG_PATH = 'site/engine.config.json';
const USAGE = 'usage: node scripts/schedule-gate.mjs [--root <repository root>]';

const finding = (rule, where, detail) => ({ rule, where, detail });

function timesOf(root) {
  try {
    const { writeTimesUtc: times, catchUpAfterMinutes: catchUp } = readEngineConfig(join(root, CONFIG_PATH)).loop;
    return { times, catchUp };
  } catch (error) {
    if (!(error instanceof EngineConfigError)) throw error;
    return { problem: finding('config-invalid', CONFIG_PATH, error.message) };
  }
}

export function scheduleReport(root = REPOSITORY_ROOT) {
  const { times, catchUp, problem } = timesOf(root);
  if (problem !== undefined) return { times: null, catchUp: null, findings: [problem] };
  const file = join(root, WRITE_DAILY_PATH);
  if (!existsSync(file)) {
    const detail = `the file is absent, so nothing runs the writer; restore it, then run ${REGENERATE_COMMAND}`;
    return { times, catchUp, findings: [finding('workflow-missing', WRITE_DAILY_PATH, detail)] };
  }
  return {
    times,
    catchUp,
    findings: scheduleFindings(readFileSync(file, 'utf8'), times, catchUp).map(({ rule, detail }) =>
      finding(rule, WRITE_DAILY_PATH, detail)
    ),
  };
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

const retriesOf = (catchUp) =>
  catchUp.length === 0
    ? ''
    : `, and tries each slot again ${catchUp.join(', ')} minutes later, the delays of loop.catchUpAfterMinutes`;

const summaryOf = ({ times, catchUp, findings }) =>
  findings.length === 0
    ? `schedule: 0 findings (${WRITE_DAILY_PATH} starts the writer at ${times.join(', ')} UTC, the times of loop.writeTimesUtc${retriesOf(catchUp)})`
    : `schedule: ${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} (${WRITE_DAILY_PATH} must hold the schedule ${REGENERATE_COMMAND} writes from loop.writeTimesUtc and loop.catchUpAfterMinutes)`;

export function main(argv) {
  const { root, error } = readRoot(argv);
  if (error !== undefined) {
    console.error(`schedule: ${error}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  const report = scheduleReport(root);
  for (const { rule, where, detail } of report.findings) console.error(`SCHEDULE ${rule} ${where}: ${detail}`);
  console.log(summaryOf(report));
  process.exitCode = report.findings.length === 0 ? 0 : 1;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main(process.argv.slice(2));
