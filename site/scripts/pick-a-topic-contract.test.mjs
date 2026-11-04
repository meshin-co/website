import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import './fixtures/no-network.mjs';
import { runCli } from './pick-a-topic.mjs';
import { recordPath } from './record-layout.mjs';
import { openRun } from './write-open.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const INPUTS = ['docs/SEMANTIC-CORE.md', 'site/src/config.yaml', 'site/content-facts.json'];
const POSTS = 'site/src/data/post';
const FROZEN_REPORT = 'site/scripts/fixtures/search-demand-2026-11-01.md';

function skeleton() {
  const root = mkdtempSync(join(tmpdir(), 'pick-contract-'));
  for (const file of INPUTS) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(REPO, file), join(root, file));
  }
  mkdirSync(join(root, 'audits'), { recursive: true });
  cpSync(join(REPO, POSTS), join(root, POSTS), { recursive: true });
  cpSync(join(REPO, FROZEN_REPORT), join(root, 'audits/search-demand.md'));
  return root;
}

test('the decision file the selection writes is one the writer opens without a refusal', async () => {
  const root = skeleton();
  try {
    const output = join(root, 'decision.json');
    const failures = [];
    const argv = ['--write', '--output', output, '--now', '2026-11-02T04:00:00Z', '--run-id', 'contract-1'];
    const exit = await runCli(argv, {
      repoRoot: root,
      env: {},
      stdout: () => {},
      stderr: (line) => failures.push(line),
    });
    assert.equal(exit, 0, failures.join('\n'));
    const decision = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(decision.decision, 'write', 'the frozen report must still give a write decision from the live core');
    const run = openRun({ repoRoot: root, decision });
    assert.equal(run.entries[0].anchor, true);
    assert.equal(decision.entries[0].claim.format, 'article');
    const { slug, claimedAt } = decision.entries[0].claim;
    assert.equal(decision.ledgerPath, recordPath('ledger', slug, claimedAt));
    assert.equal(run.ledgerPath, decision.ledgerPath);
    assert.ok(existsSync(join(root, decision.ledgerPath)), `${decision.ledgerPath} was not written`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
