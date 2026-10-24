import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const RUNNER = fileURLToPath(new URL('./run-smoke-prod.mjs', import.meta.url));
const run = promisify(execFile);

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'smoke-prod-'));
  const site = join(root, 'site');
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
  mkdirSync(join(site, 'src'), { recursive: true });
  writeFileSync(join(site, 'src', 'config.yaml'), 'site:\n  name: example.test\n');
  return { root, site };
}

async function smoke(site, ...args) {
  const server = createServer((request, response) => response.writeHead(404).end());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    return await run(process.execPath, [RUNNER, origin, ...args], { cwd: site }).catch((error) => error);
  } finally {
    server.close();
  }
}

test('a run with no output path writes where git ignores, never over committed phase evidence', async () => {
  const { root, site } = workspace();

  await smoke(site);

  assert.equal(existsSync(join(root, 'audits/phase-local/smoke-prod.md')), true);
  assert.equal(existsSync(join(root, 'audits/phase-5/smoke-prod.md')), false);
});

test('an explicit output path still receives the report', async () => {
  const { root, site } = workspace();
  const target = join(root, 'audits/phase-9/smoke-prod.md');

  await smoke(site, target);

  assert.equal(existsSync(target), true);
  assert.equal(existsSync(join(root, 'audits/phase-local/smoke-prod.md')), false);
});

test('the default output path is one the repository ignores', () => {
  const repo = fileURLToPath(new URL('../..', import.meta.url));
  const defaultOut = /process\.argv\[3\] \?\? '\.\.\/(.+)'/.exec(readFileSync(RUNNER, 'utf8'))[1];

  assert.doesNotThrow(() => execFileSync('git', ['check-ignore', '-q', defaultOut], { cwd: repo }));
});
