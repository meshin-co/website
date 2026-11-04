import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { newLedger, writeLedger } from './autowriter-ledger.mjs';
import { REQUIRED_ENV } from './deploy.mjs';
import { headFingerprint } from './lh-evidence.mjs';
import { ledgerWithDebt } from './measurement-debt.mjs';
import { recordPath } from './record-layout.mjs';

const SITE_FILES = ['package.json', 'engine.config.json'];
const ENTRY_SLUG = 'zz-specimen-entry';
const MERGED_AT = '2026-11-04T03:43:07.953Z';
const MEASURED_AT = '2026-11-04T02:51:16.487Z';
const WRANGLER = [
  '#!/bin/sh',
  'echo "\u2728 Deployment complete! Take a peek over at https://abc123.specimen.pages.dev"',
].join('\n');

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=specimen', '-c', 'user.email=specimen@example.invalid', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const put = async (path, text) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
};

const commitAll = (root, message) => {
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', message);
};

export async function pressScene({ copySite, work }) {
  const root = join(work, 'press-scene');
  const site = join(root, 'site');
  await rm(root, { recursive: true, force: true });
  await cp(join(copySite, 'scripts'), join(site, 'scripts'), { recursive: true });
  for (const name of SITE_FILES) await cp(join(copySite, name), join(site, name));
  await put(join(site, 'dist', 'index.html'), '<!DOCTYPE html><html></html>');
  await put(join(site, 'node_modules', '.bin', 'wrangler'), WRANGLER);
  await chmod(join(site, 'node_modules', '.bin', 'wrangler'), 0o755);
  await put(join(site, 'src', 'pages', 'index.astro'), '<h1>home</h1>\n');
  await put(join(root, 'audits', 'routes.json'), '["/"]');
  await put(join(root, '.gitignore'), 'site/dist/\nsite/node_modules/\n');
  git(work, 'init', '-q', root);
  git(root, 'config', 'maintenance.auto', 'false');
  commitAll(root, 'the tree the run measured');

  const fingerprint = await headFingerprint(root);
  await put(
    join(root, 'audits', 'lighthouse-green.json'),
    `${JSON.stringify({ fingerprint, recordedAt: MEASURED_AT, phase: 'zz-specimen' }, null, 2)}\n`
  );
  commitAll(root, 'record the run');
  return site;
}

async function mergeAnEntry(site) {
  const root = join(site, '..');
  if (git(root, 'rev-parse', '--show-toplevel') !== realpathSync(root))
    throw new Error(`${root} is not the root of its own repository`);
  const measured = git(root, 'rev-parse', 'HEAD');
  await put(join(site, 'src', 'data', 'post', `${ENTRY_SLUG}.md`), '---\ntitle: A specimen entry\n---\n\nBody.\n');
  commitAll(root, 'feat(autowriter): write an entry no run measured');
  const debt = ledgerWithDebt(newLedger({ slug: ENTRY_SLUG, runId: '1', pullRequest: 1 }), {
    mergedCommit: git(root, 'rev-parse', 'HEAD'),
    fingerprint: await headFingerprint(root),
    now: new Date(MERGED_AT),
  });
  writeLedger(join(root, recordPath('ledger', ENTRY_SLUG, MERGED_AT)), debt);
  commitAll(root, 'chore(autowriter): record the measurement debt');
  return async () => {
    git(root, 'reset', '-q', '--hard', measured);
    git(root, 'clean', '-fdq');
  };
}

export const pressSpecimens = () => ({
  pressWarnsOfUnmeasuredTree: {
    gate: 'deploy',
    warns: true,
    env: Object.fromEntries(REQUIRED_ENV.map((name) => [name, 'specimen'])),
    token: 'was never measured by Lighthouse',
    scene: pressScene,
    plant: mergeAnEntry,
  },
});
