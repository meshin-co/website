import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { startHost } from './fixtures/http-host.mjs';
import { BRANCH, ENTRY, TITLE, startScene } from './fixtures/link-repair-e2e.mjs';
import { registerProblems } from './link-rot-register.mjs';
import { lapseEvidence } from './link-rot-watch.mjs';

const PRELOAD = join(import.meta.dirname, 'fixtures', 'dns-lapse.mjs');
const SUFFIX = '.dns-watch.test';
const LAPSED_HOST = `lapsed${SUFFIX}`;
const DAYS = ['2026-11-01', '2026-11-02', '2026-11-03'];
const WATCHING_ONE =
  'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=1 restored=0 upgraded=0 pr=none';
const NOTHING = 'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=none';
const PULL = 'https://github.com/meshin-co/website/pull/41';
const HEALTHY_HOST = `healthy${SUFFIX}`;
const NO_WITNESS_LINE =
  "repair-links: no host answered this run, so the network or the resolver may be down; no host's count moved";

const lastLine = (text) => text.trim().split('\n').at(-1);
const entryOf = (firstSeen, lastSeen, runs) => ({ firstSeen, lastSeen, runs });
const loopbackOf = (origin) => new URL(origin).hostname.replace(/^\[|\]$/g, '');
const answers = (req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('<html><body>back</body></html>');
const healthyAnswers = (req, res) => res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');

async function startDnsScene(options = {}) {
  const healthy = await startHost(healthyAnswers);
  const healthyAddress = `http://${HEALTHY_HOST}:${new URL(healthy.origin).port}/healthy`;
  const scene = await startScene({ host: LAPSED_HOST, outbound: (address) => [address, healthyAddress], ...options });
  const directory = mkdtempSync(join(tmpdir(), 'repair-links-dns-'));
  const watchPath = join(directory, 'state', 'watch.json');
  const loopback = loopbackOf(healthy.origin);
  const resolving = (...hosts) => hosts.map((host) => `${host}=${loopback}`).join(',');
  const runOn = (today, { resolves = false, down = false, viaEnvironment = false } = {}) =>
    scene.run({
      today,
      nodeArgs: ['--import', PRELOAD],
      args: viaEnvironment ? [] : ['--watch', watchPath],
      env: {
        DNS_LAPSE_SUFFIX: SUFFIX,
        ...(down ? {} : { DNS_LAPSE_RESOLVE: resolving(...(resolves ? [LAPSED_HOST, HEALTHY_HOST] : [HEALTHY_HOST])) }),
        ...(viaEnvironment ? { REPAIR_LINKS_WATCH: watchPath } : {}),
      },
    });
  const seed = (content) => {
    mkdirSync(dirname(watchPath), { recursive: true });
    writeFileSync(watchPath, content);
  };
  const close = async () => {
    await scene.close();
    await healthy.close();
    rmSync(directory, { recursive: true, force: true });
  };
  return { ...scene, healthy, runOn, seed, close, watchPath, state: () => JSON.parse(readFileSync(watchPath, 'utf8')) };
}

async function watchTwoDays(scene) {
  const first = await scene.runOn(DAYS[0]);
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /the watch file .*watch\.json does not exist yet/);
  assert.equal(lastLine(first.stdout), WATCHING_ONE);
  assert.deepEqual(scene.state().hosts, { [LAPSED_HOST]: entryOf(DAYS[0], DAYS[0], 1) });

  const second = await scene.runOn(DAYS[1]);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(lastLine(second.stdout), WATCHING_ONE);
  assert.deepEqual(scene.state().hosts, { [LAPSED_HOST]: entryOf(DAYS[0], DAYS[1], 2) });

  assert.deepEqual(scene.repo.remoteBranches(), ['main'], 'no branch is pushed on a run that only watches');
  assert.equal(scene.github.created().length, 0);
  assert.equal(scene.repo.git('status', '--porcelain'), '');
  assert.equal(scene.dead.requests.length, 0, 'the name never resolved, so no request ever reached the host');
  assert.equal(scene.healthy.count('GET'), 2, 'the healthy host answered on each of the two runs: it is the witness');
}

describe('end to end, a host name that stops resolving', { concurrency: true }, () => {
  it('is watched on two scheduled runs with nothing pushed, then repaired from the archive on the third, in one pull request that names the evidence', async (t) => {
    const scene = await startDnsScene();
    t.after(scene.close);
    await watchTwoDays(scene);
    const snapshot = 'https://web.archive.org/web/20230302214609/' + scene.address;

    const third = await scene.runOn(DAYS[2]);

    assert.equal(third.code, 0, third.stderr);
    assert.deepEqual(scene.repo.remoteBranches(), [BRANCH, 'main']);
    const entry = scene.repo.remoteFile(BRANCH, ENTRY);
    assert.ok(entry.includes("url: '" + snapshot + "'"), entry);
    assert.ok(entry.includes("original: '" + scene.address + "'"), entry);
    assert.equal(scene.github.created().length, 1);
    const { body } = scene.github.created()[0].body;
    assert.ok(
      body.includes(lapseEvidence({ host: LAPSED_HOST, runs: 3, firstSeen: DAYS[0], lastSeen: DAYS[2] })),
      body
    );
    assert.match(body, /## Hosts that no longer resolve/);
    const register = JSON.parse(scene.repo.remoteFile(BRANCH, 'audits/link-rot.json'));
    assert.deepEqual(registerProblems(register), []);
    assert.equal(register.rows[0].outcome, 'archive');
    assert.equal(register.rows[0].firstSeenDead, DAYS[0]);
    assert.match(
      register.rows[0].why,
      /^the host name lapsed\.dns-watch\.test did not resolve on 3 consecutive scheduled runs, from 2026-11-01 to 2026-11-03; the Internet Archive capture of 2023-03-02/
    );
    assert.deepEqual(scene.state().hosts, {}, 'a host that was repaired is dropped from the watch file');
    assert.equal(scene.dead.requests.length, 0);
    assert.equal(
      lastLine(third.stdout),
      `repair-links: dead=1 archive=1 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=${PULL}`
    );
  });

  it('is repaired with the search link on the third run when the archive holds nothing, and the pull request still names the evidence', async (t) => {
    const scene = await startDnsScene({ archive: { empty: true } });
    t.after(scene.close);
    await watchTwoDays(scene);
    const search = searchFallbackUrl({ title: TITLE, publisher: 'NIST' });

    const third = await scene.runOn(DAYS[2]);

    assert.equal(third.code, 0, third.stderr);
    const entry = scene.repo.remoteFile(BRANCH, ENTRY);
    assert.ok(entry.includes("url: '" + search + "'"), entry);
    assert.ok(entry.includes("original: '" + scene.address + "'"), entry);
    const register = JSON.parse(scene.repo.remoteFile(BRANCH, 'audits/link-rot.json'));
    assert.deepEqual(registerProblems(register), []);
    assert.equal(register.rows[0].outcome, 'search');
    assert.match(
      register.rows[0].why,
      /^the host name lapsed\.dns-watch\.test did not resolve on 3 consecutive scheduled runs, from 2026-11-01 to 2026-11-03; no usable Internet Archive capture: the archive holds no snapshot of /
    );
    assert.match(
      scene.github.created()[0].body.body,
      /did not resolve on 3 consecutive scheduled runs, from 2026-11-01 to 2026-11-03/
    );
    assert.deepEqual(scene.state().hosts, {});
    assert.equal(
      lastLine(third.stdout),
      `repair-links: dead=1 archive=0 search=1 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=${PULL}`
    );
  });

  it('comes back on the second day, is forgotten at once with nothing ever committed, and when it goes again its count starts at one', async (t) => {
    const scene = await startDnsScene({ respond: answers });
    t.after(scene.close);
    const gone = await scene.runOn(DAYS[0]);
    assert.equal(lastLine(gone.stdout), WATCHING_ONE);
    assert.deepEqual(scene.state().hosts, { [LAPSED_HOST]: entryOf(DAYS[0], DAYS[0], 1) });

    const back = await scene.runOn(DAYS[1], { resolves: true });

    assert.equal(back.code, 0, back.stderr);
    assert.equal(lastLine(back.stdout), NOTHING);
    assert.deepEqual(scene.state(), { schema: 1, hosts: {} });
    assert.deepEqual(scene.repo.remoteBranches(), ['main']);
    assert.equal(scene.repo.remoteLog('main').length, 1, 'nothing was ever committed after the seed');
    assert.equal(scene.github.created().length, 0);
    assert.equal(scene.dead.count('GET'), 1);

    const again = await scene.runOn(DAYS[2]);

    assert.equal(lastLine(again.stdout), WATCHING_ONE);
    assert.deepEqual(scene.state().hosts, { [LAPSED_HOST]: entryOf(DAYS[2], DAYS[2], 1) });
    assert.deepEqual(scene.repo.remoteBranches(), ['main']);
  });
  it('on a run in which no name resolves at all moves no count and repairs nothing, even on what would have been the third day, and says that no host answered', async (t) => {
    const scene = await startDnsScene();
    t.after(scene.close);

    const first = await scene.runOn(DAYS[0], { down: true });

    assert.equal(first.code, 0, first.stderr);
    assert.equal(lastLine(first.stdout), NOTHING);
    assert.ok(first.stdout.split('\n').includes(NO_WITNESS_LINE), first.stdout);
    assert.deepEqual(scene.state(), { schema: 1, hosts: {} });

    const held = JSON.stringify({ schema: 1, hosts: { [LAPSED_HOST]: entryOf(DAYS[0], DAYS[1], 2) } }, null, 2) + '\n';
    scene.seed(held);
    const third = await scene.runOn(DAYS[2], { down: true });

    assert.equal(third.code, 0, third.stderr);
    assert.equal(lastLine(third.stdout), NOTHING);
    assert.ok(third.stdout.split('\n').includes(NO_WITNESS_LINE), third.stdout);
    assert.equal(readFileSync(scene.watchPath, 'utf8'), held, 'the state file is byte for byte what it was');
    assert.deepEqual(scene.repo.remoteBranches(), ['main']);
    assert.equal(scene.github.created().length, 0);
    assert.equal(scene.healthy.requests.length, 0, 'no name resolved, so no request reached any host');
    assert.equal(scene.dead.requests.length, 0);
  });
});
