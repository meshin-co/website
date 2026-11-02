import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import './fixtures/no-network.mjs';
import { runCli } from './pick-a-topic.mjs';
import { openRun } from './write-open.mjs';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const INPUTS = ['docs/SEMANTIC-CORE.md', 'site/src/config.yaml'];
const FROZEN_REPORT = 'site/scripts/fixtures/search-demand-2026-11-01.md';

function skeleton() {
  const root = mkdtempSync(join(tmpdir(), 'pick-contract-'));
  for (const file of INPUTS) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(REPO, file), join(root, file));
  }
  mkdirSync(join(root, 'audits'), { recursive: true });
  cpSync(join(REPO, FROZEN_REPORT), join(root, 'audits/search-demand.md'));
  return root;
}

test('the decision file the selection writes is one the writer opens without a refusal', () => {
  const root = skeleton();
  try {
    const output = join(root, 'decision.json');
    const failures = [];
    const exit = runCli(['--write', '--output', output, '--now', '2026-11-02T04:00:00Z', '--run-id', 'contract-1'], {
      repoRoot: root,
      env: {},
      out: () => {},
      err: (line) => failures.push(line),
    });
    assert.equal(exit, 0, failures.join('\n'));
    const decision = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(decision.decision, 'write', 'the frozen report must still give a write decision from the live core');
    const run = openRun({ repoRoot: root, decision });
    assert.equal(run.entries[0].anchor, true);
    assert.equal(decision.entries[0].claim.format, 'article');
    assert.equal(decision.ledgerPath, 'audits/autowriter/' + decision.entries[0].claim.slug + '.json');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
