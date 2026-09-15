import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { parse } from 'yaml';

import { applyDispositions, digestFor } from './dispositions.mjs';
import {
  collectionRows,
  componentRows,
  constantRows,
  mergeRows,
  renderedRows,
  deadCopy,
  untraceableText,
} from './editorial-inventory.mjs';

const SITE = resolve(process.argv[2] ?? '.');
const LEDGER = resolve(SITE, '../audits/phase-4.7/inventory.json');
const DISPOSITIONS = resolve(SITE, '../audits/phase-4.7/dispositions');
const FINDINGS = resolve(SITE, '../audits/phase-4.7/findings.json');

const walk = (dir, test) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return walk(path, test);
        return test(entry.name) ? [path] : [];
      })
    : [];

const frontmatterOf = (raw) => {
  const block = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!block) return { frontmatter: {}, body: raw };
  try {
    return { frontmatter: parse(block[1]) ?? {}, body: block[2] };
  } catch {
    return { frontmatter: {}, body: block[2] };
  }
};

export function mergeLedger(fresh, recorded) {
  const byText = new Map(recorded.map((entry) => [entry.text, entry]));
  return fresh.map((entry) => {
    const previous = byText.get(entry.text);
    return previous
      ? { ...entry, status: previous.status, ...(previous.reason ? { reason: previous.reason } : {}) }
      : entry;
  });
}

export function ledgerFindings({ rows, untraceable = [], dead = [], stale = [], unmatched = [] }) {
  const pending = rows.filter(
    (entry) =>
      !['rewritten', 'verified', 'owner-blocked'].includes(entry.status) ||
      (entry.status === 'owner-blocked' && !entry.reason)
  );
  return [
    ...pending.map((entry) => `unreviewed: ${entry.usedIn[0]} — ${entry.text.slice(0, 60)}`),
    ...untraceable.map((entry) => `ships but traces to no source row: ${entry.route} — ${entry.text.slice(0, 60)}`),
    ...dead.map((entry) => `source copy no page ships: ${entry.usedIn[0]} — ${entry.text.slice(0, 60)}`),
    ...stale.map((entry) => `stale disposition: ${entry.target} — ${entry.why}`),
    ...unmatched.map((entry) => `disposition names a target with no rows: ${entry.target}`),
  ];
}

export function readDispositions(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));
}

function buildLedger(dist) {
  const entries = walk(join(SITE, 'src/data'), (name) => name.endsWith('.md')).map((file) => {
    const raw = readFileSync(file, 'utf8');
    return { file: relative(SITE, file), ...frontmatterOf(raw) };
  });
  const components = [
    ...walk(join(SITE, 'src/components'), (name) => name.endsWith('.astro')),
    ...walk(join(SITE, 'src/layouts'), (name) => name.endsWith('.astro')),
    ...walk(join(SITE, 'src/pages'), (name) => name.endsWith('.astro')),
  ].map((file) => ({ file: relative(SITE, file), source: readFileSync(file, 'utf8') }));
  const constants = [
    ...walk(join(SITE, 'src/data'), (name) => /\.(ts|mjs)$/.test(name)),
    ...walk(join(SITE, 'src/utils'), (name) => /\.(ts|mjs)$/.test(name)),
    ...walk(join(SITE, 'src/pages'), (name) => name.endsWith('.astro')),
    ...walk(join(SITE, 'src/components'), (name) => name.endsWith('.astro')),
  ].map((file) => ({ file: relative(SITE, file), source: readFileSync(file, 'utf8') }));

  const routes = JSON.parse(readFileSync(join(dist, 'gate-routes.json'), 'utf8')).routes;
  const pages = routes.map((route) => {
    const nested = join(dist, route === '/' ? 'index.html' : join(route.slice(1), 'index.html'));
    const flat = join(dist, `${route.slice(1)}.html`);
    return { route, html: readFileSync(existsSync(nested) ? nested : flat, 'utf8') };
  });

  const machineSurfaces = walk(dist, (name) => /\.(txt|md|json|xml)$/.test(name))
    .filter((file) => !file.endsWith('gate-routes.json'))
    .map((file) => ({ route: `/${relative(dist, file)}`, html: readFileSync(file, 'utf8') }));

  const rawSource = [...collectionRows(entries), ...componentRows(components), ...constantRows(constants)];
  const sourceRows = mergeRows(rawSource);
  const rows = mergeRows([...rawSource, ...renderedRows(pages)]);
  return {
    rows,
    untraceable: untraceableText(pages, sourceRows),
    dead: deadCopy(sourceRows, [...pages, ...machineSurfaces]),
    pages: pages.length,
  };
}

function main(dist) {
  const built = buildLedger(dist);
  const dispositions = readDispositions(DISPOSITIONS);
  const { rows, stale, unmatched } = applyDispositions(built.rows, dispositions);
  const findings = ledgerFindings({ rows, untraceable: built.untraceable, dead: built.dead, stale, unmatched });

  mkdirSync(resolve(LEDGER, '..'), { recursive: true });
  const counts = {
    untraceable: built.untraceable.length,
    dead: built.dead.length,
    stale: stale.length,
    unmatched: unmatched.length,
  };
  writeFileSync(
    LEDGER,
    `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), counts, rows }, null, 2)}\n`
  );

  writeFileSync(
    FINDINGS,
    `${JSON.stringify({ untraceable: built.untraceable, dead: built.dead, stale, unmatched }, null, 2)}\n`
  );

  const byStatus = rows.reduce((totals, entry) => ({ ...totals, [entry.status]: (totals[entry.status] ?? 0) + 1 }), {});
  console.log(`editorial ledger: ${rows.length} rows across ${built.pages} routes`, byStatus);
  console.log(`shipped text tracing to no source row: ${built.untraceable.length}`);
  console.log(`source copy no page ships: ${built.dead.length}`);
  console.log(`dispositions: ${dispositions.length} declared, ${stale.length} stale, ${unmatched.length} unmatched`);
  if (findings.length > 0) {
    console.log(`findings: ${findings.length}`);
    const sample = (label, entries, format) => {
      if (entries.length === 0) return;
      console.log(`  ${label} (${entries.length}):`);
      for (const entry of entries.slice(0, 4)) console.log(`    ${format(entry)}`);
    };
    sample(
      'shipped text tracing to no source row',
      built.untraceable,
      (entry) => `${entry.route} | ${entry.text.slice(0, 70)}`
    );
    sample('source copy no page ships', built.dead, (entry) => `${entry.usedIn[0]} | ${entry.text.slice(0, 60)}`);
    sample('stale dispositions', stale, (entry) => `${entry.target} | ${entry.why}`);
    process.exitCode = 1;
  }
}

export function sealDispositions(dist) {
  const built = buildLedger(dist);
  let sealed = 0;
  for (const name of existsSync(DISPOSITIONS) ? readdirSync(DISPOSITIONS).filter((f) => f.endsWith('.json')) : []) {
    const file = join(DISPOSITIONS, name);
    const entries = JSON.parse(readFileSync(file, 'utf8')).map((entry) => {
      const digest = digestFor(built.rows, entry.target);
      if (entry.digest !== digest) sealed += 1;
      return { ...entry, digest };
    });
    writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`);
  }
  console.log(`sealed ${sealed} dispositions against the current text`);
}

if (import.meta.filename === process.argv[1]) {
  const dist = resolve(SITE, process.argv[3] ?? 'dist');
  if (process.argv.includes('--seal')) sealDispositions(dist);
  else main(dist);
}
