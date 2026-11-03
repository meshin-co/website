import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { startHost } from './fixtures/http-host.mjs';

const RUNNER = resolve(import.meta.dirname, 'run-links-gate.mjs');
const MODULES = resolve(import.meta.dirname, '..', 'node_modules');
const REL = 'rel="nofollow noopener noreferrer"';

function siteWith(...hrefs) {
  const root = mkdtempSync(join(tmpdir(), 'links-gate-run-'));
  mkdirSync(join(root, 'dist'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'config.yaml'), 'site:\n  site: https://example.test\n');
  const anchors = hrefs.map((href) => `<a href="${href}" ${REL}>cited</a>`).join('');
  writeFileSync(
    join(root, 'dist', 'index.html'),
    `<!doctype html><html><head><title>t</title></head><body>${anchors}</body></html>`
  );
  symlinkSync(MODULES, join(root, 'node_modules'));
  return root;
}

function runGate(root) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [RUNNER], { cwd: root, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

async function gateOver(...hrefs) {
  const root = siteWith(...hrefs);
  try {
    return await runGate(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('an outbound address that is gone never fails the gate, and the gate does not even ask the host', async () => {
  const host = await startHost((req, res) => res.writeHead(404).end());
  try {
    const run = await gateOver(`${host.origin}/gone.pdf`);

    assert.equal(run.code, 0, run.stderr);
    assert.equal(host.requests.length, 0, 'a third party is not this gate’s business');
    assert.match(run.stdout, /1 outbound address read, not fetched/);
  } finally {
    await host.close();
  }
});

test('a link inside the build that goes nowhere fails the gate', async () => {
  const run = await gateOver('/zz-missing-route');

  assert.equal(run.code, 1);
  assert.match(run.stderr, /LINKS dead .*zz-missing-route/);
});

test('an outbound address that is not an address at all fails the gate, and the finding names it and the page', async () => {
  const run = await gateOver('https://exa mple.com/zz-malformed', 'https://ok.example/fine');

  assert.equal(run.code, 1);
  assert.match(
    run.stderr,
    /LINKS malformed https:\/\/exa mple\.com\/zz-malformed \(contains whitespace\) on 1 page, e\.g\. \//
  );
  assert.doesNotMatch(run.stderr, /ok\.example/);
});

test('a well-formed outbound address is not a finding', async () => {
  const run = await gateOver('https://ok.example/fine', 'https://www.linkedin.com/company/example');

  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /2 outbound addresses/);
});
