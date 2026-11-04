import { join, resolve } from 'node:path';

import { variable } from './escalate-channels.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { probeAll as probeOutbound } from './link-probe.mjs';
import { ARCHIVE_SPACING_MS, archiveRung } from './link-repair-archive.mjs';
import { connectGitHub, openLinkRotPulls, publishRepair } from './link-repair-publish.mjs';
import { mergeReexamined, reexaminationLines, reexamineSearchRows } from './link-repair-reexamine.mjs';
import { summaryLine } from './link-repair-report.mjs';
import { settleRepair } from './link-repair-settle.mjs';
import { SweepError, sweepLinks } from './link-repair-sweep.mjs';
import { REGISTER_PATH, readRegister } from './link-rot-register.mjs';
import { RUNS_BEFORE_DEAD, readWatch, writeWatch } from './link-rot-watch.mjs';
import { siteOrigin } from './links-gate.mjs';
import { readLivePage as readOriginalPage } from './live-page.mjs';
import { closestSnapshot as nearestCapture, readSnapshot as readCapture } from './wayback.mjs';

const USAGE = 'Usage: node scripts/repair-links.mjs [--repo-root <dir>] [--today <YYYY-MM-DD>] [--watch <file>]';
const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const FLAGS = new Map([
  ['--repo-root', 'repoRoot'],
  ['--today', 'today'],
  ['--watch', 'watch'],
]);
const NOTHING = { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0, watching: 0, restored: 0, upgraded: 0 };
const NO_WATCH =
  'repair-links: no watch file is configured (--watch or REPAIR_LINKS_WATCH), so nothing is remembered between runs and a host name that stops resolving is never counted dead';

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

function watchFrom(env) {
  const given = variable(env, 'REPAIR_LINKS_WATCH');
  return given === '' ? '' : resolve(given);
}

function openWatch({ watchPath, out }) {
  if (watchPath === '') {
    out(NO_WATCH);
    return null;
  }
  const { state, note } = readWatch(watchPath);
  if (note !== null) out(`repair-links: ${note}`);
  return state;
}

const NO_WITNESS =
  "repair-links: no host answered this run, so the network or the resolver may be down; no host's count moved";

const watchingLine = ({ host, runs, firstSeen }) =>
  `repair-links: watching ${host}: it did not resolve on ${runs} of ${RUNS_BEFORE_DEAD} consecutive scheduled runs, since ${firstSeen}`;

export async function repairLinks({
  repoRoot = REPOSITORY_ROOT,
  env = process.env,
  fetch = globalThis.fetch,
  today = utcToday(),
  probeAll = probeOutbound,
  readLivePage = readOriginalPage,
  closestSnapshot = nearestCapture,
  readSnapshot = readCapture,
  sleep = realSleep,
  spacingMs = spacingFrom(env),
  settle = settleRepair,
  watchPath = watchFrom(env),
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
  const watch = openWatch({ watchPath, out });
  const rung = archiveRung({ closestSnapshot, readSnapshot, sleep, spacingMs });
  const swept = await sweepLinks({
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
    watch,
    rung,
  });
  const reexamined = await reexamineSearchRows({
    repoRoot,
    today,
    existing,
    pending: swept.files,
    skip: new Set(swept.dead),
    probeAll,
    readLivePage,
    rung,
  });
  const result = mergeReexamined({ swept, reexamined, today });
  const pullRequest =
    result.files.size === 0 ? null : await publishRepair({ repoRoot, api, result, today, env, settle });
  if (watchPath !== '') writeWatch(watchPath, result.watchState);
  if (swept.witnessed === false) out(NO_WITNESS);
  for (const lapse of result.watching) out(watchingLine(lapse));
  for (const line of reexaminationLines(result)) out(line);
  const summary = summaryLine({ counts: result.counts, pullRequest });
  out(summary);
  return { summary, result, pullRequest };
}

export async function runCli(argv, { stdout = console.log, stderr = console.error, ...options } = {}) {
  try {
    const { repoRoot, today, watch } = parseArguments(argv);
    await repairLinks({
      ...(repoRoot === undefined ? {} : { repoRoot: resolve(repoRoot) }),
      ...(today === undefined ? {} : { today }),
      ...(watch === undefined ? {} : { watchPath: resolve(watch) }),
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
