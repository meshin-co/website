import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { resolvePhase } from './collect-reports.mjs';

const AUDITS_DIR = resolve(process.cwd(), '..', 'audits');
const NUMBERED_PHASE = /^phase-\d+(?:\.\d+)?$/;

export function phaseOrder(names) {
  return [...names].sort((a, b) => {
    const value = (name) => Number(name.replace(/^phase-/, '')) || 0;
    return value(a) - value(b);
  });
}

export function diffRoutes({ previous, current, explained }) {
  const currentSet = new Set(current);
  const explainedSet = new Set(explained);
  if (!previous) {
    return { ok: true, baseline: true, added: current, removed: [], unexplained: [], staleExplanations: [] };
  }
  const removed = previous.filter((route) => !currentSet.has(route));
  const added = current.filter((route) => !previous.includes(route));
  const unexplained = removed.filter((route) => !explainedSet.has(route));
  const staleExplanations = explained.filter((route) => currentSet.has(route));
  return {
    ok: unexplained.length === 0 && staleExplanations.length === 0,
    baseline: false,
    added,
    removed,
    unexplained,
    staleExplanations,
  };
}

export function collectRoutes(distDir) {
  const routes = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        const rel = relative(distDir, full)
          .replace(/index\.html$/, '')
          .replace(/\.html$/, '')
          .replace(/\/$/, '');
        routes.push(`/${rel}`.replace(/^\/$/, '/'));
      }
    }
  };
  walk(distDir);
  return routes.sort();
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

export function previousPhase(auditsDir, phase) {
  if (!existsSync(auditsDir)) return null;
  const numbered = phaseOrder(
    readdirSync(auditsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== phase && NUMBERED_PHASE.test(entry.name))
      .map((entry) => entry.name)
  ).filter((name) => existsSync(join(auditsDir, name, 'routes.json')));
  return numbered.length > 0 ? numbered[numbered.length - 1] : null;
}

async function main(distDir, rawPhase) {
  const current = collectRoutes(resolve(distDir));
  const phase = `phase-${resolvePhase(rawPhase)}`;
  const phaseDir = join(AUDITS_DIR, phase);
  mkdirSync(phaseDir, { recursive: true });

  const earlier = previousPhase(AUDITS_DIR, phase);
  const previous = earlier ? readJson(join(AUDITS_DIR, earlier, 'routes.json'), null) : null;
  const explained = readJson(join(phaseDir, 'routes-removed.json'), []);

  const result = diffRoutes({ previous, current, explained });
  writeFileSync(join(phaseDir, 'routes.json'), `${JSON.stringify(current, null, 2)}\n`);

  const label = earlier
    ? `${earlier} -> ${phase}`
    : `${phase} baseline (no earlier numbered phase under audits/ carries a routes.json)`;
  console.log(`ROUTES ${label}: ${current.length} routes, +${result.added.length} -${result.removed.length}`);
  for (const route of result.unexplained) {
    console.error(`ROUTES UNEXPLAINED REMOVAL ${route} — add it to audits/${phase}/routes-removed.json with a reason`);
  }
  for (const route of result.staleExplanations) {
    console.error(`ROUTES STALE EXPLANATION ${route} — still built, remove it from routes-removed.json`);
  }
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist', process.env.GATE_PHASE || 'local');
}
