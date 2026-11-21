import { parseReport } from './pr-watch-report.mjs';
import { OUTCOMES } from './repair-outcome.mjs';

const USAGE = 'Usage: node scripts/pr-watch.mjs --pr <number> [--observed <token>] [--after-repair <json line>]';
const FLAGS = new Map([
  ['--pr', 'number'],
  ['--observed', 'observed'],
  ['--after-repair', 'afterRepair'],
]);
const PULL_REQUEST_NUMBER = /^[1-9][0-9]{0,8}$/;
const OBSERVATION = /^[A-Za-z0-9:._-]{0,200}$/;

export class UsageError extends Error {}

export function parseArguments(argv) {
  const found = {};
  for (let at = 0; at < argv.length; at += 2) {
    if (!FLAGS.has(argv[at]) || at + 1 >= argv.length)
      throw new UsageError(`${USAGE}\nunexpected argument ${argv[at]}`);
    found[FLAGS.get(argv[at])] = argv[at + 1];
  }
  if (!PULL_REQUEST_NUMBER.test(found.number ?? '')) throw new UsageError(`${USAGE}\n--pr needs a whole number`);
  const observed = found.observed ?? '';
  if (!OBSERVATION.test(observed)) throw new UsageError(`${USAGE}\n--observed holds only letters, digits and : . _ -`);
  const after = found.afterRepair === undefined ? null : parseReport(found.afterRepair);
  if (found.afterRepair !== undefined && after === null)
    throw new UsageError(
      `${USAGE}\n--after-repair is the JSON line the repair printed, with an outcome that is one of ${OUTCOMES.join(', ')}`
    );
  return {
    number: Number(found.number),
    observed,
    ...(after === null ? {} : { afterRepair: after.outcome, report: after.report }),
  };
}
