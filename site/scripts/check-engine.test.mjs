import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after as afterAll, test } from 'node:test';

import { REPOSITORY_ROOT, engineFindings, requiredValues } from './check-engine.mjs';
import { anchorsFor } from './engine-anchors.mjs';
import { ENGINE_SCHEMA, readEngineConfig } from './engine-config.mjs';
import { INTERVIEW_PATH } from './interview-coverage.mjs';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(import.meta.dirname, 'check-engine.mjs');
const CONFIG = 'site/engine.config.json';
const WORKFLOW = '.github/workflows/ci.yml';
const config = readEngineConfig();
const REAL_CONFIG = readFileSync(join(REPOSITORY, CONFIG), 'utf8');
const REAL_WORKFLOW = readFileSync(join(REPOSITORY, WORKFLOW), 'utf8');
const WORKFLOW_DIRECTORY = '.github/workflows';
const ENV_EXAMPLE = 'site/.env.example';
const REAL_BANK = readFileSync(join(REPOSITORY, INTERVIEW_PATH), 'utf8');
const REAL_INTERVIEW_INPUTS = {
  ...Object.fromEntries(
    readdirSync(join(REPOSITORY, WORKFLOW_DIRECTORY)).map((file) => [
      `${WORKFLOW_DIRECTORY}/${file}`,
      readFileSync(join(REPOSITORY, WORKFLOW_DIRECTORY, file), 'utf8'),
    ])
  ),
  [ENV_EXAMPLE]: readFileSync(join(REPOSITORY, ENV_EXAMPLE), 'utf8'),
};
const roots = [];
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function scene({ configText = REAL_CONFIG, workflowText = REAL_WORKFLOW, bankText = REAL_BANK, skip = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-engine-'));
  roots.push(root);
  for (const { path, kind } of anchorsFor(config)) {
    if (path === skip) continue;
    const target = join(root, path);
    if (kind === 'directory') mkdirSync(target, { recursive: true });
    else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, '');
    }
  }
  for (const directory of config.diff.shippedDirectories) mkdirSync(join(root, directory), { recursive: true });
  if (configText !== null) writeFileSync(join(root, CONFIG), configText);
  if (workflowText !== null && skip !== WORKFLOW) writeFileSync(join(root, WORKFLOW), workflowText);
  for (const [path, text] of Object.entries({ ...REAL_INTERVIEW_INPUTS, [INTERVIEW_PATH]: bankText })) {
    if (path === skip || path === WORKFLOW) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const without = (path) => {
  const copy = JSON.parse(REAL_CONFIG);
  const keys = path.split('.');
  const last = keys.pop();
  delete keys.reduce((node, key) => node[key], copy)[last];
  return JSON.stringify(copy);
};

const bankWithout = (name) => {
  const text = REAL_BANK.replaceAll(name, '');
  assert.notEqual(text, REAL_BANK, `${name} is not in the interview`);
  return text;
};

const named = ({ findings }) => findings.map(({ rule, where }) => `${rule} ${where}`);
const values = requiredValues(ENGINE_SCHEMA);

test('the repository root is found from the script, never from the working directory', () => {
  assert.equal(REPOSITORY_ROOT, REPOSITORY);
});

test('this repository has no finding', () => {
  const found = engineFindings(REPOSITORY);
  assert.deepEqual(found.findings, []);
  assert.ok(found.values >= 25 && found.anchors >= 20, JSON.stringify(found));
});

test('every value the engine needs is listed with its type and what it means', () => {
  assert.ok(values.length >= 25, `only ${values.length} values`);
  assert.equal(new Set(values.map(({ path }) => path)).size, values.length);
  for (const { path, type, description } of values) {
    assert.match(path, /^[a-z][A-Za-z.]*[A-Za-z]$/, path);
    assert.ok(type.length > 0, path);
    assert.ok(description.length > 20, `${path} has no description`);
  }
  for (const path of [
    'loop.attemptCap',
    'diff.proseDirectories',
    'routeFamilies.rules',
    'content.formats.article.author',
    'demand.windowDays',
  ]) {
    assert.ok(
      values.some((value) => value.path === path),
      path
    );
  }
});

for (const { path } of values) {
  test(`a scene without ${path} names that value and nothing else`, () => {
    const found = engineFindings(scene({ configText: without(path) }));
    assert.deepEqual(named(found), [`config-invalid ${path}`]);
    assert.match(found.findings[0].detail, /^[^;]+ in site\/engine\.config\.json; .{20,}$/);
  });
}

for (const { path, kind } of anchorsFor(config)) {
  test(`a scene without ${path} names that anchor and nothing else`, () => {
    const found = engineFindings(scene({ skip: path }));
    const expected = path === WORKFLOW ? ['anchor-missing ' + path] : ['anchor-missing ' + path];
    assert.deepEqual(named(found), expected);
    assert.match(found.findings[0].detail, new RegExp(kind));
  });
}

for (const { path } of values) {
  test(`an interview without ${path} names that value and nothing else`, () => {
    const found = engineFindings(scene({ bankText: bankWithout(path) }));
    assert.deepEqual(named(found), [`interview-gap ${path}`]);
    assert.match(
      found.findings[0].detail,
      /^config value; no question in docs\/plan\/reference\/new-site-interview\.md names it/
    );
  });
}

test('a second site with no configuration is told every value to set, each with what it means', () => {
  const found = engineFindings(scene({ configText: null }));
  assert.deepEqual(found.findings[0].rule, 'config-missing');
  const unset = found.findings.filter(({ rule }) => rule === 'config-value-unset');
  assert.deepEqual(
    unset.map(({ where }) => where),
    values.map(({ path }) => path)
  );
  for (const { detail } of unset) assert.ok(detail.length > 20, detail);
  assert.equal(found.findings.length, values.length + 1);
});

test('a configuration that is not JSON is one finding at the root', () => {
  assert.deepEqual(named(engineFindings(scene({ configText: '{ "schema": 1,' }))), ['config-invalid $']);
});

test('a shipped directory the checkout lacks is named, because the classifier would not describe the repository', () => {
  const root = scene();
  rmSync(join(root, config.diff.shippedDirectories[0].replace(/\/$/, '')), { recursive: true });
  assert.ok(named(engineFindings(root)).includes(`shipped-directory-missing ${config.diff.shippedDirectories[0]}`));
});

test('a workflow that re-expresses the classifier is reported at the workflow', () => {
  const call = 'run: node scripts/run-classify-diff.mjs --before "$BEFORE" --after "$AFTER" >> "$GITHUB_OUTPUT"';
  assert.ok(REAL_WORKFLOW.includes(call));
  const found = engineFindings(
    scene({ workflowText: REAL_WORKFLOW.replace(call, 'run: case "$X" in docs/*) ;; esac') })
  );
  assert.deepEqual(
    named(found).sort(),
    [`classifier-not-called ${WORKFLOW}`, `classifier-reexpressed ${WORKFLOW}`].sort()
  );
});

test('an interview without a secret a workflow reads names that secret and nothing else', () => {
  const found = engineFindings(scene({ bankText: bankWithout('AUTOWRITER_PAT') }));
  assert.deepEqual(named(found), ['interview-gap AUTOWRITER_PAT']);
  assert.match(found.findings[0].detail, /^workflow secret; /);
});

test('an interview without a variable a workflow and the env example both read names it once, with both kinds', () => {
  const found = engineFindings(scene({ bankText: bankWithout('WRITING_TERM_CAP') }));
  assert.deepEqual(named(found), ['interview-gap WRITING_TERM_CAP']);
  assert.match(found.findings[0].detail, /^workflow variable, env example variable; /);
});

test('an interview without a variable only the env example names names that variable and nothing else', () => {
  const found = engineFindings(scene({ bankText: bankWithout('GSC_PROPERTY') }));
  assert.deepEqual(named(found), ['interview-gap GSC_PROPERTY']);
  assert.match(found.findings[0].detail, /^env example variable; /);
});

const SHIP_WORKFLOW = [
  'on: workflow_dispatch',
  'jobs:',
  '  ship:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - run: ./ship.sh',
  '        env:',
  '          SHIP_KEY: ${{ secrets.ZZ_NEW_SECRET }}',
  '',
].join('\n');

test('a workflow added later that reads a secret the interview never mentions is one finding until the interview names it', () => {
  const root = scene();
  writeFileSync(join(root, WORKFLOW_DIRECTORY, 'ship.yml'), SHIP_WORKFLOW);
  assert.deepEqual(named(engineFindings(root)), ['interview-gap ZZ_NEW_SECRET']);
  appendFileSync(join(root, INTERVIEW_PATH), '\nThe secret `ZZ_NEW_SECRET`.\n');
  assert.deepEqual(engineFindings(root).findings, []);
});

const run = (args, cwd) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });

test('the command passes on this repository from the repository root, from site and from anywhere', () => {
  for (const cwd of [REPOSITORY, join(REPOSITORY, 'site'), tmpdir()]) {
    const found = run([], cwd);
    assert.equal(found.status, 0, `from ${cwd}: ${found.stdout}${found.stderr}`);
    assert.match(found.stdout, /^engine: 0 findings /m);
    assert.match(found.stdout, /the interview must name every value, secret and variable\)$/m);
  }
});

test('the command exits non-zero and prints the missing value when one is removed', () => {
  const found = run(['--root', scene({ configText: without('loop.attemptCap') })], tmpdir());
  assert.equal(found.status, 1);
  assert.match(found.stdout, /^ENGINE config-invalid loop\.attemptCap: .*is required/m);
  assert.match(found.stdout, /^engine: 1 finding\b/m);
});

test('the command exits non-zero and lists every value to set when there is no configuration', () => {
  const found = run(['--root', scene({ configText: null })], tmpdir());
  assert.equal(found.status, 1);
  assert.equal([...found.stdout.matchAll(/^ENGINE config-value-unset /gm)].length, values.length);
  assert.match(found.stdout, new RegExp(`^engine: ${values.length + 1} findings`, 'm'));
});

test('the command exits non-zero, names what the interview misses and points at the interview', () => {
  const found = run(['--root', scene({ bankText: bankWithout('loop.claimLifetimeDays') })], tmpdir());
  assert.equal(found.status, 1);
  assert.match(
    found.stdout,
    /^ENGINE interview-gap loop\.claimLifetimeDays: config value; no question in docs\/plan\/reference\/new-site-interview\.md names it/m
  );
  assert.match(found.stdout, /^engine: 1 finding\b/m);
  assert.match(
    found.stdout,
    /^engine: the questions that set these values and create these files are in docs\/plan\/reference\/new-site-interview\.md$/m
  );
});

test('an unknown flag or a missing directory is a usage error: exit 2 and nothing on stdout', () => {
  for (const args of [['--verbose'], ['--root'], ['--root', join(tmpdir(), 'no-such-root-for-check-engine')]]) {
    const found = run(args, tmpdir());
    assert.equal(found.status, 2, args.join(' '));
    assert.equal(found.stdout, '');
    assert.match(found.stderr, /usage: node scripts\/check-engine\.mjs/);
  }
});

test('a run with findings points at the interview that answers them, and a clean run does not', () => {
  const failing = run(['--root', scene({ configText: null })], tmpdir());
  assert.match(
    failing.stdout,
    /^engine: the questions that set these values and create these files are in docs\/plan\/reference\/new-site-interview\.md$/m
  );
  const clean = run([], REPOSITORY);
  assert.doesNotMatch(clean.stdout, /new-site-interview/);
});
