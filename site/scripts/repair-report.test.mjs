import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { historyReport } from './autowriter-refusal-rules.mjs';
import { refusalFor } from './autowriter-refusals.mjs';
import { spendReportFindings } from './autowriter-spend-rules.mjs';
import { commitRepair } from './entry-commit.mjs';
import { committedFiles } from './fixtures/commit-scene.mjs';
import { gitRun } from './fixtures/git-run.mjs';
import { ENTRY, FAILURE, LEDGER, NOW, RECORD, cleanup, world } from './fixtures/repair-world.mjs';
import { FIXTURE_IDENTITY, gitIn } from './fixtures/route-repo.mjs';
import { GENERATED_AT, REVISION } from './fixtures/spend-report-corpus.mjs';
import { recordFailedSpend } from './repair-finish.mjs';
import { repairRun } from './repair-run.mjs';
import { corpusFiles, spendReportFile } from './spend-report.mjs';
import { REPORT_PATH, stampedAt } from './spend-report-text.mjs';
import { WriterError } from './writer-error.mjs';

after(cleanup);

const textOf = (value) => JSON.stringify(value, null, 2) + '\n';

function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

async function tracked(changes) {
  const made = world(changes);
  const { io } = made;
  const root = io.repoRoot;
  const opened = await io.open();
  put(root, LEDGER, textOf(opened.ledger));
  put(root, RECORD, textOf(opened.record));
  put(root, REPORT_PATH, spendReportFile({ repoRoot: root, revision: REVISION, at: GENERATED_AT }).text);
  gitIn(root, 'init', '--quiet', '--initial-branch=main');
  gitIn(root, 'add', '--', '.');
  gitIn(root, ...FIXTURE_IDENTITY, 'commit', '--quiet', '-m', 'fixture');
  const head = gitIn(root, 'rev-parse', 'HEAD').trim();
  io.open = async () => ({ ...opened, head });
  io.run = gitRun();
  io.commit = commitRepair;
  return { ...made, root, head };
}

const reportFindings = (root) =>
  spendReportFindings({ ...corpusFiles(root), committed: readFileSync(join(root, REPORT_PATH), 'utf8') });

const buildBroke = async () => {
  throw new WriterError('build', 'the build broke');
};

test('the report is a file the pipeline may commit', () => {
  assert.equal(refusalFor(REPORT_PATH), null);
});

test("the tree a repair starts from has a current report, so a finding after the repair is the repair's doing", async () => {
  const { root } = await tracked();

  assert.deepEqual(reportFindings(root), []);
});

test('a repaired entry commits the regenerated report with it, and neither the history check nor the report check finds anything', async () => {
  const { io, root, head } = await tracked();

  const result = await repairRun(io);

  assert.equal(result.outcome, 'repaired');
  assert.deepEqual(committedFiles(root), [ENTRY, LEDGER, RECORD, 'docs/SEMANTIC-CORE.md', REPORT_PATH].sort());
  assert.deepEqual(historyReport({ root }), { findings: [], commits: 1, skipped: null });
  assert.deepEqual(reportFindings(root), []);
  const report = readFileSync(join(root, REPORT_PATH), 'utf8');
  assert.equal(stampedAt(report), NOW.toISOString());
  assert.ok(report.includes(head));
});

test('a failed repair commits the regenerated report with the ledger, and neither check finds anything', async () => {
  const { io, root } = await tracked({ assemble: buildBroke });

  const error = await repairRun(io).then(
    () => assert.fail('the repair should have stopped'),
    (stopped) => stopped
  );

  assert.match(error.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(committedFiles(root), [LEDGER, REPORT_PATH].sort());
  assert.deepEqual(historyReport({ root }), { findings: [], commits: 0, skipped: null });
  assert.deepEqual(reportFindings(root), []);
});

for (const [name, changes] of [
  ['a repaired entry', undefined],
  ['a failed repair', { assemble: buildBroke }],
]) {
  test(`the defect: ${name} committed without the regenerated report leaves one spend-report-differs finding`, async () => {
    const { io, root } = await tracked(changes);
    io.commit = (request) =>
      commitRepair({ ...request, files: request.files.filter(({ path }) => path !== REPORT_PATH) });

    await repairRun(io).then(
      () => undefined,
      () => undefined
    );

    const found = reportFindings(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].rule, 'spend-report-differs');
  });
}

test('a spend that leaves the report as it is does not list the report, so the commit is not refused for holding no change to it', async () => {
  const { io, root } = await tracked();
  const situation = await io.open();

  const sha = await recordFailedSpend({
    repoRoot: root,
    situation,
    calls: [],
    failures: [FAILURE],
    outcome: 'failed',
    now: NOW,
    run: io.run,
    commit: commitRepair,
    secrets: [],
  });

  assert.match(sha, /^[0-9a-f]{40}$/);
  assert.deepEqual(committedFiles(root), [LEDGER]);
  assert.deepEqual(reportFindings(root), []);
});
