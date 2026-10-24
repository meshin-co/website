import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

import {
  fingerprint,
  headFingerprint,
  readMeasuredStamp,
  staleReason,
  stampMeasuredTree,
  uncommittedBuildFiles,
  unmeasuredReason,
} from './lh-evidence.mjs';

const run = promisify(execFile);

test('the fingerprint covers only what can change the built output', () => {
  const withProse = fingerprint([
    ['site/src/pages/index.astro', 'aaa'],
    ['docs/PRD.md', 'bbb'],
    ['audits/phase-5/REPORT.md', 'ccc'],
  ]);
  const withoutProse = fingerprint([['site/src/pages/index.astro', 'aaa']]);

  assert.equal(withProse, withoutProse);
});

test('the order files arrive in does not change the fingerprint', () => {
  const one = fingerprint([
    ['site/src/pages/a.astro', '1'],
    ['site/src/pages/b.astro', '2'],
  ]);
  const other = fingerprint([
    ['site/src/pages/b.astro', '2'],
    ['site/src/pages/a.astro', '1'],
  ]);

  assert.equal(one, other);
});

test('a changed source file changes the fingerprint', () => {
  const before = fingerprint([['site/src/pages/index.astro', 'aaa']]);
  const after = fingerprint([['site/src/pages/index.astro', 'aab']]);

  assert.notEqual(before, after);
});

test('a tree matching the recorded green run needs no second run', () => {
  assert.equal(staleReason({ fingerprint: 'abc' }, 'abc'), undefined);
});

test('a tree that no recorded run measured is refused, and says what to run', () => {
  const reason = staleReason({ fingerprint: 'abc', recordedAt: '2026-10-16T08:00:00Z' }, 'xyz');

  assert.match(reason, /npm run gate:lh/);
  assert.match(reason, /2026-10-16T08:00:00Z/);
});

test('a missing record is refused too, because no run has ever been recorded', () => {
  assert.match(staleReason(undefined, 'xyz'), /no local lighthouse run/i);
});

test('an edit not yet committed is named, because the fingerprint would describe another tree', () => {
  const porcelain = [' M site/src/pages/index.astro', '?? site/src/components/New.astro', ' M docs/PRD.md'].join('\n');

  assert.deepEqual(uncommittedBuildFiles(porcelain), ['site/src/pages/index.astro', 'site/src/components/New.astro']);
});

test('a rename reports its destination, which is the file the build would read', () => {
  assert.deepEqual(uncommittedBuildFiles('R  site/src/a.astro -> site/src/b.astro'), ['site/src/b.astro']);
});

test('uncommitted prose is not a reason to refuse', () => {
  assert.deepEqual(uncommittedBuildFiles(' M docs/PRD.md\n?? audits/phase-5/REPORT.md'), []);
});

const where = { auditDir: 'audits/phase-17-markdown-negotiation', bucket: '17-markdown-negotiation' };
const tree = (digit) => digit.repeat(64);

test('a stamp naming the tree being recorded raises no objection', () => {
  assert.equal(unmeasuredReason({ fingerprint: tree('a') }, tree('a'), where), undefined);
});

test('a stamp naming another tree is refused, naming both trees, when the run began and the way out', () => {
  const stamp = { fingerprint: tree('a'), startedAt: '2026-10-24T14:00:00.000Z' };

  const reason = unmeasuredReason(stamp, tree('b'), where);

  assert.match(reason, /audits\/phase-17-markdown-negotiation was measured from tree aaaaaaaaaaaa/);
  assert.match(reason, /2026-10-24T14:00:00\.000Z/);
  assert.match(reason, /not the tree being recorded, bbbbbbbbbbbb/);
  assert.match(reason, /nothing recorded/);
  assert.match(reason, /Rebuild, remeasure with GATE_PHASE=17-markdown-negotiation npm run gate:lh, then record/);
});

test('a stale stamp with no start time is still refused, and the message does not invent one', () => {
  const reason = unmeasuredReason({ fingerprint: tree('a') }, tree('b'), where);

  assert.match(reason, /was measured from tree aaaaaaaaaaaa, not the tree being recorded, bbbbbbbbbbbb/);
});

test('a missing stamp is refused, because reports with no recorded origin could come from any tree', () => {
  const reason = unmeasuredReason(undefined, tree('b'), where);

  assert.match(reason, /audits\/phase-17-markdown-negotiation has no stamp/);
  assert.match(reason, /nothing recorded/);
  assert.match(reason, /Rebuild, remeasure with GATE_PHASE=17-markdown-negotiation npm run gate:lh, then record/);
});

test('anything that is not a stamp holding a full fingerprint counts as a missing stamp', () => {
  for (const stamp of [null, 'abc', 5, {}, { fingerprint: 5 }, { fingerprint: '' }, { fingerprint: 'abc' }]) {
    assert.match(unmeasuredReason(stamp, tree('b'), where), /has no stamp/, JSON.stringify(stamp));
  }
});

const commitAll = async (root) => {
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x'], { cwd: root });
};

async function repository(files) {
  const root = await mkdtemp(join(tmpdir(), 'lh-stamp-'));
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  await run('git', ['init', '-q'], { cwd: root });
  await commitAll(root);
  return root;
}

const stampFileIn = (auditDir) => join(auditDir, 'lh-measured.json');

test('the fingerprint of HEAD covers the tracked build files and nothing else', async () => {
  const root = await repository({ 'site/src/page.astro': 'a', 'docs/PRD.md': 'prose' });
  const { stdout } = await run('git', ['rev-parse', 'HEAD:site/src/page.astro'], { cwd: root });

  assert.equal(await headFingerprint(root), fingerprint([['site/src/page.astro', stdout.trim()]]));
});

test('a committed tree is stamped with the fingerprint of HEAD and the time the run began', async () => {
  const root = await repository({ 'site/src/page.astro': 'a', 'docs/PRD.md': 'prose' });
  const auditDir = join(root, 'audits/phase-test');

  const result = await stampMeasuredTree({ repo: root, auditDir });

  assert.equal(result.stamped, true);
  const stamp = JSON.parse(await readFile(stampFileIn(auditDir), 'utf8'));
  assert.equal(stamp.fingerprint, await headFingerprint(root));
  assert.equal(result.fingerprint, stamp.fingerprint);
  assert.match(stamp.startedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('uncommitted prose does not stop a stamp, because it moves no fingerprint', async () => {
  const root = await repository({ 'site/src/page.astro': 'a', 'docs/PRD.md': 'prose' });
  await writeFile(join(root, 'docs/PRD.md'), 'edited');

  const result = await stampMeasuredTree({ repo: root, auditDir: join(root, 'audits/phase-test') });

  assert.equal(result.stamped, true);
});

test('a tree with an uncommitted build file gets no stamp, and the reason names the file', async () => {
  const root = await repository({ 'site/src/page.astro': 'a' });
  await writeFile(join(root, 'site/src/page.astro'), 'edited');
  const auditDir = join(root, 'audits/phase-test');

  const result = await stampMeasuredTree({ repo: root, auditDir });

  assert.equal(result.stamped, false);
  assert.match(result.reason, /site\/src\/page\.astro is not committed/);
  await assert.rejects(readFile(stampFileIn(auditDir), 'utf8'), { code: 'ENOENT' });
});

test('a refused stamp removes the one an earlier run left, so old evidence cannot vouch for new reports', async () => {
  const root = await repository({ 'site/src/page.astro': 'a' });
  const auditDir = join(root, 'audits/phase-test');
  await stampMeasuredTree({ repo: root, auditDir });
  assert.match(await readFile(stampFileIn(auditDir), 'utf8'), /"fingerprint"/);
  await writeFile(join(root, 'site/src/page.astro'), 'edited');

  await stampMeasuredTree({ repo: root, auditDir });

  await assert.rejects(readFile(stampFileIn(auditDir), 'utf8'), { code: 'ENOENT' });
});

test('outside a git checkout nothing is stamped, and the reason names git instead of throwing', async () => {
  const bare = await mkdtemp(join(tmpdir(), 'lh-stamp-bare-'));

  const result = await stampMeasuredTree({ repo: bare, auditDir: join(bare, 'audits/phase-test') });

  assert.equal(result.stamped, false);
  assert.match(result.reason, /git/i);
});

test('reading a stamp that is absent or does not parse gives nothing instead of throwing', async () => {
  const auditDir = await mkdtemp(join(tmpdir(), 'lh-stamp-read-'));
  assert.equal(await readMeasuredStamp(auditDir), undefined);

  await writeFile(stampFileIn(auditDir), '{"fingerprint');
  assert.equal(await readMeasuredStamp(auditDir), undefined);

  await writeFile(stampFileIn(auditDir), '{"fingerprint":"abc"}');
  assert.deepEqual(await readMeasuredStamp(auditDir), { fingerprint: 'abc' });
});
