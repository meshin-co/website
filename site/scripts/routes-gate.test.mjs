import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { collectRoutes, diffRoutes, phaseOrder, previousPhase } from './routes-gate.mjs';

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

test('no previous phase means nothing to prove', () => {
  const result = diffRoutes({ previous: null, current: ['/'], explained: [] });
  assert.equal(result.ok, true);
  assert.equal(result.baseline, true);
});

test('phases sort by numeric position, not string order', () => {
  assert.deepEqual(phaseOrder(['phase-10', 'phase-2', 'phase-4.5', 'phase-4']), [
    'phase-2',
    'phase-4',
    'phase-4.5',
    'phase-10',
  ]);
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

test('previousPhase finds the latest numbered phase and ignores a same-named run directory', () => {
  const auditsDir = mkdtempSync(join(tmpdir(), 'routes-gate-audits-'));
  mkdirSync(join(auditsDir, 'phase-1'));
  writeFileSync(join(auditsDir, 'phase-1', 'routes.json'), '["/"]');
  mkdirSync(join(auditsDir, 'phase-2'));
  writeFileSync(join(auditsDir, 'phase-2', 'routes.json'), '["/", "/blog"]');
  mkdirSync(join(auditsDir, 'phase-ci'));
  assert.equal(previousPhase(auditsDir, 'phase-ci'), 'phase-2');
});

test("previousPhase never treats the run's own directory as its baseline", () => {
  const auditsDir = mkdtempSync(join(tmpdir(), 'routes-gate-audits-'));
  mkdirSync(join(auditsDir, 'phase-3'));
  writeFileSync(join(auditsDir, 'phase-3', 'routes.json'), '["/"]');
  assert.equal(previousPhase(auditsDir, 'phase-3'), null);
});

test('previousPhase ignores non-numbered directories like phase-local and phase-ci as history', () => {
  const auditsDir = mkdtempSync(join(tmpdir(), 'routes-gate-audits-'));
  mkdirSync(join(auditsDir, 'phase-local'));
  writeFileSync(join(auditsDir, 'phase-local', 'routes.json'), '["/", "/a", "/b", "/c"]');
  assert.equal(previousPhase(auditsDir, 'phase-ci'), null);
});

test('a local run with real numbered history now fails when almost every route disappears', () => {
  const root = mkdtempSync(join(tmpdir(), 'routes-gate-run-'));
  const siteDir = join(root, 'site');
  const auditsDir = join(root, 'audits');
  mkdirSync(siteDir, { recursive: true });
  mkdirSync(join(auditsDir, 'phase-1'), { recursive: true });
  const history = ['/', '/blog', '/about', '/faq', '/speaking'];
  writeFileSync(join(auditsDir, 'phase-1', 'routes.json'), `${JSON.stringify(history)}\n`);

  const distDir = join(root, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), '<html></html>');

  assert.throws(
    () =>
      execFileSync('node', [join(import.meta.dirname, 'routes-gate.mjs'), distDir], {
        cwd: siteDir,
        stdio: 'pipe',
      }),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stdout.toString(), /-4/);
      return true;
    }
  );
});
