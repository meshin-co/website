import { invokedDirectly } from './invoked-directly.mjs';
import { REMEASURE_RESULTS, createRemeasurer } from './pr-remeasure.mjs';
import { GITHUB } from './pr-resume.mjs';
import { connect } from './run-pr-resume.mjs';

const USAGE = `Usage: node scripts/remeasure-record.mjs --pr <number> --result <${REMEASURE_RESULTS.join('|')}>`;
const PULL_REQUEST_NUMBER = /^[1-9][0-9]{0,8}$/;

class UsageError extends Error {}

export function parseArguments(argv) {
  const [first, number, second, result, ...rest] = argv;
  if (first !== '--pr' || second !== '--result' || rest.length > 0) throw new UsageError(USAGE);
  if (!PULL_REQUEST_NUMBER.test(number ?? '')) throw new UsageError(`${USAGE}\n--pr needs a whole number`);
  if (!REMEASURE_RESULTS.includes(result))
    throw new UsageError(`${USAGE}\n--result is one of ${REMEASURE_RESULTS.join(', ')}`);
  return { number: Number(number), result };
}

export async function runCli(
  argv,
  {
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    fetch = globalThis.fetch,
    io = GITHUB,
    now = () => new Date(),
  } = {}
) {
  try {
    const { number, result } = parseArguments(argv);
    const remeasurer = createRemeasurer({ io, ...connect({ env, fetch, io }), now });
    const item = await remeasurer.settle({ number, result });
    stdout(
      `remeasure-record: #${number} ${result}${item.problems.length === 0 ? '' : `, but ${item.problems.join('; ')}`}`
    );
    return item.problems.length === 0 ? 0 : 1;
  } catch (error) {
    stderr(`remeasure-record: ${error.message}`);
    return error instanceof UsageError ? 2 : 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
