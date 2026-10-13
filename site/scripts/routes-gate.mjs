import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const AUDITS_DIR = resolve(process.cwd(), '..', 'audits');
const LEDGER = join(AUDITS_DIR, 'routes.json');
const EXPLAINED = join(AUDITS_DIR, 'routes-removed.json');

export function diffRoutes({ previous, current, explained }) {
  const currentSet = new Set(current);
  const explainedSet = new Set(explained);
  const removed = previous.filter((route) => !currentSet.has(route));
  const added = current.filter((route) => !previous.includes(route));
  const unexplained = removed.filter((route) => !explainedSet.has(route));
  const staleExplanations = explained.filter((route) => currentSet.has(route));
  return {
    ok: unexplained.length === 0 && staleExplanations.length === 0,
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
        const rel = relative(distDir, full);
        routes.push(rel === 'index.html' ? '/' : `/${rel.replace(/\.html$/, '')}`);
      }
    }
  };
  walk(distDir);
  return routes.sort();
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

function writeLedger(current) {
  writeFileSync(LEDGER, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`ROUTES wrote audits/routes.json: ${current.length} routes`);
}

function checkLedger(current, distDir) {
  const previous = readJson(LEDGER, null);
  if (!previous) {
    console.error('ROUTES NO LEDGER audits/routes.json — build, then run npm run assets:routes and commit the file');
    process.exitCode = 1;
    return;
  }
  const result = diffRoutes({ previous, current, explained: readJson(EXPLAINED, []) });
  console.log(
    `ROUTES audits/routes.json -> ${distDir}: ${current.length} routes, +${result.added.length} -${result.removed.length}`
  );
  for (const route of result.unexplained) {
    console.error(
      `ROUTES UNEXPLAINED REMOVAL ${route} — add it to audits/routes-removed.json if the removal is deliberate`
    );
  }
  for (const route of result.staleExplanations) {
    console.error(`ROUTES STALE EXPLANATION ${route} — still built, remove it from audits/routes-removed.json`);
  }
  if (!result.ok) process.exitCode = 1;
}

function main(args) {
  const distDir = args.find((arg) => arg !== '--write') ?? 'dist';
  const current = collectRoutes(resolve(distDir));
  if (args.includes('--write')) writeLedger(current);
  else checkLedger(current, distDir);
}

if (import.meta.filename === process.argv[1]) main(process.argv.slice(2));
