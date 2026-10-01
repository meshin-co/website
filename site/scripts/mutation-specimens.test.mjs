import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  SPECIMENS,
  addFile,
  addUntrackedFile,
  assertStandaloneRepo,
  editFile,
  flatten,
  proveWithSpecimen,
} from './mutation-specimens.mjs';

const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;

const scripted = (...outcomes) => {
  const calls = [];
  const run = async (...args) => {
    calls.push(args);
    return outcomes.shift();
  };
  return { run, calls };
};

const specimen = (restored) => ({
  gate: 'gate:html',
  token: 'no-dup-id',
  plant: async () => async () => restored.push(true),
});

const scratch = () => mkdtempSync(join(tmpdir(), 'specimens-test-'));

test('a gate that is red before the specimen is planted proves nothing, and says so', async () => {
  const { run } = scripted({ code: 1, output: 'already failing' });
  const restored = [];
  const result = await proveWithSpecimen(specimen(restored), { copySite: '/copy', run });
  assert.equal(result.ok, false);
  assert.match(result.reason, /already red on the pristine copy/);
  assert.deepEqual(restored, []);
});

test('a gate that stays green on the specimen fails the family', async () => {
  const { run } = scripted({ code: 0, output: '' }, { code: 0, output: 'all fine' });
  const restored = [];
  const result = await proveWithSpecimen(specimen(restored), { copySite: '/copy', run });
  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed green/);
  assert.deepEqual(restored, [true]);
});

test('a gate that goes red for another reason fails the family, because the token names the rule', async () => {
  const { run } = scripted({ code: 0, output: '' }, { code: 1, output: 'crashed: ENOENT' });
  const result = await proveWithSpecimen(specimen([]), { copySite: '/copy', run });
  assert.equal(result.ok, false);
  assert.match(result.reason, /wrong reason/);
});

test('green before, red with the token after, restored either way: proven', async () => {
  const { run, calls } = scripted({ code: 0, output: '' }, { code: 1, output: 'error  Duplicate ID  no-dup-id' });
  const restored = [];
  const result = await proveWithSpecimen(specimen(restored), { copySite: '/copy', run });
  assert.equal(result.ok, true);
  assert.deepEqual(restored, [true]);
  assert.deepEqual(calls[1], ['npm', ['run', 'gate:html'], '/copy']);
});

test('a specimen that carries an environment runs the gate through env, so the variables reach npm', async () => {
  const { run, calls } = scripted({ code: 0, output: '' }, { code: 1, output: 'no-dup-id' });
  const withEnv = { ...specimen([]), env: { LH_ONLY_ROUTES: 'only.json' } };
  await proveWithSpecimen(withEnv, { copySite: '/copy', run });
  assert.deepEqual(calls[0], ['env', ['LH_ONLY_ROUTES=only.json', 'npm', 'run', 'gate:html'], '/copy']);
});

test('a specimen that carries arguments hands them to the tool after a double dash, whole and in order', async () => {
  const { run, calls } = scripted({ code: 0, output: '' }, { code: 1, output: 'no-dup-id' });
  const withArgs = { ...specimen([]), args: ['--project=desktop', '--grep', '(/about|/zz) has no violations'] };
  await proveWithSpecimen(withArgs, { copySite: '/copy', run });
  assert.deepEqual(calls[0], [
    'npm',
    ['run', 'gate:html', '--', '--project=desktop', '--grep', '(/about|/zz) has no violations'],
    '/copy',
  ]);
});

test('arguments and environment together reach the same command, environment first', async () => {
  const { run, calls } = scripted({ code: 0, output: '' }, { code: 1, output: 'no-dup-id' });
  const both = { ...specimen([]), env: { CI: '1' }, args: ['--project=desktop'] };
  await proveWithSpecimen(both, { copySite: '/copy', run });
  assert.deepEqual(calls[1], ['env', ['CI=1', 'npm', 'run', 'gate:html', '--', '--project=desktop'], '/copy']);
});

test('a token the green run already prints proves nothing, so the specimen is refused before it is planted', async () => {
  const { run } = scripted({ code: 0, output: 'html: 105 pages, no-dup-id rule enabled' });
  const restored = [];
  const result = await proveWithSpecimen(specimen(restored), { copySite: '/copy', run });
  assert.equal(result.ok, false);
  assert.match(result.reason, /already prints "no-dup-id" on the pristine copy/);
  assert.deepEqual(restored, []);
});

test('the token is matched across line breaks and colour codes, because gates wrap and colour their output', async () => {
  const coloured = `${String.fromCharCode(27)}[31merror${String.fromCharCode(27)}[0m  no-dup-id\n   again`;
  const { run } = scripted({ code: 0, output: '' }, { code: 1, output: coloured });
  const result = await proveWithSpecimen(specimen([]), { copySite: '/copy', run });
  assert.equal(result.ok, true);
  assert.equal(flatten(coloured), 'error no-dup-id again');
});

test('a specimen is restored even when the gate run throws', async () => {
  const restored = [];
  let calls = 0;
  const run = async () => {
    calls += 1;
    if (calls === 2) throw new Error('spawn failed');
    return { code: 0, output: '' };
  };
  await assert.rejects(proveWithSpecimen(specimen(restored), { copySite: '/copy', run }), /spawn failed/);
  assert.deepEqual(restored, [true]);
});

test('an edit that changes nothing is refused, so a drifted anchor fails loud instead of proving a no-op', async () => {
  const dir = scratch();
  try {
    const path = join(dir, 'file.txt');
    writeFileSync(path, 'alpha');
    await assert.rejects(
      editFile(path, (text) => text.replace('missing-anchor', 'x')),
      /changed nothing/
    );
    assert.equal(readFileSync(path, 'utf8'), 'alpha');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an edit is undone byte for byte by the restorer it returns', async () => {
  const dir = scratch();
  try {
    const path = join(dir, 'file.txt');
    writeFileSync(path, 'alpha');
    const restore = await editFile(path, (text) => `${text}-planted`);
    assert.equal(readFileSync(path, 'utf8'), 'alpha-planted');
    await restore();
    assert.equal(readFileSync(path, 'utf8'), 'alpha');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const trackedIn = (repo) => execFileSync('git', ['ls-files'], { cwd: repo, encoding: 'utf8' }).trim();

test('an added file is tracked while planted and leaves no file, no directory and no index entry behind', async () => {
  const repo = scratch();
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    const path = join(repo, 'investigation/nested/zz.md');
    const restore = await addFile(path, 'planted');
    assert.equal(readFileSync(path, 'utf8'), 'planted');
    assert.equal(trackedIn(repo), 'investigation/nested/zz.md');
    await restore();
    assert.equal(existsSync(join(repo, 'investigation')), false);
    assert.equal(trackedIn(repo), '');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('an added file never removes a directory that existed before the plant', async () => {
  const repo = scratch();
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    mkdirSync(join(repo, 'audits'));
    writeFileSync(join(repo, 'audits/keep.md'), 'kept');
    const restore = await addFile(join(repo, 'audits/zz.md'), 'planted');
    await restore();
    assert.equal(existsSync(join(repo, 'audits/zz.md')), false);
    assert.equal(readFileSync(join(repo, 'audits/keep.md'), 'utf8'), 'kept');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

const commitIn = (repo) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x'], {
    cwd: repo,
  });

test('a repository that owns its git directory passes the isolation check', () => {
  const repo = scratch();
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    assert.doesNotThrow(() => assertStandaloneRepo(repo));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a linked worktree is refused, because staging a specimen there would reach the repository it was made from', () => {
  const root = scratch();
  try {
    const main = join(root, 'main');
    mkdirSync(main);
    execFileSync('git', ['init', '-q'], { cwd: main });
    commitIn(main);
    const linked = join(root, 'linked');
    execFileSync('git', ['worktree', 'add', '-q', linked], { cwd: main });
    assert.throws(() => assertStandaloneRepo(linked), /lies outside/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a copy with no git directory at all is refused loudly, never skipped', () => {
  const bare = scratch();
  try {
    assert.throws(() => assertStandaloneRepo(bare), /not a git repository/);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

const isIgnored = (repo, path) => {
  try {
    execFileSync('git', ['check-ignore', '-q', path], { cwd: repo });
    return true;
  } catch {
    return false;
  }
};

test('an untracked plant is never staged, so the ignore rule that matches it still applies', async () => {
  const repo = scratch();
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    writeFileSync(join(repo, '.gitignore'), 'audits/phase-local/\n');
    const path = join(repo, 'audits/phase-local/zz.json');
    const restore = await addUntrackedFile(path, '[]');
    assert.equal(readFileSync(path, 'utf8'), '[]');
    assert.equal(trackedIn(repo), '');
    assert.equal(isIgnored(repo, 'audits/phase-local/zz.json'), true);
    await restore();
    assert.equal(existsSync(join(repo, 'audits')), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('restoring an untracked plant removes only the file when its directory was already there', async () => {
  const repo = scratch();
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    mkdirSync(join(repo, 'audits/phase-local'), { recursive: true });
    writeFileSync(join(repo, 'audits/phase-local/keep.json'), 'kept');
    const restore = await addUntrackedFile(join(repo, 'audits/phase-local/zz.json'), '[]');
    await restore();
    assert.equal(existsSync(join(repo, 'audits/phase-local/zz.json')), false);
    assert.equal(readFileSync(join(repo, 'audits/phase-local/keep.json'), 'utf8'), 'kept');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('every specimen names a gate the package defines, a token to look for and a plant to run', () => {
  assert.ok(Object.keys(SPECIMENS).length > 0);
  for (const [name, entry] of Object.entries(SPECIMENS)) {
    assert.ok(entry.gate in scripts, `${name} names ${entry.gate}, which package.json does not define`);
    assert.match(entry.gate, /^gate:/, `${name} proves ${entry.gate}, which is not a gate`);
    assert.ok(typeof entry.token === 'string' && entry.token.trim().length > 0, `${name} has no token`);
    assert.equal(typeof entry.plant, 'function', `${name} has no plant`);
  }
});

test('the pending-phase specimens plant an entry the real pending module then exports, and restore it', async () => {
  const copySite = scratch();
  try {
    mkdirSync(join(copySite, 'scripts'));
    const target = join(copySite, 'scripts/mutation-pending.mjs');
    writeFileSync(target, readFileSync(new URL('./mutation-pending.mjs', import.meta.url)));
    const before = readFileSync(target, 'utf8');

    const restore = await SPECIMENS.pendingUnknownPhase.plant(copySite);
    const planted = await import(`${pathToFileURL(target).href}?planted`);
    assert.ok(planted.PENDING.some((entry) => entry.phase === 'phase-99' && entry.gate === 'gate:zz-specimen'));

    await restore();
    assert.equal(readFileSync(target, 'utf8'), before);

    await SPECIMENS.pendingPhaseDone.plant(copySite);
    const doneVariant = await import(`${pathToFileURL(target).href}?done`);
    assert.ok(doneVariant.PENDING.some((entry) => entry.phase === 'phase-0'));
  } finally {
    rmSync(copySite, { recursive: true, force: true });
  }
});
