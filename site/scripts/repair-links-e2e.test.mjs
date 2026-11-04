import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import test from 'node:test';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { BRANCH, ENTRY, TITLE, TODAY, newestCapture, startScene } from './fixtures/link-repair-e2e.mjs';
import { registerProblems } from './link-rot-register.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';

const lastLine = (text) => text.trim().split('\n').at(-1);

test('end to end, a dead third-party address becomes the archive capture nearest the citation date, on a branch, in a pull request, with a register row', async (t) => {
  const scene = await startScene();
  t.after(scene.close);
  const snapshot = 'https://web.archive.org/web/20230302214609/' + scene.address;

  const run = await scene.run();

  assert.equal(run.code, 0, run.stderr);
  assert.deepEqual(scene.repo.remoteBranches(), [BRANCH, 'main']);
  const entry = scene.repo.remoteFile(BRANCH, ENTRY);
  assert.ok(entry.includes("url: '" + snapshot + "'"), entry);
  assert.ok(entry.includes("original: '" + scene.address + "'"), entry);
  assert.ok(entry.includes('](' + snapshot + ')'), 'the link in the prose follows the citation');
  assert.ok(!entry.includes(newestCapture().timestamp), 'the newest capture is a different document');
  assert.deepEqual(scene.repo.remoteLog(BRANCH)[0].split(' | ')[0], BOT_NAME + ' <' + BOT_EMAIL + '>');

  assert.equal(scene.github.created().length, 1);
  const [pull] = scene.github.created();
  assert.equal(pull.body.head, BRANCH);
  assert.equal(pull.body.base, 'main');
  assert.ok(pull.body.body.includes(snapshot));
  assert.equal(scene.github.dispatched().length, 1);

  const register = JSON.parse(scene.repo.remoteFile(BRANCH, 'audits/link-rot.json'));
  assert.deepEqual(registerProblems(register), []);
  assert.equal(register.rows.length, 1);
  assert.deepEqual(
    { ...register.rows[0], why: undefined },
    {
      original: scene.address,
      entry: ENTRY,
      outcome: 'archive',
      replacement: snapshot,
      citedOn: '2023-03-01',
      firstSeenDead: TODAY,
      why: undefined,
    }
  );
  assert.match(register.rows[0].why, /capture of 2023-03-02 is 1 day from the citation date 2023-03-01/);
  assert.equal(
    lastLine(run.stdout),
    'repair-links: dead=1 archive=1 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=https://github.com/meshin-co/website/pull/41'
  );
});

test('end to end, a second run while that pull request is open opens nothing and exits clean', async (t) => {
  const scene = await startScene();
  t.after(scene.close);
  await scene.run();

  const again = await scene.run();

  assert.equal(again.code, 0, again.stderr);
  assert.equal(scene.github.created().length, 1);
  assert.deepEqual(scene.repo.remoteBranches(), [BRANCH, 'main']);
  assert.match(
    lastLine(again.stdout),
    /pr=none \(pull request #41 \(autowriter\/link-rot-2026-11-03\) is still open, so nothing was checked\)$/
  );
});

test('end to end, an archive with no snapshot leaves the citation on the search link, the register says why, and the job still exits 0', async (t) => {
  const scene = await startScene({ archive: { empty: true } });
  t.after(scene.close);
  const search = searchFallbackUrl({ title: TITLE, publisher: 'NIST' });

  const run = await scene.run();

  assert.equal(run.code, 0, run.stderr);
  const entry = scene.repo.remoteFile(BRANCH, ENTRY);
  assert.ok(entry.includes("url: '" + search + "'"), entry);
  assert.ok(entry.includes("original: '" + scene.address + "'"), entry);
  const register = JSON.parse(scene.repo.remoteFile(BRANCH, 'audits/link-rot.json'));
  assert.deepEqual(registerProblems(register), []);
  assert.equal(register.rows[0].outcome, 'search');
  assert.equal(register.rows[0].replacement, search);
  assert.match(register.rows[0].why, /no usable Internet Archive capture: the archive holds no snapshot of /);
  assert.match(scene.github.created()[0].body.body, /a search page is not a source/i);
  assert.equal(
    lastLine(run.stdout),
    'repair-links: dead=1 archive=0 search=1 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=https://github.com/meshin-co/website/pull/41'
  );
});

test('end to end, a build that is not there is a job failure and not a clean run: exit 1, nothing pushed, nothing opened', async (t) => {
  const scene = await startScene();
  t.after(scene.close);
  rmSync(scene.repo.dist, { recursive: true, force: true });

  const run = await scene.run();

  assert.equal(run.code, 1);
  assert.match(run.stderr, /does not exist: build the site first/);
  assert.deepEqual(scene.repo.remoteBranches(), ['main']);
  assert.equal(scene.github.created().length, 0);
});
