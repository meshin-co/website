import { variable } from './escalate-channels.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { GITHUB, createResumeSweep, shortSha } from './pr-resume.mjs';
import { SECRET } from './pr-watch.mjs';

const USAGE = 'Usage: node scripts/run-pr-resume.mjs [--pr <number>]';
const PULL_REQUEST_NUMBER = /^[1-9][0-9]{0,8}$/;

const REQUIRED_VARIABLES = [
  ['GITHUB_REPOSITORY', 'GITHUB_REPOSITORY is not set; Actions sets it, and a run by hand passes owner/name'],
  [
    'GITHUB_TOKEN',
    'GITHUB_TOKEN is not set; the workflow passes github.token, and every read and every issue write uses it',
  ],
  [
    SECRET,
    `${SECRET} is not set; create a fine-grained personal access token for the bot account and store it as the repository secret ${SECRET}`,
  ],
  [
    'GITHUB_REF_NAME',
    'GITHUB_REF_NAME is not set; Actions sets it, and the sweep reads main and starts the watcher on that branch',
  ],
];

const LINES = {
  resumed: ({ pullRequest, by, mainSha, problems }) =>
    `#${pullRequest} resumed (${by}${mainSha === null ? '' : `, main ${shortSha(mainSha)}`})` +
    (problems.length === 0 ? '' : `, but ${problems.join('; ')}`),
  left: ({ pullRequest, reason }) => `#${pullRequest} left: ${reason}`,
  'issue-closed': ({ issue, merged }) => `#${issue} issue closed (pull request ${merged ? 'merged' : 'closed'})`,
  'issue-left': ({ issue, pullRequest }) => `#${issue} issue left (pull request #${pullRequest} was not found)`,
  failed: ({ subject, message }) => `${subject} failed: ${message}`,
};

class UsageError extends Error {}

export function parseArguments(argv) {
  const [flag, value, ...rest] = argv;
  if (flag === undefined) return { pullRequest: null };
  if (flag !== '--pr' || rest.length > 0) throw new UsageError(`${USAGE}\nunexpected argument ${rest[0] ?? flag}`);
  if (!PULL_REQUEST_NUMBER.test(value ?? '')) throw new UsageError(`${USAGE}\n--pr needs a whole number`);
  return { pullRequest: Number(value) };
}

export const describeItem = (item) => LINES[item.kind](item);

const failed = (item) => item.kind === 'failed' || (item.kind === 'resumed' && item.problems.length > 0);

export function summarise(items) {
  const counted = (kind) => items.filter((item) => item.kind === kind).length;
  const counts = [
    ['resumed', counted('resumed')],
    ['left', counted('left')],
    ['issues closed', counted('issue-closed')],
    ['failed', items.filter(failed).length],
  ];
  return `pr-resume: ${counts.map(([label, count]) => `${count} ${label}`).join(', ')}`;
}

function connect({ env, fetch, io }) {
  const missing = REQUIRED_VARIABLES.filter(([name]) => variable(env, name) === '').map(([, hint]) => hint);
  if (missing.length > 0) throw new Error(missing.join('; '));
  const repo = variable(env, 'GITHUB_REPOSITORY');
  return {
    reader: io.createApi({ repo, token: variable(env, 'GITHUB_TOKEN'), fetch }),
    writer: io.createApi({ repo, token: variable(env, SECRET), fetch }),
    ref: variable(env, 'GITHUB_REF_NAME'),
  };
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
    const { pullRequest } = parseArguments(argv);
    const sweep = createResumeSweep({ io, ...connect({ env, fetch, io }), now });
    const items = await sweep.run({ pullRequest });
    for (const item of items) stdout(describeItem(item));
    stdout(summarise(items));
    const refused = pullRequest !== null && items[0].kind === 'left';
    if (refused) stderr(`pr-resume: pull request #${pullRequest} was not resumed: ${items[0].reason}`);
    return refused || items.some(failed) ? 1 : 0;
  } catch (error) {
    stderr(`pr-resume: ${error.message}`);
    return error instanceof UsageError ? 2 : 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
