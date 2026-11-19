import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleepFor } from 'node:timers/promises';

const ANSWERED_BY_PAGES = new Set(['_headers', '_redirects', '_worker.js', '404.html']);
const REQUEST_TIMEOUT_MS = 15_000;

export const NEGOTIATION_PROBE = { path: '/', accept: 'text/markdown', contentType: 'text/markdown' };

function filesUnder(root, dir = '') {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = dir === '' ? entry.name : `${dir}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(root, relative) : [relative];
  });
}

function pathOf(file) {
  if (file === 'index.html') return '/';
  return `/${file.replace(/\.html$/, '')}`;
}

export function builtProbes(distDir) {
  const files = filesUnder(distDir).filter((file) => !ANSWERED_BY_PAGES.has(file));
  return [...files.map((file) => ({ path: encodeURI(pathOf(file)) })), NEGOTIATION_PROBE];
}

export function routesTheBuildLacks(probes, required) {
  const built = new Set(probes.map(({ path }) => path));
  return required.filter((route) => !built.has(route));
}

async function isServed(origin, probe, fetchImpl) {
  try {
    const response = await fetchImpl(`${origin}${probe.path}`, {
      headers: probe.accept ? { accept: probe.accept } : {},
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await response.body?.cancel();
    if (response.status !== 200) return false;
    return !probe.contentType || (response.headers.get('content-type') ?? '').startsWith(probe.contentType);
  } catch {
    return false;
  }
}

export async function unservedProbes(origin, probes, { fetchImpl = fetch, concurrency = 32 } = {}) {
  const unserved = [];
  let next = 0;
  const worker = async () => {
    while (next < probes.length) {
      const probe = probes[next++];
      if (!(await isServed(origin, probe, fetchImpl))) unserved.push(probe);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, probes.length) }, worker));
  return unserved.sort((a, b) => a.path.localeCompare(b.path));
}

export async function waitForPreview({
  origin,
  probes,
  cleanSweeps = 2,
  deadlineMs = 120_000,
  intervalMs = 1_000,
  fetchImpl = fetch,
  sleep = sleepFor,
  now = Date.now,
}) {
  const started = now();
  let sweeps = 0;
  let consecutiveClean = 0;
  for (;;) {
    const unserved = await unservedProbes(origin, probes, { fetchImpl });
    sweeps += 1;
    consecutiveClean = unserved.length === 0 ? consecutiveClean + 1 : 0;
    const elapsedMs = now() - started;
    if (consecutiveClean >= cleanSweeps) return { ok: true, sweeps, elapsedMs, unserved };
    if (elapsedMs >= deadlineMs) return { ok: false, sweeps, elapsedMs, unserved };
    await sleep(intervalMs);
  }
}
