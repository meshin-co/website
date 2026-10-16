import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readdir, rm, symlink } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';

import { deadlineMs, shardPlan, workerCount } from './lh-parallel.mjs';

const FLOOR_MS = Number(process.env.LH_SHARD_FLOOR_MS ?? 15 * 60 * 1000);
const GRACE_MS = Number(process.env.LH_SHARD_GRACE_MS ?? 15 * 1000);

const absoluteRouteFile = process.env.LH_ONLY_ROUTES ? { LH_ONLY_ROUTES: resolve(process.env.LH_ONLY_ROUTES) } : {};

const routeCount = () => {
  const counted = spawnSync('node', ['scripts/lh-routes.cjs', '--count'], {
    encoding: 'utf8',
    env: { ...process.env, ...absoluteRouteFile },
  });
  const parsed = Number((counted.stdout ?? '').trim());
  return Number.isInteger(parsed) ? parsed : undefined;
};

const routes = routeCount();

if (routes === 0) {
  console.log('0 touched routes to audit');
  process.exit(0);
}

const shards = workerCount({ cores: cpus().length, requested: process.env.LH_WORKERS });
const plan = shardPlan({ factors: ['mobile', 'desktop'], shards, routes, basePort: 4330 });

if (process.env.GATE_PHASE) {
  const phase = process.env.GATE_PHASE.replace(/^phase-/, '');
  for (const factor of ['mobile', 'desktop']) {
    await rm(join('..', 'audits', `phase-${phase}`, `lh-${factor}`), { recursive: true, force: true });
  }
}

const live = new Set();
const done = [];
const failed = [];

const signal = (child, name) => {
  try {
    process.kill(-child.pid, name);
  } catch {
    child.kill(name);
  }
};

const stopAll = (name) => {
  for (const child of live) signal(child, name);
};

for (const name of ['SIGINT', 'SIGTERM']) {
  process.on(name, () => {
    console.error(`lighthouse: ${name}, stopping ${live.size} shard(s)`);
    stopAll('SIGTERM');
    setTimeout(() => {
      stopAll('SIGKILL');
      process.exit(130);
    }, GRACE_MS).unref();
  });
}

const LINKED = ['package.json', 'node_modules', 'scripts', 'src', 'dist', 'lighthouserc.cjs', 'budgets.json'];
const repoRoot = process.env.AUDIT_ROOT ?? resolve('..');

async function shardDirectory({ factor, index }) {
  const dir = join('.lh-run', `${factor}-${index}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const name of LINKED) await symlink(resolve(name), join(dir, name)).catch(() => {});
  return dir;
}

async function reportCount({ factor, index, total }) {
  const phase = (process.env.GATE_PHASE ?? '').replace(/^phase-/, '');
  const base = join(repoRoot, 'audits', `phase-${phase}`, `lh-${factor}`);
  const names = await readdir(total === 1 ? base : join(base, `shard-${index}`)).catch(() => []);
  return names.filter((name) => name.startsWith('lhr-') && name.endsWith('.json')).length;
}

async function runShard({ factor, index, total, port }) {
  const label = `${factor} ${index}/${total}`;
  const started = Date.now();
  const limit = deadlineMs({ done, floorMs: FLOOR_MS });
  const cwd = await shardDirectory({ factor, index });

  const code = await new Promise((settle) => {
    const child = spawn('npm', ['run', 'gate:lh:one'], {
      cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: true,
      env: {
        ...process.env,
        LHCI_FORM_FACTOR: factor,
        LH_SHARD_INDEX: String(index),
        LH_SHARD_TOTAL: String(total),
        GATE_SERVER_PORT: String(port),
        AUDIT_ROOT: repoRoot,
        ...absoluteRouteFile,
      },
    });
    live.add(child);

    const watchdog = setTimeout(() => {
      console.error(`lighthouse: ${label} passed ${Math.round(limit / 1000)}s, stopping it`);
      failed.push(`${label} exceeded ${Math.round(limit / 1000)}s and was stopped`);
      signal(child, 'SIGTERM');
      setTimeout(() => signal(child, 'SIGKILL'), GRACE_MS).unref();
    }, limit);

    child.on('close', (exitCode) => {
      clearTimeout(watchdog);
      live.delete(child);
      settle(exitCode);
    });
  });

  const took = Date.now() - started;
  if (failed.some((entry) => entry.startsWith(`${label} exceeded`))) return;

  if (code !== 0) {
    failed.push(`${label} exited ${code}`);
    return;
  }

  const reports = await reportCount({ factor, index, total });
  if (reports === 0) {
    failed.push(`${label} collected no reports, so it measured nothing`);
    return;
  }

  done.push(took);
  console.log(`lighthouse: ${label} done in ${Math.round(took / 1000)}s, ${reports} reports`);
}

const queue = [...plan];
await Promise.all(
  Array.from({ length: shards }, async () => {
    while (queue.length > 0) await runShard(queue.shift());
  })
);

console.log(`lighthouse: ${plan.length} shards across ${shards} workers, ${failed.length} failed`);
for (const failure of failed) console.error(`LIGHTHOUSE ${failure}`);
if (failed.length > 0) process.exitCode = 1;
