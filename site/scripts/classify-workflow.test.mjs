import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after as afterAll, before as beforeAll, test } from 'node:test';
import { promisify } from 'node:util';

import { needsFullGraph } from './build-surface.mjs';
import { WORKFLOW_PATH, verdictStep } from './classify-wiring.mjs';
import { GIT_ENVIRONMENT, commitIn, gitAt } from './fixtures/diff-repo.mjs';
import { engineScene } from './fixtures/engine-scene.mjs';

const run = promisify(execFile);
const POOL = 6;

const CORPUS = [
  'docs/PRD.md',
  'audits/lighthouse-green.json',
  'site/.agents/skills/write-copy.md',
  'openspec/changes/20-write-without-a-human/tasks.md',
  'investigation/00-INDEX.md',
  'README.md',
  'site/README.md',
  'site/src/pages/index.astro',
  'site/src/data/post/a-post.md',
  'site/src/assets/fonts/LICENSE.md',
  'site/src/assets/icons/README.md',
  'site/public/llms-extra.md',
  'site/public/robots.txt',
  'site/scripts/gate.mjs',
  'site/package.json',
  'site/engine.config.json',
  '.gitignore',
  'unheard-of/thing.bin',
  'site/scripts/gate.test.mjs',
  'site/tests/visual.spec.ts',
  'site/scripts/fixtures/github-api.mjs',
  'site/playwright.config.ts',
  '.github/workflows/ci.yml',
  '.githooks/pre-push',
];

const LEGACY_SHELL = [
  'run: |',
  '          before="${{ github.event.before }}"',
  '          if [ -z "$before" ] || [ "$before" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$before" 2>/dev/null; then',
  '            before="$(git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD)"',
  '          fi',
  '          changed="$(git diff --name-only "$before" "${{ github.sha }}" || true)"',
  '          echo "changed files:"',
  '          echo "$changed"',
  '          code=false',
  '          while IFS= read -r file; do',
  '            [ -z "$file" ] && continue',
  '            case "$file" in',
  '              docs/*|audits/*|site/.agents/*|openspec/*) ;;',
  '              site/src/data/*) code=true ;;',
  '              *.md) ;;',
  '              */*) code=true ;;',
  '              *) code=true ;;',
  '            esac',
  '          done <<< "$changed"',
  '          echo "code=$code" >> "$GITHUB_OUTPUT"',
  '          echo "build surface changed: $code"',
].join('\n');

const CALL = 'run: node scripts/run-classify-diff.mjs --before "$BEFORE" --after "$AFTER" >> "$GITHUB_OUTPUT"';
const realText = readFileSync(new URL(`../../${WORKFLOW_PATH}`, import.meta.url), 'utf8');
const plant = (to) => {
  assert.ok(realText.includes(CALL), 'the workflow no longer holds the classifier call');
  return realText.replace(CALL, to);
};

let scene;
let pairs;
let outputRoot;

const touch = (root, path) => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file)) appendFileSync(file, '\n');
  else writeFileSync(file, 'v1\n');
};

beforeAll(() => {
  scene = engineScene({ entries: ['site/scripts/run-classify-diff.mjs'] });
  outputRoot = mkdtempSync(join(tmpdir(), 'workflow-output-'));
  gitAt(scene.root, 'init', '--quiet', '--initial-branch=main');
  mkdirSync(join(scene.root, 'site/public'), { recursive: true });
  writeFileSync(join(scene.root, 'site/public/robots.txt'), 'User-agent: *\n');
  commitIn(scene.root, { message: 'start' });
  pairs = CORPUS.map((path) => {
    const before = gitAt(scene.root, 'rev-parse', 'HEAD');
    touch(scene.root, path);
    const after = commitIn(scene.root, { message: `change ${path}` });
    return { path, before, after };
  });
});

afterAll(() => {
  scene?.remove();
  rmSync(outputRoot, { recursive: true, force: true });
});

const expand = (text, { before, after }) =>
  text.replaceAll('${{ github.event.before }}', before).replaceAll('${{ github.sha }}', after);

async function workflowSays(step, { before, after }, index) {
  const output = join(outputRoot, `output-${index}.txt`);
  writeFileSync(output, '');
  const env = {
    PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
    ...GIT_ENVIRONMENT,
    HOME: scene.root,
    GITHUB_OUTPUT: output,
    GITHUB_SHA: after,
    ...Object.fromEntries(
      Object.entries(step.env).map(([name, value]) => [name, expand(String(value), { before, after })])
    ),
  };
  await run('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', expand(step.run, { before, after })], {
    cwd: join(scene.root, step.workingDirectory),
    env,
  }).catch(() => null);
  const written = [...readFileSync(output, 'utf8').matchAll(/^code=(true|false)$/gm)];
  return written.length === 0 ? null : written.at(-1)[1] === 'true';
}

async function disagreements(workflowText) {
  const step = verdictStep(workflowText);
  assert.ok(step, 'the workflow names no step that produces the code output');
  const found = [];
  for (let start = 0; start < pairs.length; start += POOL) {
    const batch = pairs.slice(start, start + POOL);
    const answers = await Promise.all(batch.map((pair, at) => workflowSays(step, pair, start + at)));
    batch.forEach(({ path }, at) => {
      const module = needsFullGraph([path]);
      if (answers[at] !== module) found.push({ path, workflow: answers[at], module });
    });
  }
  return found;
}

test('the corpus holds a path of every class and each of the paths the old shell got wrong', () => {
  assert.ok(CORPUS.length >= 20);
  assert.equal(new Set(CORPUS).size, CORPUS.length);
  assert.ok(CORPUS.includes('site/src/assets/fonts/LICENSE.md'));
  assert.ok(CORPUS.includes('site/src/assets/icons/README.md'));
  assert.ok(
    CORPUS.some((path) => !needsFullGraph([path])),
    'no prose path in the corpus'
  );
  assert.ok(
    CORPUS.some((path) => needsFullGraph([path])),
    'no drawing path in the corpus'
  );
});

test('every pair of commits is one path apart, so each answer is about that path alone', () => {
  for (const { path, before, after } of pairs) {
    assert.deepEqual(gitAt(scene.root, 'diff', '--name-only', before, after).split('\n'), [path]);
  }
});

test('the real workflow says exactly what the module says about every path', async () => {
  assert.deepEqual(await disagreements(realText), []);
});

test('the old shell rule is caught naming each path it got wrong', async () => {
  const found = await disagreements(plant(LEGACY_SHELL));
  assert.deepEqual(found.map(({ path }) => path).sort(), [
    'site/public/llms-extra.md',
    'site/src/assets/fonts/LICENSE.md',
    'site/src/assets/icons/README.md',
  ]);
  for (const row of found) assert.deepEqual([row.workflow, row.module], [false, true], row.path);
});

test('a workflow that always reports nothing changed disagrees about every path that draws the graph', async () => {
  const found = await disagreements(plant('run: echo "code=false" >> "$GITHUB_OUTPUT"'));
  assert.deepEqual(found.map(({ path }) => path).sort(), CORPUS.filter((path) => needsFullGraph([path])).sort());
});

test('a workflow that writes no verdict at all disagrees about every path', async () => {
  const found = await disagreements(plant('run: echo nothing'));
  assert.equal(found.length, CORPUS.length);
  for (const row of found) assert.equal(row.workflow, null, row.path);
});

test('a workflow that always draws the graph disagrees only about the prose paths', async () => {
  const found = await disagreements(plant('run: echo "code=true" >> "$GITHUB_OUTPUT"'));
  assert.deepEqual(found.map(({ path }) => path).sort(), CORPUS.filter((path) => !needsFullGraph([path])).sort());
});
