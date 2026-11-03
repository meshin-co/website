import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { SEARCH_ORIGIN } from '../src/utils/archive-url.mjs';
import { sweepLinks } from './link-repair-sweep.mjs';
import { sealRegister } from './link-rot-register.mjs';
import { distPage } from './fixtures/link-rot-repo.mjs';
import { citing, GLOSSARY, NIST, world } from './fixtures/link-repair-world.mjs';

const SNAPSHOT = 'https://web.archive.org/web/20230302214609/' + NIST;
const sweep = (scene, changes = {}) => sweepLinks({ ...scene.inputs, ...changes });
const rowsOf = (result) => result.register.register?.rows ?? [];

function put(repo, path, text) {
  mkdirSync(dirname(join(repo.root, path)), { recursive: true });
  writeFileSync(join(repo.root, path), text);
}

test('a second run over the repaired tree finds nothing to change, writes nothing and asks the archive nothing', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() } });
  t.after(scene.repo.remove);
  const first = await sweep(scene);
  for (const [path, text] of first.files) put(scene.repo, path, text);
  put(scene.repo, 'site/dist/index.html', distPage([SNAPSHOT]));
  const requested = scene.archive.requests().length;

  const second = await sweep(scene, { existing: first.register.register });

  assert.equal(second.files.size, 0);
  assert.equal(second.register.changed, false);
  assert.deepEqual(second.counts, { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0 });
  assert.equal(scene.archive.requests().length, requested);
});

test('a second run over the same unrepaired tree finds the same thing, so a branch that was never merged is rebuilt the same way', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() } });
  t.after(scene.repo.remove);

  const first = await sweep(scene);
  const second = await sweep(scene);

  assert.deepEqual([...second.files], [...first.files]);
});

test('an entry the rewrite cannot edit in place makes its citation unplaced with the reason, and the other entries are still repaired', async (t) => {
  const flow =
    "---\ntitle: 'Flow style'\nshortAnswer: 'x'\nupdatedDate: 2023-03-01\nsources:\n  - { title: 'AI Risk Management Framework', url: '" +
    NIST +
    "', retrieved: 2023-03-01 }\n---\n\nBody.\n";
  const scene = world({
    files: { 'site/src/data/faq/a-flow-entry.md': flow, [GLOSSARY]: citing() },
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  const rows = rowsOf(result);
  const [unplaced] = rows.filter(({ outcome }) => outcome === 'unplaced');
  assert.equal(unplaced.original, NIST);
  assert.equal(unplaced.entry, null);
  assert.match(unplaced.why, /site\/src\/data\/faq\/a-flow-entry\.md: sources row 1 is not a block mapping/);
  assert.deepEqual(unplaced.pages, ['/']);
  const repaired = rows.find(({ outcome }) => outcome === 'archive');
  assert.equal(repaired.entry, GLOSSARY);
  assert.ok(result.files.has(GLOSSARY));
  assert.ok(!result.files.has('site/src/data/faq/a-flow-entry.md'));
  assert.deepEqual(result.counts, { dead: 1, archive: 1, search: 0, unplaced: 1, waiting: 0 });
});

test('an entry with no date to cite from makes its address unplaced with the reason, and the run goes on to the next address', async (t) => {
  const undated =
    "---\ntitle: 'No dates'\nshortAnswer: 'x'\nsources:\n  - title: 'AI Risk Management Framework'\n    url: '" +
    NIST +
    "'\n---\n\nBody.\n";
  const other = 'https://other.example/gone';
  const scene = world({
    files: { 'site/src/data/resource/undated.md': undated },
    dist: { 'index.html': [NIST, other] },
    verdicts: { [NIST]: 'dead', [other]: 'dead' },
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  const byAddress = new Map(rowsOf(result).map((row) => [row.original, row]));
  assert.equal(byAddress.get(NIST).outcome, 'unplaced');
  assert.match(
    byAddress.get(NIST).why,
    /neither the source row's retrieved date nor the updatedDate says when it was cited/
  );
  assert.equal(byAddress.get(other).outcome, 'unplaced');
  assert.match(byAddress.get(other).why, /no collection entry cites it/);
});

test('an archive call that throws does not stop the run: that citation is unplaced with the message, and the next one is repaired', async (t) => {
  const second = 'https://other.example/gone';
  const scene = world({
    files: { [GLOSSARY]: citing(), 'site/src/data/post/other.md': citing({ address: second }) },
    dist: { 'index.html': [NIST, second] },
    verdicts: { [NIST]: 'dead', [second]: 'dead' },
  });
  t.after(scene.repo.remove);
  let calls = 0;
  const inner = scene.inputs.closestSnapshot;
  const closestSnapshot = (options) => {
    calls += 1;
    if (options.url === second) throw new Error('the archive client crashed');
    return inner(options);
  };

  const result = await sweep(scene, { closestSnapshot });

  const byAddress = new Map(rowsOf(result).map((row) => [row.original, row]));
  assert.equal(calls, 2);
  assert.equal(byAddress.get(NIST).outcome, 'archive');
  assert.equal(byAddress.get(second).outcome, 'unplaced');
  assert.match(byAddress.get(second).why, /the repair of this citation failed: the archive client crashed/);
});

test('the day an address was first found dead is kept from the register that already knows it', async (t) => {
  const scene = world({ files: { [GLOSSARY]: citing() } });
  t.after(scene.repo.remove);
  const existing = sealRegister({
    updatedOn: '2026-10-20',
    rows: [
      {
        original: NIST,
        entry: 'site/src/data/post/earlier.md',
        outcome: 'search',
        replacement: SEARCH_ORIGIN + '?q=x',
        citedOn: '2023-03-01',
        firstSeenDead: '2026-10-20',
        why: 'an earlier repair',
      },
    ],
  });

  const result = await sweep(scene, { existing });

  const [fresh] = rowsOf(result).filter(({ entry }) => entry === GLOSSARY);
  assert.equal(fresh.firstSeenDead, '2026-10-20');
  assert.equal(rowsOf(result).length, 2, 'the earlier row is kept as history');
});

test('an unplaced row that nobody looked at this run stays, and one whose address answers again or left the build goes', async (t) => {
  const stays = 'https://unverified.example/x';
  const answers = 'https://back.example/x';
  const left = 'https://left.example/x';
  const row = (original) => ({
    original,
    entry: null,
    outcome: 'unplaced',
    replacement: null,
    citedOn: null,
    firstSeenDead: '2026-10-20',
    why: 'no collection entry cites it',
    pages: ['/'],
  });
  const existing = sealRegister({ updatedOn: '2026-10-20', rows: [row(stays), row(answers), row(left)] });
  const scene = world({
    files: {},
    dist: { 'index.html': [stays, answers, 'https://alive.example/y'] },
    verdicts: { [stays]: 'unverified' },
  });
  t.after(scene.repo.remove);

  const result = await sweep(scene, { existing });

  assert.deepEqual(
    rowsOf(result).map(({ original }) => original),
    [stays]
  );
  assert.equal(result.register.changed, true);
});

test('an unplaced address found again with the same words changes nothing, and keeps the day it was first found', async (t) => {
  const template = 'https://template.example/gone';
  const scene = world({ files: {}, dist: { 'index.html': [template] }, verdicts: { [template]: 'dead' } });
  t.after(scene.repo.remove);
  const first = await sweep(scene, { today: '2026-10-20' });

  const again = await sweep(scene, { existing: first.register.register, today: '2026-11-03' });

  assert.equal(again.register.changed, false);
  assert.equal(again.files.size, 0);
  assert.deepEqual(again.counts, { dead: 1, archive: 0, search: 0, unplaced: 1, waiting: 0 });
  assert.deepEqual(again.newUnplaced, []);
});

test('the unplaced rows this run found that the register did not already hold are named, so only news is escalated', async (t) => {
  const template = 'https://template.example/gone';
  const scene = world({ files: {}, dist: { 'index.html': [template] }, verdicts: { [template]: 'dead' } });
  t.after(scene.repo.remove);

  const result = await sweep(scene);

  assert.deepEqual(
    result.newUnplaced.map(({ original }) => original),
    [template]
  );
});
