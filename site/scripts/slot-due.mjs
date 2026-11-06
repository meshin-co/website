import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { readClaims } from './autowriter-claim-store.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { CATCH_UP_AFTER_MINUTES, STOPPED_RUN_RETRIES_PER_DAY, WRITE_TIMES_UTC } from './schedule-workflow.mjs';
import { slotStanding } from './slot-standing.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const USAGE =
  'usage: node scripts/slot-due.mjs --event <schedule|workflow_dispatch> [--repo-root <dir>] [--now <UTC instant, such as 2026-11-05T05:17:00Z>]';

class UsageError extends Error {}

const counted = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function parse(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { event: { type: 'string' }, 'repo-root': { type: 'string' }, now: { type: 'string' } },
      strict: true,
    }));
  } catch (error) {
    throw new UsageError(`${error.message}. ${USAGE}`);
  }
  if (values.event !== 'schedule' && values.event !== 'workflow_dispatch')
    throw new UsageError(`--event must be schedule or workflow_dispatch, got ${values.event}. ${USAGE}`);
  if (values.now !== undefined && Number.isNaN(Date.parse(values.now)))
    throw new UsageError(`--now must be an ISO instant, got ${values.now}. ${USAGE}`);
  return values;
}

function verdict({ event, repoRoot, now, times, catchUpMinutes, forgivenPerDay }) {
  if (event === 'workflow_dispatch')
    return { due: true, text: 'slot: started by hand (workflow_dispatch), so no slot quota applies; the run writes' };
  const found = slotStanding({ times, catchUpMinutes, forgivenPerDay, claims: readClaims(repoRoot), now });
  const forgiven =
    found.forgiven === 0
      ? ''
      : `, with ${counted(found.forgiven, 'stopped run')} forgiven so the slot is written again`;
  const held = `${counted(found.entries, 'article')} claimed today for ${counted(found.passed, 'slot')} passed${forgiven}`;
  if (!found.due)
    return { due: false, text: `slot: ${held}, so nothing is owed; the run stops before any model is called` };
  const late = `the ${found.slot} slot is ${counted(found.lateMinutes, 'minute')} late`;
  const how = found.catchUp === null ? 'the run writes' : 'this run is a catch-up and writes';
  return { due: true, text: `slot: ${held}; ${late}, so ${how}` };
}

export function runCli(argv, io = {}) {
  const {
    env = process.env,
    stdout = console.log,
    stderr = console.error,
    now = () => new Date(),
    times = WRITE_TIMES_UTC,
    catchUpMinutes = CATCH_UP_AFTER_MINUTES,
    forgivenPerDay = STOPPED_RUN_RETRIES_PER_DAY,
  } = io;
  let outcome;
  try {
    const values = parse(argv);
    const instant = values.now === undefined ? now() : new Date(values.now);
    const repoRoot =
      values['repo-root'] === undefined ? (io.repoRoot ?? REPOSITORY_ROOT) : resolve(values['repo-root']);
    outcome = verdict({ event: values.event, repoRoot, now: instant, times, catchUpMinutes, forgivenPerDay });
  } catch (error) {
    stderr(`slot-due: ${error.message}`);
    return error instanceof UsageError ? 2 : 1;
  }
  stdout(outcome.text);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `due=${outcome.due}\n`);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `### Slot check\n\n${outcome.text}\n`);
  return 0;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = runCli(process.argv.slice(2));
