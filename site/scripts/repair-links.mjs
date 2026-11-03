import { join, resolve } from 'node:path';

import { variable } from './escalate-channels.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { probeAll as probeOutbound } from './link-probe.mjs';
import { ARCHIVE_SPACING_MS } from './link-repair-archive.mjs';
import { connectGitHub, openLinkRotPulls, publishRepair } from './link-repair-publish.mjs';
import { summaryLine } from './link-repair-report.mjs';
import { settleDispositions } from './link-repair-settle.mjs';
import { SweepError, sweepLinks } from './link-repair-sweep.mjs';
import { REGISTER_PATH, readRegister } from './link-rot-register.mjs';
import { siteOrigin } from './links-gate.mjs';
import { closestSnapshot as nearestCapture, readSnapshot as readCapture } from './wayback.mjs';

const USAGE = 'Usage: node scripts/repair-links.mjs [--repo-root <dir>] [--today <YYYY-MM-DD>]';
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const FLAGS = new Map([
  ['--repo-root', 'repoRoot'],
  ['--today', 'today'],
]);
const NOTHING = { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0 };

class UsageError extends Error {}

const realSleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const utcToday = () => new Date().toISOString().slice(0, 10);

function parseArguments(argv) {
  const found = {};
  for (let at = 0; at < argv.length; at += 2) {
    if (!FLAGS.has(argv[at]) || at + 1 >= argv.length)
      throw new UsageError(`${USAGE}\nunexpected argument ${argv[at]}`);
    found[FLAGS.get(argv[at])] = argv[at + 1];
  }
  if (found.today !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(found.today))
    throw new UsageError(`${USAGE}\n--today is a day written YYYY-MM-DD`);
  return found;
}

function spacingFrom(env) {
  const given = variable(env, 'REPAIR_LINKS_ARCHIVE_SPACING_MS');
  if (given === '') return ARCHIVE_SPACING_MS;
  const spacing = Number(given);
  if (!Number.isInteger(spacing) || spacing < 0)
    throw new UsageError(`REPAIR_LINKS_ARCHIVE_SPACING_MS is a whole number of milliseconds, got ${given}`);
  return spacing;
}

export async function repairLinks({
  repoRoot = REPOSITORY_ROOT,
  env = process.env,
  fetch = globalThis.fetch,
  today = utcToday(),
  probeAll = probeOutbound,
  closestSnapshot = nearestCapture,
  readSnapshot = readCapture,
  sleep = realSleep,
  spacingMs = spacingFrom(env),
  settle = settleDispositions,
  out = console.log,
}) {
  const site = join(repoRoot, 'site');
  const api = connectGitHub({ env, fetch });
  const [open] = await openLinkRotPulls(api);
  if (open !== undefined) {
    const note = `pull request #${open.number} (${open.head.ref}) is still open, so nothing was checked`;
    const summary = summaryLine({ counts: NOTHING, pullRequest: null, note });
    out(summary);
    return { summary, result: null, pullRequest: null };
  }
  const { register: existing, problems } = readRegister(repoRoot);
  if (problems.length > 0)
    throw new SweepError(`${REGISTER_PATH} fails its own guard (${problems[0]}), so the job will not write over it`);
  const result = await sweepLinks({
    repoRoot,
    dist: join(site, 'dist'),
    origin: siteOrigin(join(site, 'src', 'config.yaml')),
    today,
    existing,
    probeAll,
    closestSnapshot,
    readSnapshot,
    sleep,
    spacingMs,
  });
  const pullRequest =
    result.files.size === 0 ? null : await publishRepair({ repoRoot, api, result, today, env, settle });
  const summary = summaryLine({ counts: result.counts, pullRequest });
  out(summary);
  return { summary, result, pullRequest };
}

export async function runCli(argv, { stdout = console.log, stderr = console.error, ...options } = {}) {
  try {
    const { repoRoot, today } = parseArguments(argv);
    await repairLinks({
      ...(repoRoot === undefined ? {} : { repoRoot: resolve(repoRoot) }),
      ...(today === undefined ? {} : { today }),
      out: stdout,
      ...options,
    });
    return 0;
  } catch (error) {
    stderr(`repair-links: ${error.message}`);
    return error instanceof UsageError ? 2 : 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
