import { resolve } from 'node:path';

import { entriesInBuild } from './entries-in-build.mjs';
import { runLink } from './github-links.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { siteOrigin } from './links-gate.mjs';
import { unmeasuredTree } from './deploy.mjs';
import { announceEntries } from './live-announce.mjs';
import { announce, readState, selectEntries, writeState } from './live-state.mjs';
import { readMeasurementState } from './measurement-state.mjs';
import { SITE_CONFIG } from './site-brand.mjs';
import { ceilingStatus } from './spend-ceiling.mjs';
import { countText } from './spend-report-text.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const FLAGS = ['dist', 'state', 'repo-root'];
const USAGE =
  'Usage: node scripts/live-entry.mjs --dist <built site directory> --state <file that remembers which entries were announced> [--repo-root <dir>]';

class UsageError extends Error {}

function parseArguments(argv) {
  const options = {};
  for (let at = 0; at < argv.length; at += 2) {
    const name = argv[at].startsWith('--') ? argv[at].slice(2) : null;
    if (!FLAGS.includes(name)) throw new UsageError(`unknown argument ${argv[at]}`);
    if (argv[at + 1] === undefined) throw new UsageError(`${argv[at]} needs a value`);
    options[name] = argv[at + 1];
  }
  if (options.dist === undefined || options.state === undefined)
    throw new UsageError('--dist and --state are required');
  return options;
}

async function describeUnmeasured(repoRoot) {
  const measurement = await readMeasurementState(repoRoot);
  if (measurement.reason) throw new Error(measurement.reason);
  return unmeasuredTree(measurement);
}

const recordedLine = (count) =>
  `live entry: first run: recorded ${countText(count, 'existing entry', 'existing entries')} as already announced, without a message`;

async function run({ options, origin, io }) {
  const { env, now, statusOf, unmeasuredOf, stdout, stderr } = io;
  const repoRoot = options['repo-root'] === undefined ? REPOSITORY_ROOT : resolve(options['repo-root']);
  const statePath = resolve(options.state);
  const instant = now();
  const state = readState(statePath);
  const { entries, problems } = await entriesInBuild({ repoRoot, dist: resolve(options.dist), instant });
  problems.forEach((problem) => stderr(`::warning::live entry: ${problem}`));
  const { fresh, seeded } = selectEntries({ carried: entries, state, instant });
  let known = announce(
    state,
    seeded.map(({ route }) => route),
    instant.toISOString()
  );
  if (state === null || seeded.length > 0) writeState(statePath, known);
  if (seeded.length > 0) stdout(recordedLine(seeded.length));
  if (fresh.length === 0) {
    if (seeded.length === 0) stdout('live entry: no new entry in this publish, so no message was posted');
    return 0;
  }
  const record = (routes) => {
    known = announce(known, routes, now().toISOString());
    writeState(statePath, known);
  };
  const status = statusOf({ repoRoot, now: instant });
  const unmeasured = await unmeasuredOf(repoRoot).catch((error) => {
    stderr(`::warning::live entry: whether the tree was measured is unknown: ${error.message}`);
    return null;
  });
  await announceEntries({ ...io, entries: fresh, origin, status, unmeasured, links: { run: runLink(env) }, record });
  return 0;
}

export async function runCli(argv, io = {}) {
  const { env = process.env, fetch = globalThis.fetch, now = () => new Date(), sleep, statusOf = ceilingStatus } = io;
  const { unmeasuredOf = describeUnmeasured } = io;
  const { stdout = console.log, stderr = console.error } = io;
  try {
    const options = parseArguments(argv);
    const origin = io.origin ?? siteOrigin(SITE_CONFIG);
    return await run({ options, origin, io: { env, fetch, now, sleep, statusOf, unmeasuredOf, stdout, stderr } });
  } catch (error) {
    if (error instanceof UsageError) {
      stderr(`live entry: ${error.message}\n${USAGE}`);
      return 2;
    }
    stderr(`live entry: ${error.message}`);
    return 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
