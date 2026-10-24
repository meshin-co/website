import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stampMeasuredTree } from './lh-evidence.mjs';
import { addFile, proveWithSpecimen } from './mutation-specimens.mjs';

const PHASE = 'zz-specimen';
const EDITED_AFTER_THE_RUN = 'site/src/zz-specimen.astro';
const SITE_FILES = ['package.json', 'budgets.json', 'lighthouserc.cjs'];
const RUNS_PER_ROUTE = 3;

const GATE_ROUTES = { routes: ['/'], measured: [{ route: '/', js: 1, css: 1, page: 1, fonts: 1 }], overBudget: [] };
const GREEN_REPORT = {
  finalUrl: 'http://127.0.0.1:4330/',
  categories: Object.fromEntries(
    ['performance', 'accessibility', 'best-practices', 'seo'].map((category) => [category, { score: 1 }])
  ),
  audits: { 'largest-contentful-paint': { numericValue: 900 }, 'cumulative-layout-shift': { numericValue: 0 } },
};

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=specimen', '-c', 'user.email=specimen@example.invalid', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function writeMeasuredReports(root) {
  for (const factor of ['mobile', 'desktop']) {
    const directory = join(root, 'audits', `phase-${PHASE}`, `lh-${factor}`);
    await mkdir(directory, { recursive: true });
    for (let run = 0; run < RUNS_PER_ROUTE; run += 1)
      await writeFile(join(directory, `lhr-${run}.json`), JSON.stringify(GREEN_REPORT));
  }
}

export async function recordScene({ copySite, work }) {
  const root = join(work, 'lh-record-scene');
  const site = join(root, 'site');
  await rm(root, { recursive: true, force: true });
  await cp(join(copySite, 'scripts'), join(site, 'scripts'), { recursive: true });
  for (const name of SITE_FILES) await cp(join(copySite, name), join(site, name));
  await mkdir(join(site, 'dist'), { recursive: true });
  await writeFile(join(site, 'dist', 'index.html'), '<html><body>home</body></html>');
  await writeFile(join(site, 'dist', 'gate-routes.json'), JSON.stringify(GATE_ROUTES));
  await writeMeasuredReports(root);
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'the tree the run measured');

  const stamp = await stampMeasuredTree({ repo: root, auditDir: join(root, 'audits', `phase-${PHASE}`) });
  if (!stamp.stamped) throw new Error(`the scene could not be stamped: ${stamp.reason}`);
  return { root, site };
}

export const treeMovedAfterTheRun = ({ root }) => ({
  gate: 'lh:record',
  env: { GATE_PHASE: PHASE },
  token: 'was measured from tree',
  plant: async () => {
    const measured = git(root, 'rev-parse', 'HEAD');
    const unstage = await addFile(join(root, EDITED_AFTER_THE_RUN), '<p>an edit committed after the run</p>\n');
    git(root, 'commit', '-q', '-m', 'an edit committed after the run');
    return async () => {
      git(root, 'update-ref', 'HEAD', measured);
      await unstage();
    };
  },
});

export async function proveRecordRefusal({ copySite, work, run }) {
  const scene = await recordScene({ copySite, work });
  return proveWithSpecimen(treeMovedAfterTheRun(scene), { copySite: scene.site, run });
}
