import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { collectReports, resolvePhase, targetDir } from './collect-reports.mjs';

test('a phase already carrying its prefix is not prefixed twice', () => {
  assert.equal(resolvePhase('phase-4.5'), '4.5');
  assert.equal(resolvePhase('phase-2'), '2');
});

test('a bare phase name is accepted unchanged', () => {
  assert.equal(resolvePhase('4.5'), '4.5');
  assert.equal(resolvePhase('ci'), 'ci');
});

test('a missing phase is refused rather than writing to an unnamed directory', () => {
  assert.throws(() => resolvePhase(undefined), /GATE_PHASE/);
});

test('an unsharded run writes the plain form-factor directory', () => {
  assert.equal(targetDir('mobile', { GATE_PHASE: 'ci' }), '../audits/phase-ci/lh-mobile');
});

test('a sharded run writes its own directory so parallel shards cannot wipe each other', () => {
  const env = { GATE_PHASE: 'ci', LH_SHARD_INDEX: '3', LH_SHARD_TOTAL: '4' };
  assert.equal(targetDir('desktop', env), '../audits/phase-ci/lh-desktop/shard-3');
});

async function fixtureSite() {
  const root = await mkdtemp(join(tmpdir(), 'collect-reports-'));
  await mkdir(join(root, 'site'), { recursive: true });
  return { site: join(root, 'site'), audits: join(root, 'audits') };
}

async function collectIn(site, formFactor, env) {
  const previous = process.cwd();
  process.chdir(site);
  try {
    return await collectReports(formFactor, env);
  } finally {
    process.chdir(previous);
  }
}

const SHARD_TWO = { GATE_PHASE: 'ci', LH_SHARD_INDEX: '2', LH_SHARD_TOTAL: '4' };

test('a run that failed its assertions still has every report collected, and only the reports', async () => {
  const { site, audits } = await fixtureSite();
  await mkdir(join(site, '.lighthouseci'));
  for (const name of ['lhr-1.json', 'lhr-2.json', 'lhr-1.html', 'manifest.json', 'assertion-results.json']) {
    await writeFile(join(site, '.lighthouseci', name), '{}');
  }

  const { count } = await collectIn(site, 'mobile', SHARD_TWO);

  assert.equal(count, 2);
  const collected = await readdir(join(audits, 'phase-ci', 'lh-mobile', 'shard-2'));
  assert.deepEqual(collected.sort(), ['lhr-1.json', 'lhr-2.json']);
});

test('a run that died before writing any report collects nothing and says so, rather than crashing on the missing directory', async () => {
  const { site, audits } = await fixtureSite();

  const { count } = await collectIn(site, 'desktop', SHARD_TWO);

  assert.equal(count, 0);
  assert.deepEqual(await readdir(join(audits, 'phase-ci', 'lh-desktop', 'shard-2')), []);
});

test('a stale target from an earlier run is cleared, so old reports are never counted as runs of this one', async () => {
  const { site, audits } = await fixtureSite();
  const target = join(audits, 'phase-ci', 'lh-mobile', 'shard-2');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'lhr-stale.json'), '{}');

  await collectIn(site, 'mobile', SHARD_TWO);

  assert.deepEqual(await readdir(target), []);
});

test('a form factor that is neither mobile nor desktop is refused before anything is written', async () => {
  const { site, audits } = await fixtureSite();

  await assert.rejects(() => collectIn(site, 'tablet', SHARD_TWO), /expected mobile or desktop, got tablet/);
  await assert.rejects(() => readdir(audits), { code: 'ENOENT' });
});

test('each shard collects from its own lhci output, so parallel shards cannot read each other', async () => {
  const { sourceDir } = await import('./collect-reports.mjs');

  assert.equal(sourceDir({ LH_OUTPUT_DIR: '.lighthouseci-mobile-2' }), '.lighthouseci-mobile-2');
  assert.equal(sourceDir({}), '.lighthouseci');
});

test('a shard running in its own directory still files reports into the repository audits', async () => {
  const { auditRoot } = await import('./collect-reports.mjs');

  assert.equal(auditRoot({ AUDIT_ROOT: '/repo' }), '/repo');
  assert.equal(auditRoot({}), '..');
  assert.match(
    targetDir('mobile', { GATE_PHASE: '13-free', AUDIT_ROOT: '/repo', LH_SHARD_INDEX: '2', LH_SHARD_TOTAL: '4' }),
    /^\/repo\/audits\/phase-13-free\/lh-mobile\/shard-2$/
  );
});
