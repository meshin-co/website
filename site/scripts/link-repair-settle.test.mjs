import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { sealSignature } from './autowriter-refusals.mjs';
import { linkRepairedReason } from './disposition-restate.mjs';
import { settleRepair } from './link-repair-settle.mjs';
import { GENERATED_STATUS } from './route-derive.mjs';

const DISPOSITIONS = 'audits/phase-4.7/dispositions/generated-ai-rmf.json';
const ENTRY = 'site/src/data/glossary/ai-rmf.md';
const before = [
  { target: '/glossary/ai-rmf', status: 'rewritten', reason: 'A person rewrote this text.', digest: 'aaaaaaaaaaaa' },
];
const layout = (entries) => `${JSON.stringify(entries, null, 2)}\n`;

function scratch(t, { withDispositions = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'link-repair-settle-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'site'));
  if (withDispositions) {
    mkdirSync(dirname(join(root, DISPOSITIONS)), { recursive: true });
    writeFileSync(join(root, DISPOSITIONS), layout(before));
  }
  return root;
}

function commands(stale) {
  const seen = [];
  const run = (command, args) => {
    seen.push([command, ...args].join(' '));
    const stdout = args[0] === 'scripts/stale-dispositions.mjs' ? JSON.stringify(stale) : '';
    return { status: 0, stdout, stderr: '' };
  };
  return { seen, run };
}

const stale = [{ file: 'generated-ai-rmf.json', index: 0, target: '/glossary/ai-rmf', digest: 'bbbbbbbbbbbb' }];

test('a repository with no dispositions has nothing that can go stale, so nothing is built and nothing is restated', async (t) => {
  const root = scratch(t, { withDispositions: false });
  const { seen, run } = commands([]);

  assert.deepEqual(await settleRepair({ repoRoot: root, result: { entries: [ENTRY] }, run }), []);
  assert.deepEqual(seen, []);
});

test('a sweep that changed no entry leaves every disposition alone, so a register-only pull request costs no build', async (t) => {
  const root = scratch(t);
  const { seen, run } = commands([]);

  assert.deepEqual(await settleRepair({ repoRoot: root, result: { entries: [] }, run }), []);
  assert.deepEqual(seen, []);
});

test('a rewritten entry is formatted, rebuilt, the stale dispositions are listed from that build, restated and formatted, in that order', async (t) => {
  const root = scratch(t);
  const { seen, run } = commands(stale);

  const restated = await settleRepair({ repoRoot: root, result: { entries: [ENTRY] }, run });

  assert.deepEqual(restated, [DISPOSITIONS]);
  assert.deepEqual(seen, [
    'npx prettier --write ../' + ENTRY,
    'npm run build',
    'node scripts/stale-dispositions.mjs . dist',
    'npx prettier --write ../' + DISPOSITIONS,
  ]);
  const [entry] = JSON.parse(readFileSync(join(root, DISPOSITIONS), 'utf8'));
  assert.equal(entry.status, GENERATED_STATUS);
  assert.equal(entry.digest, 'bbbbbbbbbbbb');
  assert.equal(entry.reason, linkRepairedReason({ entries: [ENTRY] }));
  assert.match(
    entry.reason,
    /^The text of this target changed in the run in which the unattended writer added a link repair of site\/src\/data\/glossary\/ai-rmf\.md /
  );
});

test('the restated reason is not read as a seal, so the commit sink does not refuse the disposition file', async (t) => {
  const root = scratch(t);
  const { run } = commands(stale);

  await settleRepair({ repoRoot: root, result: { entries: [ENTRY] }, run });

  assert.equal(
    sealSignature({
      path: DISPOSITIONS,
      before: layout(before),
      after: readFileSync(join(root, DISPOSITIONS), 'utf8'),
    }),
    null
  );
});

test('a build that fails stops the job with the command that failed, and no disposition is restated', async (t) => {
  const root = scratch(t);
  const run = (command) => ({ status: command === 'npm' ? 1 : 0, stdout: '', stderr: 'the build failed' });

  await assert.rejects(
    settleRepair({ repoRoot: root, result: { entries: [ENTRY] }, run }),
    /npm run build exited with status 1/
  );
  assert.equal(readFileSync(join(root, DISPOSITIONS), 'utf8'), layout(before));
});

test('every rewritten entry is formatted in one call before the build reads it, so a table a longer address widened is aligned again', async (t) => {
  const root = scratch(t);
  const { seen, run } = commands(stale);
  const other = 'site/src/data/post/a-post.md';

  await settleRepair({ repoRoot: root, result: { entries: [ENTRY, other] }, run });

  assert.deepEqual(seen.slice(0, 2), ['npx prettier --write ../' + ENTRY + ' ../' + other, 'npm run build']);
});

test('a formatter that fails stops the job before any build, with the command that failed', async (t) => {
  const root = scratch(t);
  const seen = [];
  const run = (command, args) => {
    seen.push([command, ...args].join(' '));
    return { status: 2, stdout: '', stderr: 'a syntax error' };
  };

  await assert.rejects(
    settleRepair({ repoRoot: root, result: { entries: [ENTRY] }, run }),
    /npx prettier --write \.\.\/site\/src\/data\/glossary\/ai-rmf\.md exited with status 2/
  );
  assert.deepEqual(seen, ['npx prettier --write ../' + ENTRY]);
});
