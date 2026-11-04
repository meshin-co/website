import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { BRANCH, ENTRY, TITLE, startScene } from './fixtures/link-repair-e2e.mjs';
import { entryText } from './fixtures/link-rot-repo.mjs';
import { LIVE_PAGE, PARKED, registerRow, searchOf, searched } from './fixtures/reexamine-world.mjs';
import { REGISTER_PATH, registerProblems, registerText, sealRegister } from './link-rot-register.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';

const LOOPBACK_ONLY = join(import.meta.dirname, 'fixtures', 'loopback-only.mjs');
const PULL = 'https://github.com/meshin-co/website/pull/41';
const SEARCH = searchOf();
const NIST = 'NIST';

const lastLine = (text) => text.trim().split('\n').at(-1);
const answering = (page) => (req, res) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page);
const snapshotOf = (address) => `https://web.archive.org/web/20230302214609/${address}`;
const summary = ({ waiting = 0, restored = 0, upgraded = 0, pr = 'none' }) =>
  `repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=${waiting} watching=0 restored=${restored} upgraded=${upgraded} pr=${pr}`;
const entryOn = ({ url, original, address }) =>
  entryText({
    sources: [{ title: TITLE, url, original, publisher: NIST, retrieved: '2023-03-01' }],
    body: `See [the framework](${address}) for the detail.\n`,
  }).trim();

const files = (address) => ({
  [ENTRY]: searched({ original: address }),
  [REGISTER_PATH]: registerText(
    sealRegister({ updatedOn: '2026-10-21', rows: [registerRow({ original: address, entry: ENTRY })] })
  ),
});

async function searchScene(t, options = {}) {
  const scene = await startScene({ files, outbound: () => [SEARCH], ...options });
  t.after(scene.close);
  const before = { entry: scene.repo.read(ENTRY), register: scene.repo.read(REGISTER_PATH) };
  const run = () => scene.run({ nodeArgs: ['--import', LOOPBACK_ONLY] });
  return { ...scene, before, run };
}

function assertUntouched(scene, run, line) {
  assert.equal(run.code, 0, run.stderr);
  assert.deepEqual(scene.repo.remoteBranches(), ['main']);
  assert.equal(scene.github.created().length, 0);
  assert.equal(scene.repo.read(ENTRY), scene.before.entry);
  assert.equal(scene.repo.read(REGISTER_PATH), scene.before.register);
  assert.equal(scene.repo.git('status', '--porcelain'), '');
  assert.equal(lastLine(run.stdout), line);
}

test('end to end, a search row whose original answers again with its title goes back to the original in a pull request, and its register row goes', async (t) => {
  const scene = await searchScene(t, { respond: answering(LIVE_PAGE) });

  const run = await scene.run();

  assert.equal(run.code, 0, run.stderr);
  assert.deepEqual(scene.repo.remoteBranches(), [BRANCH, 'main']);
  assert.equal(scene.repo.remoteFile(BRANCH, ENTRY), entryOn({ url: scene.address, address: scene.address }));
  const register = JSON.parse(scene.repo.remoteFile(BRANCH, REGISTER_PATH));
  assert.deepEqual(registerProblems(register), []);
  assert.deepEqual(register.rows, []);
  assert.deepEqual(scene.repo.remoteLog(BRANCH)[0].split(' | ')[0], `${BOT_NAME} <${BOT_EMAIL}>`);
  assert.equal(scene.github.created().length, 1);
  const [pull] = scene.github.created();
  assert.equal(pull.body.title, 'fix(links): restore 1 citation from a search link (2026-11-03)');
  assert.ok(pull.body.body.includes(`${scene.address} went back to the address that was cited`), pull.body.body);
  assert.deepEqual(scene.archive.requests, [], 'a page that answers needs no capture');
  assert.equal(lastLine(run.stdout), summary({ restored: 1, pr: PULL }));
});

test('end to end, a search row whose original is still gone but has a usable capture now moves up to the archive, and its register row says archive', async (t) => {
  const scene = await searchScene(t);

  const run = await scene.run();

  assert.equal(run.code, 0, run.stderr);
  assert.deepEqual(scene.repo.remoteBranches(), [BRANCH, 'main']);
  const snapshot = snapshotOf(scene.address);
  assert.equal(
    scene.repo.remoteFile(BRANCH, ENTRY),
    entryOn({ url: snapshot, original: scene.address, address: snapshot })
  );
  const register = JSON.parse(scene.repo.remoteFile(BRANCH, REGISTER_PATH));
  assert.deepEqual(registerProblems(register), []);
  assert.deepEqual(
    register.rows.map((row) => ({ ...row, why: undefined })),
    [
      {
        original: scene.address,
        entry: ENTRY,
        outcome: 'archive',
        replacement: snapshot,
        citedOn: '2023-03-01',
        firstSeenDead: '2026-10-20',
        why: undefined,
      },
    ]
  );
  assert.match(register.rows[0].why, /capture of 2023-03-02 is 1 day from the citation date 2023-03-01/);
  assert.equal(scene.github.created()[0].body.title, 'fix(links): move 1 citation up from a search link (2026-11-03)');
  assert.equal(lastLine(run.stdout), summary({ upgraded: 1, pr: PULL }));
});

test('end to end, a search row whose original is still gone and whose archive holds nothing stays: exit 0, no branch, no pull request, entry and register untouched', async (t) => {
  const scene = await searchScene(t, { archive: { empty: true } });

  assertUntouched(scene, await scene.run(), summary({}));
  assert.ok(scene.archive.availability().length > 0, 'the archive was asked');
});

test('end to end, an original that answers with a parked page that lacks the title is not restored, and nothing is opened', async (t) => {
  const scene = await searchScene(t, { respond: answering(PARKED), archive: { empty: true } });

  assertUntouched(scene, await scene.run(), summary({}));
  assert.ok(scene.dead.count('GET') >= 2, 'the probe asked and the page was read');
});

test('end to end, an archive that does not answer changes nothing and the row is counted as waiting', async (t) => {
  const scene = await searchScene(t, { archive: { unavailable: true } });

  assertUntouched(scene, await scene.run(), summary({ waiting: 1 }));
});
