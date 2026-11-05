import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { newClaim, writeClaim } from './autowriter-claim-store.mjs';
import { recordPath } from './record-layout.mjs';
import { runCli } from './slot-due.mjs';

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function repoWith(...claimTimes) {
  const root = mkdtempSync(join(tmpdir(), 'slot-due-'));
  roots.push(root);
  claimTimes.forEach((at, index) => {
    const now = new Date(at);
    const slug = `entry-${index}`;
    const claim = newClaim({
      slug,
      title: `Entry ${index}`,
      format: 'article',
      query: 'a query',
      demand: { impressions: 0, position: null },
      origin: 'category',
      category: 'governance',
      runId: `run-${index}`,
      now,
    });
    writeClaim(join(root, recordPath('claim', slug, now)), claim);
  });
  return root;
}

function run(root, argv) {
  const output = join(root, 'github-output.txt');
  writeFileSync(output, '');
  const lines = [];
  const errors = [];
  const code = runCli(argv, {
    repoRoot: root,
    env: { GITHUB_OUTPUT: output },
    stdout: (line) => lines.push(line),
    stderr: (line) => errors.push(line),
    times: ['03:17', '15:17'],
    catchUpMinutes: [120, 240],
  });
  return { code, lines, errors, output: readFileSync(output, 'utf8') };
}

test('a scheduled run at 05:17 with no entry today is due, and says it is a catch-up of the 03:17 slot', () => {
  const root = repoWith();
  const { code, lines, output } = run(root, ['--event', 'schedule', '--now', '2026-11-05T05:17:04Z']);
  assert.equal(code, 0);
  assert.match(output, /^due=true$/m);
  assert.match(lines.join('\n'), /03:17 slot is 120 minutes late/);
  assert.match(lines.join('\n'), /catch-up/);
});

test('a scheduled run at 05:17 after the 03:17 slot produced an entry is not due and writes due=false', () => {
  const root = repoWith('2026-11-05T03:20:00Z');
  const { code, lines, output } = run(root, ['--event', 'schedule', '--now', '2026-11-05T05:17:04Z']);
  assert.equal(code, 0);
  assert.match(output, /^due=false$/m);
  assert.match(lines.join('\n'), /1 article claimed today for 1 slot passed/);
});

test('two entries and two slots: the late afternoon attempts do nothing', () => {
  const root = repoWith('2026-11-05T03:20:00Z', '2026-11-05T15:25:00Z');
  const { output } = run(root, ['--event', 'schedule', '--now', '2026-11-05T19:17:30Z']);
  assert.match(output, /^due=false$/m);
});

test('a manual run always writes: the owner asked for it, so no quota refuses it', () => {
  const root = repoWith('2026-11-05T03:20:00Z', '2026-11-05T15:25:00Z');
  const { code, output, lines } = run(root, ['--event', 'workflow_dispatch', '--now', '2026-11-05T19:17:30Z']);
  assert.equal(code, 0);
  assert.match(output, /^due=true$/m);
  assert.match(lines.join('\n'), /started by hand/);
});

test('an event that is neither schedule nor workflow_dispatch is a usage error and writes no due line', () => {
  const root = repoWith();
  const { code, errors, output } = run(root, ['--event', 'push', '--now', '2026-11-05T05:17:04Z']);
  assert.equal(code, 2);
  assert.equal(output, '');
  assert.match(errors.join('\n'), /--event must be schedule or workflow_dispatch/);
});

test('a missing --event is a usage error, because an unnamed trigger must never default to writing', () => {
  const { code, output } = run(repoWith(), ['--now', '2026-11-05T05:17:04Z']);
  assert.equal(code, 2);
  assert.equal(output, '');
});

test('a claim file that does not match the claim schema stops the check with exit 1 and no due line, so a run never guesses', () => {
  const root = repoWith();
  const bad = join(root, 'audits/autowriter/claims/2026/11');
  mkdirSync(bad, { recursive: true });
  writeFileSync(join(bad, 'broken.json'), '{}');
  const { code, errors, output } = run(root, ['--event', 'schedule', '--now', '2026-11-05T05:17:04Z']);
  assert.equal(code, 1);
  assert.equal(output, '');
  assert.match(errors.join('\n'), /slot-due:/);
});
