import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const script = new URL('run-lh-evidence.mjs', import.meta.url).pathname;

async function repo() {
  const root = await mkdtemp(join(tmpdir(), 'lh-evidence-'));
  await mkdir(join(root, 'site/src/pages'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'site/src/pages/index.astro'), 'one');
  await writeFile(join(root, 'docs/PRD.md'), 'prose');
  await run('git', ['init', '-q'], { cwd: root });
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one'], { cwd: root });
  return root;
}

const invoke = async (root, mode, phase = 'test') => {
  try {
    const { stdout } = await run(process.execPath, [script, mode, phase], { cwd: root });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.code, out: `${error.stdout}${error.stderr}` };
  }
};

const greenReport = JSON.stringify({
  finalUrl: 'http://127.0.0.1:4330/',
  categories: {
    performance: { score: 1 },
    accessibility: { score: 1 },
    'best-practices': { score: 1 },
    seo: { score: 1 },
  },
});

async function withReports(root, factors, body = greenReport) {
  for (const factor of factors) {
    const dir = join(root, 'audits/phase-test', `lh-${factor}`, 'shard-1');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'lhr-1.json'), body);
  }
}

test('a push with no recorded run at all is refused', async () => {
  const root = await repo();

  const { code, out } = await invoke(root, 'check');

  assert.equal(code, 1);
  assert.match(out, /no local lighthouse run/i);
});

test('recording a run makes the same tree pushable', async () => {
  const root = await repo();

  await withReports(root, ['mobile', 'desktop']);
  const recorded = await invoke(root, 'record');
  const checked = await invoke(root, 'check');

  assert.equal(recorded.code, 0);
  assert.equal(checked.code, 0);
  assert.match(checked.out, /lighthouse evidence covers this tree/);
  assert.match(await readFile(join(root, 'audits/lighthouse-green.json'), 'utf8'), /"fingerprint"/);
});

test('editing a source file after the recorded run refuses the push', async () => {
  const root = await repo();
  await withReports(root, ['mobile', 'desktop']);
  await invoke(root, 'record');
  await writeFile(join(root, 'site/src/pages/index.astro'), 'two');
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'two'], { cwd: root });

  const { code, out } = await invoke(root, 'check');

  assert.equal(code, 1);
  assert.match(out, /measured a different tree/);
});

test('editing only prose after the recorded run still pushes', async () => {
  const root = await repo();
  await withReports(root, ['mobile', 'desktop']);
  await invoke(root, 'record');
  await writeFile(join(root, 'docs/PRD.md'), 'rewritten prose');
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'prose'], { cwd: root });

  const { code } = await invoke(root, 'check');

  assert.equal(code, 0);
});

test('recording refuses a run whose reports are not on disk, however green the console looked', async () => {
  const root = await repo();

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 1);
  assert.match(out, /no lighthouse reports/i);
});

test('recording refuses one form factor on its own', async () => {
  const root = await repo();
  await withReports(root, ['mobile']);

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 1);
  assert.match(out, /desktop/);
});

test('a sub-100 report is refused, so the record cannot outrun the measurement', async () => {
  const root = await repo();
  const low = JSON.parse(greenReport);
  low.categories.performance.score = 0.99;
  await withReports(root, ['mobile', 'desktop'], JSON.stringify(low));

  const { code, out } = await invoke(root, 'record');

  assert.equal(code, 1);
  assert.match(out, /performance 99, not 100/);
  assert.match(out, /nothing recorded/);
});
