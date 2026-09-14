import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const AUDITS_DIR = resolve(process.cwd(), '..', 'audits');

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

function collectRoutes(distDir) {
  const routes = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === 'index.html') {
        const rel = relative(distDir, full)
          .replace(/index\.html$/, '')
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

function previousPhase(phase) {
  if (!existsSync(AUDITS_DIR)) return null;
  const phases = phaseOrder(
    readdirSync(AUDITS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('phase-'))
      .map((entry) => entry.name)
  );
  const index = phases.indexOf(phase);
  const earlier = (index === -1 ? phases : phases.slice(0, index)).filter((name) =>
    existsSync(join(AUDITS_DIR, name, 'routes.json'))
  );
  return earlier.length > 0 ? earlier[earlier.length - 1] : null;
}

async function main(distDir, phase) {
  const current = collectRoutes(resolve(distDir));
  const phaseDir = join(AUDITS_DIR, phase);
  mkdirSync(phaseDir, { recursive: true });

  const earlier = previousPhase(phase);
  const previous = earlier ? readJson(join(AUDITS_DIR, earlier, 'routes.json'), null) : null;
  const explained = readJson(join(phaseDir, 'routes-removed.json'), []);

  const result = diffRoutes({ previous, current, explained });
  writeFileSync(join(phaseDir, 'routes.json'), `${JSON.stringify(current, null, 2)}\n`);

  const label = earlier ? `${earlier} -> ${phase}` : `${phase} baseline`;
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
  await main(process.argv[2] ?? 'dist', process.env.GATE_PHASE ?? 'phase-local');
}
