import assert from 'node:assert/strict';
import test from 'node:test';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { REPOSITORY, startGitHub } from './fixtures/github-host.mjs';
import { makeLinkRotRepo } from './fixtures/link-rot-repo.mjs';
import { EMPTY_ADDRESS, GLOSSARY, NIST, TITLE, TODAY, archive, citing, probes } from './fixtures/link-repair-world.mjs';
import { repairLinks, runCli } from './repair-links.mjs';

const realFetch = globalThis.fetch;
const BRANCH = 'autowriter/link-rot-' + TODAY;

async function scene(
  t,
  {
    files = { [GLOSSARY]: citing() },
    dist = { 'index.html': [NIST] },
    verdicts = { [NIST]: 'dead' },
    github = {},
    env = {},
    archiveOptions = {},
  } = {}
) {
  const fake = await startGitHub(github);
  const repo = makeLinkRotRepo({ files, dist });
  t.after(async () => {
    await fake.close();
    repo.remove();
  });
  const check = probes(verdicts);
  const archived = archive(archiveOptions);
  const lines = [];
  const run = (changes = {}) =>
    repairLinks({
      repoRoot: repo.root,
      env: { GITHUB_REPOSITORY: REPOSITORY, GITHUB_API_URL: fake.origin, AUTOWRITER_PAT: 'token', ...env },
      fetch: (url, init) => {
        assert.ok(String(url).startsWith(fake.origin), 'only the fake GitHub may be reached: ' + url);
        return realFetch(url, init);
      },
      today: TODAY,
      probeAll: check.probeAll,
      closestSnapshot: archived.closestSnapshot,
      readSnapshot: archived.readSnapshot,
      sleep: archived.sleep,
      spacingMs: 0,
      out: (line) => lines.push(line),
      ...changes,
    });
  return { fake, repo, check, archived, lines, run };
}

test('a dead citation is repaired on a branch of the writer, with one pull request into main and the watcher started', async (t) => {
  const { fake, repo, lines, run } = await scene(t);

  const done = await run();

  assert.deepEqual(repo.remoteBranches(), [BRANCH, 'main']);
  const [created] = fake.created();
  assert.equal(created.body.head, BRANCH);
  assert.equal(created.body.base, 'main');
  assert.ok(created.body.body.includes('https://web.archive.org/web/20230302214609/' + NIST));
  assert.deepEqual(
    fake.dispatched().map(({ path, body }) => [path, body.inputs, body.ref]),
    [['actions/workflows/watch-pr.yml/dispatches', { pr: '41' }, 'main']]
  );
  assert.equal(done.pullRequest, 'https://github.com/' + REPOSITORY + '/pull/41');
  assert.equal(lines.at(-1), 'repair-links: dead=1 archive=1 search=0 unplaced=0 waiting=0 pr=' + done.pullRequest);
  assert.equal(repo.git('rev-parse', '--abbrev-ref', 'HEAD'), 'main', 'the checkout is left where it was found');
});

test('the commit is the bot’s alone, holds the entry and the register and nothing else, and is the only commit on the branch', async (t) => {
  const { repo, run } = await scene(t);

  await run();

  assert.deepEqual(
    repo
      .git('diff', '--name-only', 'main', 'origin/' + BRANCH)
      .split('\n')
      .sort(),
    ['audits/link-rot.json', GLOSSARY]
  );
  assert.deepEqual(repo.git('log', '--format=%an <%ae> | %cn <%ce>', 'main..origin/' + BRANCH).split('\n'), [
    'autowriter-bot <autowriter-bot@meshin.co> | autowriter-bot <autowriter-bot@meshin.co>',
  ]);
});

test('with a link repair pull request already open nothing is checked, probed, changed or opened, and the line says so', async (t) => {
  const { fake, repo, check, lines, run } = await scene(t, {
    github: { openBranches: ['autowriter/link-rot-2026-10-30'] },
  });

  await run();

  assert.deepEqual(check.asked, []);
  assert.deepEqual(repo.remoteBranches(), ['main']);
  assert.equal(fake.created().length, 0);
  assert.equal(
    lines.at(-1),
    'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 pr=none (pull request #41 (autowriter/link-rot-2026-10-30) is still open, so nothing was checked)'
  );
});

test('an open pull request of the daily writer does not hold the repair back', async (t) => {
  const { fake, run } = await scene(t, { github: { openBranches: ['autowriter/a-new-glossary-entry'] } });

  await run();

  assert.equal(fake.created().length, 1);
});

test('a run that finds nothing dead opens no branch and no pull request, and exits clean', async (t) => {
  const { fake, repo, lines, run } = await scene(t, { verdicts: {} });

  await run();

  assert.deepEqual(repo.remoteBranches(), ['main']);
  assert.equal(fake.created().length, 0);
  assert.equal(lines.at(-1), 'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 pr=none');
});

test('a dead address no entry cites is recorded in the register by a pull request that changes no entry', async (t) => {
  const template = 'https://template.example/gone';
  const { fake, repo, run } = await scene(t, {
    files: {},
    dist: { 'index.html': [template] },
    verdicts: { [template]: 'dead' },
  });

  await run();

  assert.deepEqual(repo.git('diff', '--name-only', 'main', 'origin/' + BRANCH).split('\n'), ['audits/link-rot.json']);
  assert.match(fake.created()[0].body.title, /^chore\(links\): record 1 dead address no entry can be repaired for/);
  assert.match(fake.created()[0].body.body, /template\.example\/gone, on \//);
});

test('a citation with no snapshot rests on the search link, and the pull request says a search page is not a source', async (t) => {
  const files = { [GLOSSARY]: citing({ address: EMPTY_ADDRESS, retrieved: '2025-10-25' }) };
  const { fake, repo, run } = await scene(t, {
    files,
    dist: { 'index.html': [EMPTY_ADDRESS] },
    verdicts: { [EMPTY_ADDRESS]: 'dead' },
  });

  await run();

  const entry = repo.git('show', 'origin/' + BRANCH + ':' + GLOSSARY);
  assert.ok(entry.includes("url: '" + searchFallbackUrl({ title: TITLE, publisher: 'NIST' }) + "'"));
  assert.match(fake.created()[0].body.body, /a search page is not a source/i);
});

test('a branch of the same day that exists already is not reused: the next free name is taken', async (t) => {
  const { repo, run } = await scene(t);
  repo.git('push', 'origin', 'main:refs/heads/' + BRANCH);

  await run();

  assert.deepEqual(repo.remoteBranches(), [BRANCH, BRANCH + '-2', 'main']);
});

test('a pull request GitHub refuses is a job failure that names the branch, and the entry is still not lost on the local checkout', async (t) => {
  const { repo, run } = await scene(t, { github: { refuse: { 'POST pulls': 500 } } });

  await assert.rejects(
    run(),
    /the branch autowriter\/link-rot-2026-11-03 was pushed, but the pull request or the watcher failed/
  );
  assert.equal(repo.git('rev-parse', '--abbrev-ref', 'HEAD'), 'main');
});

test('a missing token is a job failure that names it, before anything is probed', async (t) => {
  const { check, run } = await scene(t, { env: { AUTOWRITER_PAT: '' } });

  await assert.rejects(run(), /AUTOWRITER_PAT is not set/);
  assert.deepEqual(check.asked, []);
});

test('a register edited by hand makes the job refuse to write over it', async (t) => {
  const { repo, run } = await scene(t);
  repo.put(
    'audits/link-rot.json',
    '{"schema":1,"updatedOn":"2026-11-01","rows":[],"digest":"' + 'a'.repeat(64) + '"}\n'
  );
  repo.commit('a hand edit');

  await assert.rejects(run(), /audits\/link-rot\.json fails its own guard \(the digest does not match its rows/);
});

test('an empty build is a job failure on the command line: exit 1 and the reason on stderr, with nothing pushed', async (t) => {
  const { repo, fake, run } = await scene(t, { dist: { 'index.html': [] }, verdicts: {} });
  const errors = [];

  const code = await runCli(['--repo-root', repo.root, '--today', TODAY], {
    stdout: () => {},
    stderr: (line) => errors.push(line),
    env: { GITHUB_REPOSITORY: REPOSITORY, GITHUB_API_URL: fake.origin, AUTOWRITER_PAT: 'token' },
    fetch: realFetch,
    probeAll: async () => new Map(),
  });

  assert.equal(code, 1);
  assert.match(errors.join('\n'), /holds no outbound address, so this run checked nothing/);
  assert.deepEqual(repo.remoteBranches(), ['main']);
  assert.ok(run);
});

test('a flag the command does not know is a usage error with its own exit code', async () => {
  const errors = [];

  const code = await runCli(['--now', 'x'], { stdout: () => {}, stderr: (line) => errors.push(line) });

  assert.equal(code, 2);
  assert.match(errors[0], /Usage: node scripts\/repair-links\.mjs/);
});
