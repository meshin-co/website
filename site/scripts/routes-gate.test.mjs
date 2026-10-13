import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { collectRoutes, diffRoutes } from './routes-gate.mjs';

test('a route that disappears without an explanation fails the gate', () => {
  const result = diffRoutes({ previous: ['/', '/blog'], current: ['/'], explained: [] });
  assert.deepEqual(result.unexplained, ['/blog']);
  assert.equal(result.ok, false);
});

test('a disappearance listed as explained passes', () => {
  const result = diffRoutes({ previous: ['/', '/speaking'], current: ['/'], explained: ['/speaking'] });
  assert.deepEqual(result.unexplained, []);
  assert.equal(result.ok, true);
});

test('an explanation for a route that still exists is rejected as stale', () => {
  const result = diffRoutes({ previous: ['/', '/blog'], current: ['/', '/blog'], explained: ['/blog'] });
  assert.deepEqual(result.staleExplanations, ['/blog']);
  assert.equal(result.ok, false);
});

test('growth alone passes', () => {
  const result = diffRoutes({ previous: ['/'], current: ['/', '/faq'], explained: [] });
  assert.deepEqual(result.added, ['/faq']);
  assert.equal(result.ok, true);
});

test('a page built as a bare .html file is a route, because /404 was invisible to the shrink gate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'routes-gate-'));
  mkdirSync(join(dir, 'blog'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<html></html>');
  writeFileSync(join(dir, 'about.html'), '<html></html>');
  writeFileSync(join(dir, '404.html'), '<html></html>');
  writeFileSync(join(dir, 'blog', 'reindex.html'), '<html></html>');
  assert.deepEqual(collectRoutes(dir).sort(), ['/', '/404', '/about', '/blog/reindex']);
});

const asJson = (routes) => `${JSON.stringify(routes, null, 2)}\n`;

function checkout({ ledger, explained, built, phases = {} }) {
  const root = mkdtempSync(join(tmpdir(), 'routes-gate-run-'));
  const audits = join(root, 'audits');
  mkdirSync(audits);
  if (ledger) writeFileSync(join(audits, 'routes.json'), asJson(ledger));
  if (explained) writeFileSync(join(audits, 'routes-removed.json'), asJson(explained));
  for (const [phase, routes] of Object.entries(phases)) {
    mkdirSync(join(audits, phase));
    writeFileSync(join(audits, phase, 'routes.json'), asJson(routes));
  }
  for (const route of built) {
    const page = join(root, 'site', 'dist', route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    mkdirSync(dirname(page), { recursive: true });
    writeFileSync(page, '<html></html>');
  }
  return { audits, site: join(root, 'site') };
}

const gate = ({ site }, ...flags) =>
  spawnSync('node', [join(import.meta.dirname, 'routes-gate.mjs'), 'dist', ...flags], {
    cwd: site,
    encoding: 'utf8',
    env: { ...process.env, GATE_PHASE: 'ci' },
  });

test('the gate fails when the build lost routes the ledger lists, and names each one', () => {
  const run = gate(checkout({ ledger: ['/', '/about', '/blog', '/faq', '/speaking'], built: ['/'] }));
  assert.equal(run.status, 1);
  assert.match(run.stdout, /-4/);
  assert.match(run.stderr, /ROUTES UNEXPLAINED REMOVAL \/speaking — add it to audits\/routes-removed\.json/);
});

test('the gate never writes, so a removal fails on every run and no phase folder appears', () => {
  const repo = checkout({ ledger: ['/', '/blog'], built: ['/'] });
  assert.equal(gate(repo).status, 1);
  assert.equal(gate(repo).status, 1);
  assert.equal(readFileSync(join(repo.audits, 'routes.json'), 'utf8'), asJson(['/', '/blog']));
  assert.deepEqual(readdirSync(repo.audits), ['routes.json']);
});

test('a numbered phase folder is no longer a baseline', () => {
  const run = gate(checkout({ ledger: ['/'], built: ['/'], phases: { 'phase-9': ['/', '/retired'] } }));
  assert.equal(run.status, 0);
});

test('a missing ledger fails instead of passing as a first baseline', () => {
  const run = gate(checkout({ built: ['/'] }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /audits\/routes\.json/);
  assert.match(run.stderr, /npm run assets:routes/);
});

test('removals are explained in audits/routes-removed.json, and only the unexplained one is named', () => {
  const run = gate(checkout({ ledger: ['/', '/speaking', '/talks'], explained: ['/speaking'], built: ['/'] }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ROUTES UNEXPLAINED REMOVAL \/talks/);
  assert.doesNotMatch(run.stderr, /\/speaking/);
});

test('--write rewrites the ledger from the build, and the gate then passes against it', () => {
  const repo = checkout({ ledger: ['/', '/retired'], built: ['/', '/new'] });
  assert.equal(gate(repo, '--write').status, 0);
  assert.equal(readFileSync(join(repo.audits, 'routes.json'), 'utf8'), asJson(['/', '/new']));
  assert.equal(gate(repo).status, 0);
});
