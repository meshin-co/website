import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { startHost } from './fixtures/http-host.mjs';
import { registerText, sealRegister } from './link-rot-register.mjs';

const RUNNER = resolve(import.meta.dirname, 'run-links-gate.mjs');
const MODULES = resolve(import.meta.dirname, '..', 'node_modules');
const REL = 'rel="nofollow noopener noreferrer"';

function siteWith(register, ...hrefs) {
  const base = mkdtempSync(join(tmpdir(), 'links-gate-run-'));
  const root = join(base, 'site');
  mkdirSync(join(root, 'dist'), { recursive: true });
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'config.yaml'), 'site:\n  site: https://example.test\n');
  const anchors = hrefs.map((href) => `<a href="${href}" ${REL}>cited</a>`).join('');
  writeFileSync(
    join(root, 'dist', 'index.html'),
    `<!doctype html><html><head><title>t</title></head><body>${anchors}</body></html>`
  );
  if (register !== undefined) {
    mkdirSync(join(base, 'audits'));
    writeFileSync(join(base, 'audits', 'link-rot.json'), register);
  }
  symlinkSync(MODULES, join(root, 'node_modules'));
  return { base, root };
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

async function gateOverRegister(register, ...hrefs) {
  const { base, root } = siteWith(register, ...hrefs);
  try {
    return await runGate(root);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

const gateOver = (...hrefs) => gateOverRegister(undefined, ...hrefs);

const GONE = 'https://example.org/gone';
const SNAPSHOT = `https://web.archive.org/web/20230302214609/${GONE}`;
const repaired = {
  original: GONE,
  entry: 'site/src/data/glossary/evals.md',
  outcome: 'archive',
  replacement: SNAPSHOT,
  citedOn: '2023-03-01',
  firstSeenDead: '2026-11-03',
  why: 'the Internet Archive capture of 2023-03-02 is 1 day from the citation date 2023-03-01 and carries the title',
};
const searched = {
  ...repaired,
  original: 'https://example.org/other',
  entry: 'site/src/data/post/a-post.md',
  outcome: 'search',
  replacement: searchFallbackUrl({ title: 'The other report', publisher: 'Example Org' }),
  why: 'no usable Internet Archive capture: the archive holds no snapshot of https://example.org/other',
};
const unplaced = {
  original: 'https://template.example/gone',
  entry: null,
  outcome: 'unplaced',
  replacement: null,
  citedOn: null,
  firstSeenDead: '2026-11-03',
  why: 'no collection entry cites it',
  pages: ['/'],
};
const sealed = (rows) => registerText(sealRegister({ updatedOn: '2026-11-03', rows }));

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

test('a repository with no register is fine, and the gate says that nothing has been repaired yet', async () => {
  const run = await gateOver('https://ok.example/fine');

  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /^link rot: no register yet/m);
});

test('an untouched register is green, and the gate counts what it holds in one line that never fails', async () => {
  const run = await gateOverRegister(sealed([repaired, searched, unplaced]), 'https://ok.example/fine');

  assert.equal(run.code, 0, run.stderr);
  assert.match(
    run.stdout,
    /^link rot: 1 citation repaired from the archive, 1 resting on a search link, 1 unplaced address \(audits\/link-rot\.json, changed 2026-11-03\)$/m
  );
});

test('a row that rests on a search link, or an address nobody could place, is never a finding by itself', async () => {
  const run = await gateOverRegister(sealed([searched, unplaced]));

  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.stderr, '');
});

test('a register whose row was edited by hand fails the gate, because the digest no longer matches its rows', async () => {
  const tampered = JSON.parse(sealed([repaired, searched]));
  tampered.rows[1].why = 'the claim beside it was checked by hand';

  const run = await gateOverRegister(`${JSON.stringify(tampered, null, 2)}\n`, 'https://ok.example/fine');

  assert.equal(run.code, 1);
  assert.match(run.stderr, /LINKS register the digest does not match its rows/);
  assert.doesNotMatch(run.stdout, /^link rot:/m);
});

test('a register that is not JSON fails the gate and names the file', async () => {
  const run = await gateOverRegister('{ nope', 'https://ok.example/fine');

  assert.equal(run.code, 1);
  assert.match(run.stderr, /LINKS register audits\/link-rot\.json is not JSON/);
});
