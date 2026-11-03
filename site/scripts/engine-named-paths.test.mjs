import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { engineNamedPaths } from './engine-named-paths.mjs';

const RECORD = 'audits/zz-record.md';
const WRITES_RECORD = `export const OUT = '${RECORD}';\n`;

function repoWith(files) {
  const root = mkdtempSync(join(tmpdir(), 'engine-named-paths-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test('a path that an engine script names is named, before the script has ever run', () => {
  const named = engineNamedPaths(repoWith({ 'site/scripts/write-record.mjs': WRITES_RECORD }));
  assert.equal(named(RECORD), true);
});

test('a path that no engine source names is not named', () => {
  const named = engineNamedPaths(repoWith({ 'site/scripts/write-record.mjs': WRITES_RECORD }));
  assert.equal(named('audits/zz-other-record.md'), false);
});

test('a repository with no engine source names nothing, and reading it does not throw', () => {
  assert.equal(engineNamedPaths(repoWith({}))(RECORD), false);
});

test('a directory is named by its path without the trailing slash, as cited or without a leading site/', () => {
  const named = engineNamedPaths(
    repoWith({ '.github/workflows/ci.yml': 'run: git add tests/__screenshots__/linux\n' })
  );
  assert.equal(named('tests/__screenshots__/linux/'), true);
  assert.equal(named('site/tests/__screenshots__/'), true);
});

test('a path that only a document, a test, a fixture or a note beside a workflow names is not named', () => {
  const named = engineNamedPaths(
    repoWith({
      'docs/guide.md': `It writes ${RECORD}.\n`,
      'site/scripts/README.md': `| write-record.mjs | ${RECORD} |\n`,
      'site/scripts/write-record.test.mjs': `assert.ok(existsSync('${RECORD}'));\n`,
      'site/scripts/fixtures/scene.mjs': WRITES_RECORD,
      '.github/workflows/README.md': `The job writes ${RECORD}.\n`,
    })
  );
  assert.equal(named(RECORD), false);
});

test('a specimen catalogue plants paths that are absent on purpose, so it never counts as naming them', () => {
  const named = engineNamedPaths(repoWith({ 'site/scripts/route-specimens.mjs': WRITES_RECORD }));
  assert.equal(named(RECORD), false);
});

test('only a specimen catalogue is skipped, so a script that merely has specimen in its name still counts', () => {
  const named = engineNamedPaths(repoWith({ 'site/scripts/specimen-writer.mjs': WRITES_RECORD }));
  assert.equal(named(RECORD), true);
});

test('a path that only a workflow, the browser test configuration, the Lighthouse configuration or package.json names is named', () => {
  const sources = {
    '.github/workflows/ci.yml': `run: node scripts/measure.mjs > ${RECORD}\n`,
    'site/playwright.config.ts': `export default { snapshotPathTemplate: '${RECORD}' };\n`,
    'site/lighthouserc.cjs': `module.exports = { out: '${RECORD}' };\n`,
    'site/package.json': `{"scripts":{"audit":"node scripts/measure.mjs > ${RECORD}"}}\n`,
  };
  for (const [path, text] of Object.entries(sources)) {
    assert.equal(engineNamedPaths(repoWith({ [path]: text }))(RECORD), true, path);
  }
});

test('a path that only begins a longer name is not named, and neither is one that only ends a longer name', () => {
  const named = engineNamedPaths(
    repoWith({ 'site/scripts/gaps.mjs': "export const OUT = 'audits/phase-4.7/gaps.md'; // mydocs/PRD.md\n" })
  );
  assert.equal(named('audits/phase-4.7/gaps.md'), true);
  assert.equal(named('audits/phase-4/'), false);
  assert.equal(named('docs/PRD.md'), false);
});

test('a full stop that ends a sentence does not extend the name it follows', () => {
  const named = engineNamedPaths(repoWith({ 'site/scripts/say.mjs': `console.log('wrote ${RECORD}.');\n` }));
  assert.equal(named(RECORD), true);
});
