import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const resolver = new URL('run-publish-target.mjs', import.meta.url).pathname;
const stub = new URL('fixtures/github-api.mjs', import.meta.url).pathname;

async function resolve(fixture, explicitRunId) {
  const output = join(await mkdtemp(join(tmpdir(), 'publish-')), 'github-output');
  await writeFile(output, '');
  const args = ['--import', stub, resolver, 'owner/repo', ...(explicitRunId ? [explicitRunId] : [])];
  const env = { ...process.env, GH_TOKEN: 'stub', GITHUB_OUTPUT: output, PUBLISH_FIXTURE: JSON.stringify(fixture) };
  try {
    const { stdout } = await run(process.execPath, args, { env });
    return { code: 0, out: stdout, output: await readFile(output, 'utf8') };
  } catch (error) {
    return { code: error.code, out: `${error.stdout}${error.stderr}`, output: await readFile(output, 'utf8') };
  }
}

const greenRun = { id: 77, head_branch: 'main', conclusion: 'success', head_sha: 'a'.repeat(40) };

test('it picks the newest green run on main that still has a dist', async () => {
  const { code, out, output } = await resolve({
    runs: [{ ...greenRun, id: 78, head_sha: 'b'.repeat(40) }, greenRun],
    artifacts: { 78: [], 77: [{ name: 'dist', expired: false }] },
    tip: 'a'.repeat(40),
  });

  assert.equal(code, 0);
  assert.match(out, /publish: run 77/);
  assert.match(output, /run_id=77/);
});

test('it refuses when no green run carries a dist', async () => {
  const { code, out } = await resolve({ runs: [greenRun], artifacts: { 77: [] }, tip: 'a'.repeat(40) });

  assert.equal(code, 1);
  assert.match(out, /PUBLISH no green ci run on main carries an unexpired dist/);
});

test('it refuses an expired dist, because the bytes are gone', async () => {
  const { code, out } = await resolve({
    runs: [greenRun],
    artifacts: { 77: [{ name: 'dist', expired: true }] },
    tip: 'a'.repeat(40),
  });

  assert.equal(code, 1);
  assert.match(out, /unexpired dist/);
});

test('it refuses to publish behind source commits on main', async () => {
  const { code, out } = await resolve({
    runs: [greenRun],
    artifacts: { 77: [{ name: 'dist', expired: false }] },
    tip: 'c'.repeat(40),
    compare: [{ filename: 'site/src/pages/index.astro' }, { filename: 'docs/PRD.md' }],
  });

  assert.equal(code, 1);
  assert.match(out, /main has moved on/);
  assert.match(out, /site\/src\/pages\/index\.astro/);
  assert.doesNotMatch(out, /docs\/PRD\.md/);
});

test('prose committed after the gated run does not block publishing', async () => {
  const { code, out } = await resolve({
    runs: [greenRun],
    artifacts: { 77: [{ name: 'dist', expired: false }] },
    tip: 'c'.repeat(40),
    compare: [{ filename: 'docs/PRD.md' }],
  });

  assert.equal(code, 0);
  assert.match(out, /publish: run 77/);
});

test('an explicitly dispatched run that failed its gates is refused', async () => {
  const { code, out } = await resolve(
    {
      runs: [],
      byId: { 90: { id: 90, head_branch: 'main', conclusion: 'failure', head_sha: 'a'.repeat(40) } },
      artifacts: { 90: [{ name: 'dist', expired: false }] },
      tip: 'a'.repeat(40),
    },
    '90'
  );

  assert.equal(code, 1);
  assert.match(out, /run 90 is not a green ci run on main/);
});
