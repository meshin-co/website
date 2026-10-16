import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, chmod, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const runner = new URL('run-lh-parallel.mjs', import.meta.url).pathname;

async function fakeNpm({ seconds, exitCode = 0, reports = 3 }) {
  const dir = await mkdtemp(join(tmpdir(), 'lh-parallel-'));
  await mkdir(join(dir, 'bin'), { recursive: true });
  const npm = join(dir, 'bin', 'npm');
  const script = [
    '#!/bin/sh',
    'echo "shard $LHCI_FORM_FACTOR $LH_SHARD_INDEX port $GATE_SERVER_PORT cwd $(basename "$PWD") routes $LH_ONLY_ROUTES"',
    'target="$AUDIT_ROOT/audits/phase-$GATE_PHASE/lh-$LHCI_FORM_FACTOR"',
    '[ "$LH_SHARD_TOTAL" = 1 ] || target="$target/shard-$LH_SHARD_INDEX"',
    'mkdir -p "$target"',
    'i=0',
    'while [ $i -lt ' + reports + ' ]; do echo "{}" > "$target/lhr-$i.json"; i=$((i+1)); done',
    'sleep ' + seconds,
    'exit ' + exitCode,
    '',
  ].join('\n');
  await writeFile(npm, script);
  await chmod(npm, 0o755);
  const site = join(dir, 'site');
  await mkdir(join(site, 'dist'), { recursive: true });
  await symlink(new URL('.', import.meta.url).pathname.replace(/\/$/, ''), join(site, 'scripts'));
  for (const route of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    await mkdir(join(site, 'dist', route), { recursive: true });
    await writeFile(join(site, 'dist', route, 'index.html'), '<html></html>');
  }
  await writeFile(join(site, 'dist', 'index.html'), '<html></html>');

  return { binDir: join(dir, 'bin'), auditRoot: dir, site };
}

const invoke = async ({ binDir, auditRoot, site }, env) => {
  try {
    const { stdout } = await run(process.execPath, [runner], {
      cwd: site,
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        GATE_PHASE: 'test',
        AUDIT_ROOT: auditRoot,
        ...env,
      },
    });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.code, out: `${error.stdout}${error.stderr}` };
  }
};

test('both form factors are measured in parallel, each shard on its own port', async () => {
  const fake = await fakeNpm({ seconds: 0 });

  const { code, out } = await invoke(fake, { LH_WORKERS: '2' });

  assert.equal(code, 0, out);
  assert.match(out, /shard mobile 1 port 4330/);
  assert.match(out, /shard desktop 2 port 4333/);
  assert.match(out, /4 shards across 2 workers, 0 failed/);
});

test('a shard that runs far past its floor is stopped rather than waited on', async () => {
  const fake = await fakeNpm({ seconds: 30 });

  const started = Date.now();
  const { code, out } = await invoke(fake, { LH_WORKERS: '1', LH_SHARD_FLOOR_MS: '1200', LH_SHARD_GRACE_MS: '300' });
  const took = Date.now() - started;

  assert.equal(code, 1);
  assert.match(out, /passed 1s, stopping it/);
  assert.match(out, /exceeded 1s and was stopped/);
  assert.ok(took < 25_000, `gave up waiting after ${took}ms`);
});

test('a failing shard is named and fails the run', async () => {
  const fake = await fakeNpm({ seconds: 0, exitCode: 3 });

  const { code, out } = await invoke(fake, { LH_WORKERS: '4' });

  assert.equal(code, 1);
  assert.match(out, /mobile 1\/4 exited 3/);
});

test('a shard that files no report fails the run, however cleanly it exited', async () => {
  const fake = await fakeNpm({ seconds: 0, reports: 0 });

  const { code, out } = await invoke(fake, { LH_WORKERS: '2' });

  assert.equal(code, 1);
  assert.match(out, /mobile 1\/2 collected no reports/);
});

test('each shard runs in its own directory, because lhci keeps its state in the working directory', async () => {
  const fake = await fakeNpm({ seconds: 0 });

  const { out } = await invoke(fake, { LH_WORKERS: '2' });

  assert.match(out, /cwd mobile-1/);
  assert.match(out, /cwd desktop-2/);
});

test('a route file named relatively still resolves from a shard directory', async () => {
  const fake = await fakeNpm({ seconds: 0 });
  const routeFile = join(fake.auditRoot, 'routes.json');
  await writeFile(routeFile, '["/"]');
  const named = relative(fake.site, routeFile);

  const { out } = await invoke(fake, { LH_WORKERS: '1', LH_ONLY_ROUTES: named });

  assert.ok(named.startsWith('..'));
  assert.match(out, /routes \/[^\n]*routes\.json/);
  assert.doesNotMatch(out, /routes \.\./);
});

test('nothing to audit is a no-op, not a failure, so a specimen can plant the route it will measure', async () => {
  const fake = await fakeNpm({ seconds: 0 });
  const routeFile = join(fake.auditRoot, 'routes.json');
  await writeFile(routeFile, '["/never-built"]');

  const { code, out } = await invoke(fake, { LH_WORKERS: '2', LH_ONLY_ROUTES: routeFile });

  assert.equal(code, 0);
  assert.match(out, /0 touched routes to audit/);
  assert.doesNotMatch(out, /shard mobile/);
});
