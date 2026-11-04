import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { REPOSITORY, startGitHub } from './fixtures/github-host.mjs';
import { GLOSSARY, NIST, archive, citing, probes } from './fixtures/link-repair-world.mjs';
import { makeLinkRotRepo } from './fixtures/link-rot-repo.mjs';
import { lapseEvidence } from './link-rot-watch.mjs';
import { repairLinks, runCli } from './repair-links.mjs';

const realFetch = globalThis.fetch;
const HOST = 'www.nist.gov';
const DAYS = ['2026-11-01', '2026-11-02', '2026-11-03'];
const NO_WATCH_LINE =
  'repair-links: no watch file is configured (--watch or REPAIR_LINKS_WATCH), so nothing is remembered between runs and a host name that stops resolving is never counted dead';
const entry = (firstSeen, lastSeen, runs) => ({ firstSeen, lastSeen, runs });
const WITNESS = 'https://witness.example/ok';
const NO_WITNESS_LINE =
  "repair-links: no host answered this run, so the network or the resolver may be down; no host's count moved";

async function scene(
  t,
  { verdicts = { [NIST]: 'unresolved' }, github = {}, archiveOptions = {}, pages = [NIST, WITNESS] } = {}
) {
  const fake = await startGitHub(github);
  const repo = makeLinkRotRepo({ files: { [GLOSSARY]: citing() }, dist: { 'index.html': pages } });
  const scratch = mkdtempSync(join(tmpdir(), 'repair-links-watch-'));
  const watchPath = join(scratch, 'state', 'watch.json');
  t.after(async () => {
    await fake.close();
    repo.remove();
    rmSync(scratch, { recursive: true, force: true });
  });
  const check = probes(verdicts);
  const archived = archive(archiveOptions);
  const lines = [];
  const options = {
    repoRoot: repo.root,
    env: { GITHUB_REPOSITORY: REPOSITORY, GITHUB_API_URL: fake.origin, AUTOWRITER_PAT: 'token' },
    fetch: (url, init) => {
      assert.ok(String(url).startsWith(fake.origin), 'only the fake GitHub may be reached: ' + url);
      return realFetch(url, init);
    },
    probeAll: check.probeAll,
    closestSnapshot: archived.closestSnapshot,
    readSnapshot: archived.readSnapshot,
    sleep: archived.sleep,
    spacingMs: 0,
    out: (line) => lines.push(line),
  };
  const run = (today, changes = {}) => repairLinks({ ...options, today, watchPath, ...changes });
  const state = () => JSON.parse(readFileSync(watchPath, 'utf8'));
  const seed = (text) => {
    mkdirSync(dirname(watchPath), { recursive: true });
    writeFileSync(watchPath, text);
  };
  return { fake, repo, lines, run, state, seed, watchPath, options, scratch };
}

test('a name that does not resolve is watched on the first two days with nothing changed and nothing opened, and repaired on the third', async (t) => {
  const { fake, repo, lines, run, state } = await scene(t);

  await run(DAYS[0]);
  assert.deepEqual(state().hosts, { [HOST]: entry(DAYS[0], DAYS[0], 1) });
  await run(DAYS[1]);
  assert.deepEqual(state().hosts, { [HOST]: entry(DAYS[0], DAYS[1], 2) });

  assert.deepEqual(repo.remoteBranches(), ['main']);
  assert.equal(fake.created().length, 0);
  assert.equal(repo.git('status', '--porcelain'), '');
  assert.deepEqual(
    lines.filter((line) => line.startsWith('repair-links: dead=')),
    [
      'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=1 restored=0 upgraded=0 pr=none',
      'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=1 restored=0 upgraded=0 pr=none',
    ]
  );

  const done = await run(DAYS[2]);

  assert.deepEqual(repo.remoteBranches(), ['autowriter/link-rot-' + DAYS[2], 'main']);
  assert.equal(fake.created().length, 1);
  const body = fake.created()[0].body.body;
  assert.ok(body.includes(lapseEvidence({ host: HOST, runs: 3, firstSeen: DAYS[0], lastSeen: DAYS[2] })), body);
  assert.match(body, /## Hosts that no longer resolve/);
  const register = JSON.parse(repo.remoteFile('autowriter/link-rot-' + DAYS[2], 'audits/link-rot.json'));
  assert.equal(register.rows[0].firstSeenDead, DAYS[0]);
  assert.match(register.rows[0].why, /^the host name www\.nist\.gov did not resolve on 3 consecutive scheduled runs/);
  assert.deepEqual(state().hosts, {});
  assert.equal(
    lines.at(-1),
    'repair-links: dead=1 archive=1 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=' +
      done.pullRequest
  );
});

test('each host that is on watch is named on stdout before the summary line, with how far its count has got', async (t) => {
  const { lines, run } = await scene(t);

  await run(DAYS[0]);

  assert.deepEqual(lines.slice(-2), [
    'repair-links: watching ' + HOST + ': it did not resolve on 1 of 3 consecutive scheduled runs, since ' + DAYS[0],
    'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=1 restored=0 upgraded=0 pr=none',
  ]);
});

test('with no watch file configured nothing is remembered and nothing is repaired on a name that does not resolve, and stdout says so', async (t) => {
  const { fake, repo, lines, run, watchPath } = await scene(t);

  for (const day of DAYS) await run(day, { watchPath: '' });

  assert.equal(lines.filter((line) => line === NO_WATCH_LINE).length, 3);
  assert.ok(!existsSync(watchPath));
  assert.deepEqual(repo.remoteBranches(), ['main']);
  assert.equal(fake.created().length, 0);
  assert.equal(
    lines.at(-1),
    'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=none'
  );
});

test('a watch file that is not there yet is said so, and the run goes on with an empty state', async (t) => {
  const { lines, run, state } = await scene(t);

  await run(DAYS[0]);

  assert.ok(
    lines.some((line) => /^repair-links: the watch file .*watch\.json does not exist yet/.test(line)),
    lines.join('\n')
  );
  assert.deepEqual(state().hosts, { [HOST]: entry(DAYS[0], DAYS[0], 1) });
});

test('a watch file that is corrupt is said so and treated as empty, so it can never make a name dead, and the run writes a good one', async (t) => {
  const { fake, repo, lines, run, state, seed } = await scene(t);
  seed('{ "schema": 1, "hosts": { "' + HOST + '": { "firstSeen": "2026-10-01", "lastSeen": "2026-10-02", "runs": 9 } ');

  await run(DAYS[2]);

  assert.ok(
    lines.some((line) => /watch file .* is not JSON .* treated as empty/.test(line)),
    lines.join('\n')
  );
  assert.equal(fake.created().length, 0);
  assert.deepEqual(repo.remoteBranches(), ['main']);
  assert.deepEqual(state().hosts, { [HOST]: entry(DAYS[2], DAYS[2], 1) });
});

test('a run that finds and repairs nothing still writes the state file, with the entry of a host that answered gone', async (t) => {
  const { fake, run, state, seed } = await scene(t, { verdicts: {} });
  seed(JSON.stringify({ schema: 1, hosts: { [HOST]: entry(DAYS[0], DAYS[1], 2) } }));

  await run(DAYS[2]);

  assert.deepEqual(state(), { schema: 1, hosts: {} });
  assert.equal(fake.created().length, 0);
});

test('a run that stops because a repair pull request is open leaves the watch file exactly as it was, and does not make one', async (t) => {
  const { run, seed, watchPath } = await scene(t, { github: { openBranches: ['autowriter/link-rot-2026-10-30'] } });

  await run(DAYS[1]);
  assert.ok(!existsSync(watchPath));
  const text = JSON.stringify({ schema: 1, hosts: { [HOST]: entry(DAYS[0], DAYS[0], 1) } }, null, 2) + '\n';
  seed(text);
  await run(DAYS[2]);

  assert.equal(readFileSync(watchPath, 'utf8'), text);
});

test('a pull request that GitHub refuses does not use up the streak: the file still says two runs, so the next day tries again', async (t) => {
  const { run, state, seed } = await scene(t, { github: { refuse: { 'POST pulls': 500 } } });
  seed(JSON.stringify({ schema: 1, hosts: { [HOST]: entry(DAYS[0], DAYS[1], 2) } }));

  await assert.rejects(run(DAYS[2]), /was pushed, but the pull request or the watcher failed/);

  assert.deepEqual(state().hosts, { [HOST]: entry(DAYS[0], DAYS[1], 2) });
});

test('the watch file is named by --watch on the command line, or by REPAIR_LINKS_WATCH, and the flag wins', async (t) => {
  const { repo, options, scratch } = await scene(t);
  const [flagged, environmental] = [join(scratch, 'flag.json'), join(scratch, 'env.json')];
  const cli = (argv, env = {}) =>
    runCli(['--repo-root', repo.root, '--today', DAYS[0], ...argv], {
      ...options,
      env: { ...options.env, ...env },
      stdout: () => {},
      stderr: () => {},
    });

  assert.equal(await cli(['--watch', flagged]), 0);
  assert.equal(await cli([], { REPAIR_LINKS_WATCH: environmental }), 0);
  assert.equal(await cli(['--watch', flagged], { REPAIR_LINKS_WATCH: join(scratch, 'ignored.json') }), 0);

  assert.ok(existsSync(flagged) && existsSync(environmental));
  assert.ok(!existsSync(join(scratch, 'ignored.json')));
});

test('--watch without a file is a usage error with its own exit code, and the usage line names the flag', async () => {
  const errors = [];

  const code = await runCli(['--watch'], { stdout: () => {}, stderr: (line) => errors.push(line) });

  assert.equal(code, 2);
  assert.match(errors[0], /Usage: node scripts\/repair-links\.mjs .*\[--watch <file>\]/);
});

test('a run in which no host answered prints one plain line, moves no count, repairs nothing even on a third day, and writes the file as it was', async (t) => {
  const { fake, repo, lines, run, seed, watchPath } = await scene(t, { pages: [NIST] });
  const before = JSON.stringify({ schema: 1, hosts: { [HOST]: entry(DAYS[0], DAYS[1], 2) } }, null, 2) + '\n';
  seed(before);

  await run(DAYS[2]);

  assert.equal(lines.filter((line) => line === NO_WITNESS_LINE).length, 1);
  assert.equal(readFileSync(watchPath, 'utf8'), before);
  assert.deepEqual(repo.remoteBranches(), ['main']);
  assert.equal(fake.created().length, 0);
  assert.ok(!lines.some((line) => line.startsWith('repair-links: watching ')));
  assert.equal(
    lines.at(-1),
    'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=none'
  );
});

test('a run in which another host answered does not say it had no witness', async (t) => {
  const { lines, run } = await scene(t);

  await run(DAYS[0]);

  assert.ok(!lines.includes(NO_WITNESS_LINE), lines.join('\n'));
});
