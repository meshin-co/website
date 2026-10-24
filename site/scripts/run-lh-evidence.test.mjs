import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { headFingerprint } from './lh-evidence.mjs';

const run = promisify(execFile);
const repoRoot = new URL('../../', import.meta.url).pathname;
const greenReport = (route) => ({
  finalUrl: `http://127.0.0.1:4330${route}`,
  categories: Object.fromEntries(
    ['performance', 'accessibility', 'best-practices', 'seo'].map((category) => [category, { score: 1 }])
  ),
  audits: { 'largest-contentful-paint': { numericValue: 900 }, 'cumulative-layout-shift': { numericValue: 0 } },
});

const stampTree = async (root, phase = 'test') => {
  const auditDir = join(root, 'audits', `phase-${phase}`);
  await mkdir(auditDir, { recursive: true });
  const measured = { fingerprint: await headFingerprint(root), startedAt: '2026-10-24T10:00:00.000Z' };
  await writeFile(join(auditDir, 'lh-measured.json'), JSON.stringify(measured));
};

const commitAll = async (root, message) => {
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', message], { cwd: root });
};

async function fixture({ runs = 3, score = 1, stamped = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'lh-evidence-'));
  for (const dir of ['site/scripts', 'site/dist', 'docs', '.githooks'])
    await mkdir(join(root, dir), { recursive: true });

  for (const name of [
    'run-lh-evidence.mjs',
    'lh-evidence.mjs',
    'build-surface.mjs',
    'report.mjs',
    'lh-routes.cjs',
    'lh-shards.cjs',
    'gate.mjs',
    'invoked-directly.mjs',
    'lh-parallel.mjs',
    'run-lh-parallel.mjs',
    'lh-port.cjs',
  ])
    await cp(join(repoRoot, 'site/scripts', name), join(root, 'site/scripts', name));
  await cp(join(repoRoot, 'site/budgets.json'), join(root, 'site/budgets.json'));
  await cp(join(repoRoot, 'site/lighthouserc.cjs'), join(root, 'site/lighthouserc.cjs'));
  await cp(join(repoRoot, '.githooks/pre-push'), join(root, '.githooks/pre-push'));
  await chmod(join(root, '.githooks/pre-push'), 0o755);

  await writeFile(join(root, 'site/dist/index.html'), '<html><body>home</body></html>');
  await writeFile(
    join(root, 'site/dist/gate-routes.json'),
    JSON.stringify({ routes: ['/'], measured: [{ route: '/', js: 1, css: 1, page: 1, fonts: 1 }], overBudget: [] })
  );
  await writeFile(join(root, 'docs/PRD.md'), 'prose');
  await writeFile(join(root, '.gitignore'), 'site/.lh-run/\n');

  for (const factor of ['mobile', 'desktop']) {
    const dir = join(root, 'audits/phase-test', `lh-${factor}`);
    await mkdir(dir, { recursive: true });
    for (let index = 0; index < runs; index += 1) {
      const report = greenReport('/');
      report.categories.performance.score = score;
      await writeFile(join(dir, `lhr-${index}.json`), JSON.stringify(report));
    }
  }

  await run('git', ['init', '-q'], { cwd: root });
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one'], { cwd: root });
  if (stamped) await stampTree(root);
  return root;
}

const invoke = async (root, mode, phase = 'test') => {
  try {
    const { stdout } = await run(process.execPath, ['site/scripts/run-lh-evidence.mjs', mode, phase], { cwd: root });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.code, out: `${error.stdout}${error.stderr}` };
  }
};

test('a push with no recorded run at all is refused', async () => {
  const root = await fixture();

  const { code, out } = await invoke(root, 'check');

  assert.equal(code, 1);
  assert.match(out, /no local lighthouse run/i);
});

test('a passing calibration run makes the same tree pushable', async () => {
  const root = await fixture();

  const recorded = await invoke(root, 'record');
  const checked = await invoke(root, 'check');

  assert.equal(recorded.code, 0, recorded.out);
  assert.equal(checked.code, 0, checked.out);
  assert.match(await readFile(join(root, 'audits/lighthouse-green.json'), 'utf8'), /"fingerprint"/);
});

test('recording refuses a run with fewer than three runs per route, as the report does', async () => {
  const root = await fixture({ runs: 2 });

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 1);
  assert.match(out, /2 runs, gate requires 3/);
  assert.match(out, /nothing recorded/);
});

test('recording refuses a sub-100 category, so the record cannot outrun the measurement', async () => {
  const root = await fixture({ score: 0.99 });

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 1);
  assert.match(out, /performance: 99/);
});

test('recording refuses an uncommitted source edit, which the fingerprint of HEAD would misdescribe', async () => {
  const root = await fixture();
  await writeFile(join(root, 'site/dist/index.html'), '<html><body>changed</body></html>');
  await writeFile(join(root, 'site/scripts/gate.mjs'), 'export const x = 1;\n');

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 1);
  assert.match(out, /site\/scripts\/gate\.mjs/);
  assert.match(out, /not committed/);
});

test('recording refuses reports no run stamped, because they could come from any tree', async () => {
  const root = await fixture({ stamped: false });

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 1);
  assert.match(out, /audits\/phase-test has no stamp/);
  assert.match(out, /nothing recorded/);
  await assert.rejects(readFile(join(root, 'audits/lighthouse-green.json'), 'utf8'), { code: 'ENOENT' });
});

test('recording refuses reports measured from another tree, names both trees and says to remeasure', async () => {
  const root = await fixture();
  const measured = await headFingerprint(root);
  await writeFile(join(root, 'site/scripts/gate.mjs'), 'export const x = 2;\n');
  await commitAll(root, 'two');
  const current = await headFingerprint(root);

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 1);
  assert.match(out, new RegExp(`was measured from tree ${measured.slice(0, 12)}`));
  assert.match(out, new RegExp(`not the tree being recorded, ${current.slice(0, 12)}`));
  assert.match(out, /Rebuild, remeasure with GATE_PHASE=test npm run gate:lh, then record/);
  await assert.rejects(readFile(join(root, 'audits/lighthouse-green.json'), 'utf8'), { code: 'ENOENT' });
});

test('a stamp that is not a stamp counts as none, and refuses cleanly instead of crashing', async () => {
  const root = await fixture({ stamped: false });
  const stampFile = join(root, 'audits/phase-test/lh-measured.json');

  for (const body of ['{"fingerprint": ', 'null', '"abc"', '{}', '{"fingerprint": 5}']) {
    await writeFile(stampFile, body);

    const { code, out } = await invoke(root, 'record');

    assert.equal(code, 1, body);
    assert.match(out, /^LIGHTHOUSE audits\/phase-test has no stamp/m, body);
  }
});

test('a prose commit after the run leaves the stamp valid, as it leaves a push valid', async () => {
  const root = await fixture();
  await writeFile(join(root, 'docs/PRD.md'), 'rewritten');
  await commitAll(root, 'prose');

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 0, out);
});

test('a source commit after the recorded run refuses the push', async () => {
  const root = await fixture();
  await invoke(root, 'record');
  await writeFile(join(root, 'site/scripts/gate.mjs'), 'export const x = 2;\n');
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'two'], { cwd: root });

  const { code, out } = await invoke(root, 'check');

  assert.equal(code, 1);
  assert.match(out, /measured a different tree/);
});

test('a prose commit after the recorded run still pushes', async () => {
  const root = await fixture();
  await invoke(root, 'record');
  await writeFile(join(root, 'docs/PRD.md'), 'rewritten');
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'prose'], { cwd: root });

  const { code, out } = await invoke(root, 'check');

  assert.equal(code, 0, out);
});

test('git itself runs the hook: a real push of an unmeasured tree is refused', async () => {
  const root = await fixture();
  const remote = await mkdtemp(join(tmpdir(), 'lh-remote-'));
  await run('git', ['init', '-q', '--bare'], { cwd: remote });
  await run('git', ['remote', 'add', 'origin', remote], { cwd: root });
  await run('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root });

  let refused;
  try {
    await run('git', ['push', 'origin', 'HEAD'], { cwd: root });
    refused = undefined;
  } catch (error) {
    refused = `${error.stdout}${error.stderr}`;
  }

  assert.match(refused ?? '', /LIGHTHOUSE no local lighthouse run/i);

  await invoke(root, 'record');
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'record'], { cwd: root });
  const { stderr } = await run('git', ['push', 'origin', 'HEAD'], { cwd: root });

  assert.doesNotMatch(stderr, /LIGHTHOUSE/);
});

test('the stamp a real run leaves is the one record accepts, though the run starts in site/ and record in the root', async () => {
  const root = await fixture({ stamped: false });
  const tools = await mkdtemp(join(tmpdir(), 'lh-tools-'));
  await mkdir(join(tools, 'bin'));
  await writeFile(join(tools, 'green.json'), JSON.stringify(greenReport('/')));
  await writeFile(
    join(tools, 'bin/npm'),
    [
      '#!/bin/sh',
      'target="$AUDIT_ROOT/audits/phase-$GATE_PHASE/lh-$LHCI_FORM_FACTOR"',
      'mkdir -p "$target"',
      'for i in 0 1 2; do cp "$GREEN_REPORT" "$target/lhr-$i.json"; done',
      '',
    ].join('\n')
  );
  await chmod(join(tools, 'bin/npm'), 0o755);
  const env = {
    ...process.env,
    PATH: `${join(tools, 'bin')}:${process.env.PATH}`,
    GATE_PHASE: 'test',
    LH_WORKERS: '1',
    GREEN_REPORT: join(tools, 'green.json'),
  };
  delete env.AUDIT_ROOT;

  await run(process.execPath, ['scripts/run-lh-parallel.mjs'], { cwd: join(root, 'site'), env });
  const recorded = await invoke(root, 'record');

  assert.equal(recorded.code, 0, recorded.out);
});
