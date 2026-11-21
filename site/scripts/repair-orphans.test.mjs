import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';

import { apiAnswering, json } from './fixtures/github-fake.mjs';
import { SCORECARD, builtSiteWithAStrandedPost, writeTree } from './fixtures/orphan-scene.mjs';
import { claim, cleanup, world } from './fixtures/repair-world.mjs';
import { buildZip } from './fixtures/zip-writer.mjs';
import { readFindings } from './repair-findings.mjs';
import * as kinds from './repair-kinds.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { repairRun } from './repair-run.mjs';

const SITE = resolve(import.meta.dirname, '..');
const RUN = { id: 44671851766, attempt: 1 };
const LISTING = `actions/runs/${RUN.id}/artifacts?per_page=100`;
const DOWNLOAD = 'actions/artifacts/2/zip';
const DIST = { id: 1, name: 'dist', expired: false };
const FINDINGS = { id: 2, name: 'gate-findings-1', expired: false };

const scratch = [];
after(() => {
  cleanup();
  scratch.forEach((path) => rmSync(path, { recursive: true, force: true }));
});

function whatTheJobUploads(files) {
  const tree = writeTree(files);
  const findings = mkdtempSync(join(tmpdir(), 'repair-orphans-'));
  scratch.push(tree.root, findings);
  const env = { ...process.env, GATE_FINDINGS_DIR: findings };
  spawnSync(process.execPath, ['scripts/orphan-gate.mjs', tree.root], { cwd: SITE, env, encoding: 'utf8' });
  return readdirSync(findings).map((name) => ({ name, data: readFileSync(join(findings, name)) }));
}

function theRunAsGitHubHoldsIt(uploaded) {
  const artifacts = uploaded.length === 0 ? [DIST] : [DIST, FINDINGS];
  return apiAnswering(({ path }) => {
    if (path === LISTING) return json({ total_count: artifacts.length, artifacts });
    if (path === DOWNLOAD) return new Response(buildZip(uploaded));
    throw new Error(`unexpected request ${path}`);
  });
}

async function repairAfter(files) {
  const { api, calls } = theRunAsGitHubHoldsIt(whatTheJobUploads(files));
  const { io, adapter } = world({ kinds });
  const opened = await io.open();
  Object.assign(io, {
    api,
    findingsOf: readFindings,
    judgedFacts: async () => ({}),
    open: async () => ({ ...opened, run: RUN }),
  });
  try {
    await repairRun(io);
  } catch (error) {
    return { error, adapter, requested: calls.map(({ path }) => path) };
  }
  return assert.fail('expected the repair to stop');
}

const SPECIMENS = {
  'an older article the new one pushed out of the related blocks (pull request 153)': SCORECARD,
  'the entry under repair, which never entered a related block (pull requests 137 and 145)': claim.slug,
};

for (const [shape, slug] of Object.entries(SPECIMENS)) {
  test(`a run whose gate:orphans failed on ${shape} stops as unrepairable and names why`, async () => {
    const { error, adapter, requested } = await repairAfter(builtSiteWithAStrandedPost(slug));

    assert.ok(error instanceof RepairStop, error.stack);
    assert.equal(error.outcome, 'unrepairable');
    assert.match(error.message, new RegExp(`gate:orphans chrome-only \\(not-prose\\) on /blog/${slug}: `));
    assert.match(error.message, /needs a sentence on another page that links to it/);
    assert.match(error.message, /outside the entry/);
    assert.doesNotMatch(error.message, /no usable artifact/);
    assert.deepEqual(requested, [LISTING, DOWNLOAD]);
    assert.equal(adapter.requests.length, 0);
    assert.equal(adapter.state.verified, 0);
  });
}
