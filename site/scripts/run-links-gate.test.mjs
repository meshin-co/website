import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { startHost } from './fixtures/http-host.mjs';

const RUNNER = resolve(import.meta.dirname, 'run-links-gate.mjs');
const MODULES = resolve(import.meta.dirname, '..', 'node_modules');

const PDF = (res) => {
  res.writeHead(200, { 'content-type': 'application/pdf' });
  res.end('%PDF-1.7');
};

function siteLinking(address) {
  const root = mkdtempSync(join(tmpdir(), 'links-gate-run-'));
  mkdirSync(join(root, 'dist'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'config.yaml'), 'site:\n  site: https://example.test\n');
  writeFileSync(
    join(root, 'dist', 'index.html'),
    `<!doctype html><html><head><title>t</title></head><body><a href="${address}" rel="nofollow noopener noreferrer">cited</a></body></html>`
  );
  symlinkSync(MODULES, join(root, 'node_modules'));
  return root;
}

function runGate(root) {
  const env = { ...process.env, LINKS_PROBE_BACKOFF_MS: '20,20' };
  delete env.LINKS_SKIP_EXTERNAL;
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [RUNNER], { cwd: root, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

async function gateOnHost(respond) {
  const host = await startHost(respond);
  const root = siteLinking(`${host.origin}/standard.pdf`);
  try {
    return { ...(await runGate(root)), host };
  } finally {
    await host.close();
    rmSync(root, { recursive: true, force: true });
  }
}

test('a document the host refuses to HEAD and serves to a GET is not dead, even when the first GET is cut off', async () => {
  const run = await gateOnHost((req, res, nth) => {
    if (req.method === 'HEAD') return res.writeHead(404).end();
    if (nth === 1) return req.socket.destroy();
    return PDF(res);
  });

  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /0 dead/);
  assert.equal(run.host.count('HEAD'), 0, 'a HEAD is never believed, so it is never sent');
});

test('an address that answers 404 to every GET, after a retry, is dead', async () => {
  const run = await gateOnHost((req, res) => res.writeHead(404).end());

  assert.equal(run.code, 1);
  assert.match(run.stderr, /LINKS dead .*standard\.pdf \(404\)/);
  assert.equal(run.host.count('HEAD'), 0);
  assert.ok(run.host.count('GET') >= 2, `one GET is not a retry, saw ${run.host.count('GET')}`);
});

test('a host that never answers is unverified, and unverified is not dead', async () => {
  const run = await gateOnHost((req) => req.socket.destroy());

  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stderr, /LINKS unverified, not dead: .*standard\.pdf/);
  assert.match(run.stdout, /0 dead/);
});
