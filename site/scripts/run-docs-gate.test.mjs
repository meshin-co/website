import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const SCRIPTS = import.meta.dirname;
const RECORD = 'audits/zz-record.md';
const WRITES_RECORD = `export const OUT = '${RECORD}';\n`;
const DEAD_RECORD = /dead-path docs\/guide\.md: audits\/zz-record\.md/;

function repoCitingTheRecord(sources = {}) {
  const root = mkdtempSync(join(tmpdir(), 'run-docs-gate-'));
  const files = {
    'docs/plan/reference/locked-decisions.md': '| L1 | x | y |\n',
    'site/package.json': JSON.stringify({ scripts: {} }),
    'docs/guide.md': `# Guide\n\nThe script writes \`${RECORD}\`.\n`,
    ...sources,
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

function runGate(root, script = join(SCRIPTS, 'run-docs-gate.mjs')) {
  const { status, stdout } = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
  return { status, stdout };
}

test('a citation of a record that an engine script names passes before the script has ever run', () => {
  const { status, stdout } = runGate(repoCitingTheRecord({ 'site/scripts/write-record.mjs': WRITES_RECORD }));
  assert.equal(status, 0);
  assert.match(stdout, /^docs: \d+ files checked, 0 findings/m);
});

test('a citation that no engine source names is still a dead path, with other engine sources or with none', () => {
  const otherSources = { 'site/scripts/write-other.mjs': "export const OUT = 'audits/zz-other.md';\n" };
  for (const sources of [{}, otherSources]) {
    const { status, stdout } = runGate(repoCitingTheRecord(sources));
    assert.equal(status, 1);
    assert.match(stdout, DEAD_RECORD);
  }
});

test('a document, a test or a fixture that names the path does not make it held', () => {
  const { status, stdout } = runGate(
    repoCitingTheRecord({
      'docs/other.md': `It writes ${RECORD} too.\n`,
      'site/scripts/write-record.test.mjs': `assert.ok('${RECORD}');\n`,
      'site/scripts/fixtures/scene.mjs': WRITES_RECORD,
    })
  );
  assert.equal(status, 1);
  assert.match(stdout, DEAD_RECORD);
});

test('a record that only a workflow or the browser test configuration names passes', () => {
  const sources = {
    '.github/workflows/ci.yml': `run: git add ${RECORD}\n`,
    'site/playwright.config.ts': `export default { snapshotPathTemplate: '${RECORD}' };\n`,
  };
  for (const [path, text] of Object.entries(sources)) {
    assert.equal(runGate(repoCitingTheRecord({ [path]: text })).status, 0, path);
  }
});

test('the engine sources are read from the repository the gate is pointed at, never from the one it sits in', () => {
  const sittingIn = repoCitingTheRecord({ 'site/scripts/write-record.mjs': WRITES_RECORD });
  for (const name of ['run-docs-gate.mjs', 'docs-gate.mjs', 'engine-named-paths.mjs']) {
    copyFileSync(join(SCRIPTS, name), join(sittingIn, 'site/scripts', name));
  }
  const { status, stdout } = runGate(repoCitingTheRecord(), join(sittingIn, 'site/scripts/run-docs-gate.mjs'));
  assert.equal(status, 1);
  assert.match(stdout, DEAD_RECORD);
});
