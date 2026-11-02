import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

const GATE = join(import.meta.dirname, 'editorial-gate.mjs');
const REFUSAL =
  'refusing to re-seal the dispositions in an unattended run: a person at a terminal does this; AUTOWRITER_UNATTENDED is set';
const DISPOSITIONS = 'audits/phase-4.7/dispositions';
const STALE = [
  {
    target: 'src/data/glossary/zz-specimen.md',
    location: 'title',
    status: 'verified',
    reason: 'checked by a person',
    digest: 'aaaaaaaaaaaa',
  },
  {
    target: 'src/data/glossary/zz-other.md',
    location: 'title',
    status: 'rewritten',
    reason: 'rewritten by a person',
    digest: 'bbbbbbbbbbbb',
  },
];

const scenes = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) rmSync(scene, { recursive: true, force: true });
});

const scene = () => {
  const parent = mkdtempSync(join(tmpdir(), 'unattended-seal-'));
  scenes.push(parent);
  const repo = join(parent, 'repo');
  mkdirSync(join(repo, 'site/dist'), { recursive: true });
  writeFileSync(join(repo, 'site/dist/gate-routes.json'), JSON.stringify({ routes: [] }));
  const watched = [join(repo, DISPOSITIONS), join(parent, DISPOSITIONS)];
  for (const directory of watched) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'main.json'), `${JSON.stringify(STALE, null, 2)}\n`);
  }
  return { repo, site: join(repo, 'site'), watched };
};

const digests = (directories) =>
  Object.fromEntries(
    directories.flatMap((directory) =>
      readdirSync(directory).map((name) => [
        join(directory, name),
        createHash('sha256')
          .update(readFileSync(join(directory, name)))
          .digest('hex'),
      ])
    )
  );

const withoutMarker = () => {
  const env = { ...process.env };
  delete env.AUTOWRITER_UNATTENDED;
  return env;
};

const spawn = ({ cwd, args, marker }) =>
  spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    env: marker === undefined ? withoutMarker() : { ...withoutMarker(), AUTOWRITER_UNATTENDED: marker },
  });

const seal = (options) => spawn({ ...options, args: [GATE, '.', 'dist', '--seal'] });

for (const [where, place] of [
  ['site', (world) => world.site],
  ['the repository root', (world) => world.repo],
]) {
  for (const marker of ['1', 'true']) {
    test(`an unattended process cannot run the seal from ${where} when the marker is ${marker}, and no disposition changes`, () => {
      const world = scene();
      const before = digests(world.watched);

      const run = seal({ cwd: place(world), marker });

      assert.notEqual(run.status, 0, run.stdout);
      assert.equal(run.stderr, `${REFUSAL}\n`);
      assert.equal(run.stdout, '');
      assert.deepEqual(digests(world.watched), before);
    });
  }
}

test('the seal is a real writer here: without the marker it gets past the guard and rewrites the stale digests', () => {
  const world = scene();
  const before = digests(world.watched);

  const run = seal({ cwd: world.site });

  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /unattended run/);
  assert.match(run.stdout, /sealed 2 dispositions against the current text/);
  const file = join(world.watched[0], 'main.json');
  assert.notEqual(digests([world.watched[0]])[file], before[file]);
});

test('an unattended process that imports sealDispositions is refused too, and no disposition changes', () => {
  const world = scene();
  const before = digests(world.watched);

  const run = spawn({
    cwd: world.site,
    marker: '1',
    args: [
      '--input-type=module',
      '-e',
      `import { sealDispositions } from ${JSON.stringify(GATE)}; sealDispositions('dist');`,
    ],
  });

  assert.notEqual(run.status, 0, run.stdout);
  assert.match(run.stderr, /UnattendedRefusal: refusing to re-seal the dispositions in an unattended run/);
  assert.equal(run.stdout, '');
  assert.deepEqual(digests(world.watched), before);
});

test('the same import without the marker seals, so the guard is what stopped the one above', () => {
  const world = scene();

  const run = spawn({
    cwd: world.site,
    args: [
      '--input-type=module',
      '-e',
      `import { sealDispositions } from ${JSON.stringify(GATE)}; sealDispositions('dist');`,
    ],
  });

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /sealed 2 dispositions/);
});

test('the read-only report is not refused under the marker, so the refusal covers the seal and nothing else', () => {
  const world = scene();

  const run = spawn({ cwd: world.site, marker: '1', args: [GATE, '.', 'dist', '--check'] });

  assert.doesNotMatch(run.stderr, /unattended run/);
  assert.doesNotMatch(run.stdout, /unattended run/);
});
