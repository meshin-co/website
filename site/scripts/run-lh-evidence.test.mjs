import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const repoRoot = new URL('../../', import.meta.url).pathname;
const greenReport = (route) => ({
  finalUrl: `http://127.0.0.1:4330${route}`,
  categories: Object.fromEntries(
    ['performance', 'accessibility', 'best-practices', 'seo'].map((category) => [category, { score: 1 }])
  ),
  audits: { 'largest-contentful-paint': { numericValue: 900 }, 'cumulative-layout-shift': { numericValue: 0 } },
});

async function fixture({ runs = 3, score = 1 } = {}) {
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
