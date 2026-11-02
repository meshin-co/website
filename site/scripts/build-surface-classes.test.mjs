import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { affectsBuild, classifyPath, compileRules, drawsFullGraph, needsFullGraph } from './build-surface.mjs';

const TABLE = [
  ['prose', 'docs/PRD.md', 'a document under a prose directory'],
  ['prose', 'docs/diagram.png', 'a prose directory holds any file, not only markdown'],
  ['prose', 'audits/lighthouse-green.json', 'an audit record'],
  ['prose', 'site/.agents/skills/run-the-gate.md', 'a skill'],
  ['prose', 'openspec/changes/20-write-without-a-human/tasks.md', 'a spec'],
  ['prose', 'investigation/00-INDEX.md', 'a record'],
  ['prose', 'README.md', 'markdown at the root'],
  ['prose', 'site/README.md', 'markdown beside the site'],
  ['prose', '.github/PULL_REQUEST_TEMPLATE.md', 'markdown inside an automation directory is still prose'],
  ['prose', 'site/scripts/fixtures/notes.md', 'markdown inside a fixtures directory is still prose'],
  ['prose', 'docs/notes.test.mjs', 'a prose directory is checked before the test pattern'],
  ['build', 'site/src/pages/index.astro', 'a page'],
  ['build', 'site/src/data/post/a-post.md', 'content markdown under a shipped directory'],
  ['build', 'site/src/pages/readme.md', 'markdown under a shipped directory ships'],
  [
    'build',
    'site/src/assets/fonts/LICENSE.md',
    'markdown beside an asset under a shipped directory: the old shell said prose',
  ],
  [
    'build',
    'site/src/assets/icons/README.md',
    'a readme beside the icons under a shipped directory: the old shell said prose',
  ],
  ['build', 'site/public/llms-extra.md', 'markdown in the public directory is served as it stands'],
  ['build', 'site/public/tests/a.png', 'a shipped directory merely named tests'],
  ['build', 'site/src/data/fixtures/x.md', 'a shipped directory merely named fixtures'],
  ['build', 'site/scripts/gate.mjs', 'a script the build runs'],
  ['build', 'site/package.json', 'dependencies decide the build'],
  ['build', 'site/astro.config.ts', 'build configuration'],
  ['build', 'site/lighthouserc.cjs', 'the lighthouse config sets the verdict a record claims'],
  ['build', 'site/engine.config.json', 'the engine configuration decides what the gates measure'],
  ['build', '.gitignore', 'a root file no rule names'],
  ['build', 'unheard-of/thing.bin', 'a path no rule names is treated as build-affecting'],
  ['tooling', 'site/scripts/gate.test.mjs', 'a unit test'],
  ['tooling', 'site/src/utils/jsonld.test.mjs', 'a unit test inside a shipped directory'],
  ['tooling', 'site/tests/visual.spec.ts', 'a browser test'],
  ['tooling', 'site/tests/helpers.ts', 'a helper in a tests directory'],
  ['tooling', 'site/scripts/fixtures/github-api.mjs', 'a fixture'],
  ['tooling', 'site/playwright.config.ts', 'the test runner configuration'],
  ['tooling', '.github/workflows/ci.yml', 'a workflow'],
  ['tooling', '.github/actions/cancel-run/action.yml', 'a composite action'],
  ['tooling', '.githooks/pre-push', 'a hook'],
];

for (const [expected, path, why] of TABLE) {
  test(`${path} is ${expected}: ${why}`, () => {
    assert.equal(classifyPath(path), expected);
  });
}

test('only a prose path may leave the full job graph out, and only a build path moves the Lighthouse fingerprint', () => {
  for (const [expected, path] of TABLE) {
    assert.equal(drawsFullGraph(path), expected !== 'prose', path);
    assert.equal(affectsBuild(path), expected === 'build', path);
  }
});

const UNCLASSIFIABLE = [
  ['', 'an empty path'],
  ['/etc/hosts', 'an absolute path'],
  ['docs/../site/src/pages/index.astro', 'a path that climbs out of a prose directory'],
  ['./docs/a.md', 'a path that starts with a dot segment'],
  ['docs//a.md', 'a path with an empty segment'],
  ['docs\\a.md', 'a path written with backslashes'],
  ['docs/', 'a bare directory'],
  ['docs/a.md\u0000', 'a path carrying a NUL'],
  ['"docs/caf\\303\\251.md"', 'a path git quoted'],
  [null, 'a missing path'],
  [42, 'a number'],
];

for (const [path, why] of UNCLASSIFIABLE) {
  test(`${why} cannot be placed, so it counts as build-affecting and draws the full graph`, () => {
    assert.equal(classifyPath(path), 'build');
    assert.equal(drawsFullGraph(path), true);
    assert.equal(affectsBuild(path), true);
  });
}

test('a change set draws the full graph when any one path does', () => {
  assert.equal(needsFullGraph(['docs/a.md', 'audits/b.json', 'README.md']), false);
  assert.equal(needsFullGraph(['docs/a.md', 'site/src/pages/index.astro']), true);
  assert.equal(needsFullGraph(['docs/a.md', '.github/workflows/ci.yml']), true);
  assert.equal(needsFullGraph(['docs/a.md', '']), true);
});

test('a change set that names no path carries no evidence, so it draws the full graph too', () => {
  assert.equal(needsFullGraph([]), true);
  assert.equal(needsFullGraph(undefined), true);
  assert.equal(needsFullGraph(null), true);
  assert.equal(needsFullGraph('docs/a.md'), true);
});

test("the rules are the site's own: another layout classifies by its own directories", () => {
  const rules = compileRules({
    proseDirectories: ['notes/'],
    proseExtensions: ['.txt'],
    shippedDirectories: ['app/'],
    automationDirectories: ['ci/'],
    testTooling: ['jest.config.js'],
    testFilePattern: '_test\\.go$',
    testDirectoryPattern: '(?:^|/)spec/',
  });
  const classes = Object.fromEntries(
    [
      'notes/a.bin',
      'README.txt',
      'app/page.txt',
      'ci/run.sh',
      'jest.config.js',
      'pkg/a_test.go',
      'pkg/spec/data.json',
      'docs/a.md',
    ].map((path) => [path, classifyPath(path, rules)])
  );
  assert.deepEqual(classes, {
    'notes/a.bin': 'prose',
    'README.txt': 'prose',
    'app/page.txt': 'build',
    'ci/run.sh': 'tooling',
    'jest.config.js': 'tooling',
    'pkg/a_test.go': 'tooling',
    'pkg/spec/data.json': 'tooling',
    'docs/a.md': 'build',
  });
});
