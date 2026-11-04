import assert from 'node:assert/strict';
import test from 'node:test';

import { REPOSITORY, startGitHub } from './fixtures/github-host.mjs';
import { archive, citing, probes } from './fixtures/link-repair-world.mjs';
import { entryText, makeLinkRotRepo } from './fixtures/link-rot-repo.mjs';
import {
  GLOSSARY,
  NIST,
  PARKED,
  PUBLISHER,
  SECOND,
  TITLE,
  TODAY,
  page,
  registerRow,
  searchOf,
  searched,
} from './fixtures/reexamine-world.mjs';
import { REGISTER_PATH, registerProblems, registerText, sealRegister } from './link-rot-register.mjs';
import { repairLinks } from './repair-links.mjs';

const realFetch = globalThis.fetch;
const BRANCH = `autowriter/link-rot-${TODAY}`;
const OTHER = 'https://example.org/report';
const OTHER_TITLE = 'Quite Another Report';
const OTHER_PUBLISHER = 'Example Org';
const SNAPSHOT = `https://web.archive.org/web/20230302214609/${OTHER}`;

async function scene(t, { files, rows, verdicts = {}, pages = {}, github = {}, archiveOptions = {}, outbound = [] }) {
  const fake = await startGitHub(github);
  const repo = makeLinkRotRepo({
    files: { ...files, [REGISTER_PATH]: registerText(sealRegister({ updatedOn: '2026-10-21', rows })) },
    dist: { 'index.html': outbound },
  });
  t.after(async () => {
    await fake.close();
    repo.remove();
  });
  const check = probes(verdicts);
  const archived = archive({ empty: [], ...archiveOptions });
  const lines = [];
  const settled = [];
  const read = [];
  const run = (changes = {}) =>
    repairLinks({
      repoRoot: repo.root,
      env: { GITHUB_REPOSITORY: REPOSITORY, GITHUB_API_URL: fake.origin, AUTOWRITER_PAT: 'token' },
      fetch: (url, init) => {
        assert.ok(String(url).startsWith(fake.origin), 'only the fake GitHub may be reached: ' + url);
        return realFetch(url, init);
      },
      today: TODAY,
      probeAll: check.probeAll,
      readLivePage: async ({ address }) => {
        read.push(address);
        return pages[address] ?? page();
      },
      closestSnapshot: archived.closestSnapshot,
      readSnapshot: archived.readSnapshot,
      sleep: archived.sleep,
      spacingMs: 0,
      settle: async ({ result }) => {
        settled.push([...result.entries]);
        return [];
      },
      out: (line) => lines.push(line),
      ...changes,
    });
  return { fake, repo, check, archived, lines, settled, read, run };
}

const registerOn = (repo) => JSON.parse(repo.remoteFile(BRANCH, REGISTER_PATH));
const searchRows = (...rows) => rows.map((row) => registerRow(row));
const SCANNED = 'repair-links: re-examined 1 of 1 address that rests on a search link';

test('a search row whose original answers again is restored in a pull request: the entry, the register and the summary line say so', async (t) => {
  const { fake, repo, lines, settled, read, run } = await scene(t, {
    files: { [GLOSSARY]: searched() },
    rows: searchRows({}),
    outbound: [searchOf()],
  });

  const done = await run();

  assert.deepEqual(repo.remoteBranches(), [BRANCH, 'main']);
  assert.equal(repo.remoteFile(BRANCH, GLOSSARY), citing({ address: NIST }).trim());
  assert.deepEqual(registerOn(repo).rows, []);
  assert.deepEqual(registerProblems(registerOn(repo)), []);
  assert.deepEqual(read, [NIST]);
  assert.deepEqual(settled, [[GLOSSARY]], 'the settle step is told which entries the run rewrote');
  const [created] = fake.created();
  assert.equal(created.body.title, 'fix(links): restore 1 citation from a search link (2026-11-03)');
  assert.match(created.body.body, /^## Restored to the original address$/m);
  assert.ok(
    created.body.body.includes(`\`${GLOSSARY}\`, cited 2023-03-01: ${NIST} went back to the address that was cited`)
  );
  assert.equal(lines.at(-2), SCANNED);
  assert.equal(
    lines.at(-1),
    `repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=0 restored=1 upgraded=0 pr=${done.pullRequest}`
  );
  assert.deepEqual(
    repo
      .git('diff', '--name-only', 'main', 'origin/' + BRANCH)
      .split('\n')
      .sort(),
    [REGISTER_PATH, GLOSSARY]
  );
});

test('a search row whose original is gone but has a usable capture now moves up to the archive in a pull request, and the register says archive', async (t) => {
  const { fake, repo, lines, run } = await scene(t, {
    files: { [SECOND]: searched({ original: OTHER }) },
    rows: searchRows({ original: OTHER, entry: SECOND }),
    verdicts: { [OTHER]: 'dead' },
    outbound: [searchOf()],
  });

  const done = await run();

  const entry = repo.remoteFile(BRANCH, SECOND);
  assert.ok(entry.includes(`url: '${SNAPSHOT}'`), entry);
  assert.ok(entry.includes(`original: '${OTHER}'`));
  const [row] = registerOn(repo).rows;
  assert.deepEqual(
    { ...row, why: undefined },
    {
      original: OTHER,
      entry: SECOND,
      outcome: 'archive',
      replacement: SNAPSHOT,
      citedOn: '2023-03-01',
      firstSeenDead: '2026-10-20',
      why: undefined,
    }
  );
  assert.equal(fake.created()[0].body.title, 'fix(links): move 1 citation up from a search link (2026-11-03)');
  assert.equal(
    lines.at(-1),
    `repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=1 pr=${done.pullRequest}`
  );
});

test('a sweep repair and a restore in one run are one commit and one pull request, with the register written once for both', async (t) => {
  const { fake, repo, lines, settled, run } = await scene(t, {
    files: { [GLOSSARY]: citing({ address: NIST }), [SECOND]: searched({ original: OTHER }) },
    rows: searchRows({ original: OTHER, entry: SECOND }),
    verdicts: { [NIST]: 'dead', [OTHER]: 'answered' },
    outbound: [NIST, searchOf()],
  });

  const done = await run();

  assert.equal(fake.created().length, 1);
  assert.deepEqual(repo.git('log', '--format=%s', 'main..origin/' + BRANCH).split('\n'), [
    'fix(links): repair 1 dead citation, restore 1 citation from a search link (2026-11-03)',
  ]);
  assert.ok(repo.remoteFile(BRANCH, GLOSSARY).includes(`https://web.archive.org/web/20230302214609/${NIST}`));
  assert.equal(repo.remoteFile(BRANCH, SECOND), citing({ address: OTHER }).trim());
  assert.deepEqual(
    registerOn(repo).rows.map(({ original, outcome }) => [original, outcome]),
    [[NIST, 'archive']]
  );
  assert.deepEqual(settled, [[GLOSSARY, SECOND]]);
  assert.equal(
    lines.at(-1),
    `repair-links: dead=1 archive=1 search=0 unplaced=0 waiting=0 watching=0 restored=1 upgraded=0 pr=${done.pullRequest}`
  );
});

test('an entry the sweep rewrote and the pass rewrites too has both changes, because the pass builds on the text the sweep made', async (t) => {
  const otherSearch = searchOf({ title: OTHER_TITLE, publisher: OTHER_PUBLISHER });
  const both = entryText({
    sources: [
      { title: TITLE, url: NIST, publisher: PUBLISHER, retrieved: '2023-03-01' },
      { title: OTHER_TITLE, url: otherSearch, original: OTHER, publisher: OTHER_PUBLISHER, retrieved: '2023-03-01' },
    ],
    body: `See [the framework](${NIST}) and [the other report](${otherSearch}).\n`,
  });
  const { repo, run } = await scene(t, {
    files: { [GLOSSARY]: both },
    rows: searchRows({ original: OTHER, entry: GLOSSARY, title: OTHER_TITLE, publisher: OTHER_PUBLISHER }),
    verdicts: { [NIST]: 'dead', [OTHER]: 'answered' },
    pages: { [OTHER]: page(`<h1>${OTHER_TITLE}</h1>`) },
    outbound: [NIST, otherSearch],
  });

  await run();

  const entry = repo.remoteFile(BRANCH, GLOSSARY);
  assert.ok(entry.includes(`[the framework](https://web.archive.org/web/20230302214609/${NIST})`), entry);
  assert.ok(entry.includes(`[the other report](${OTHER})`), entry);
  assert.ok(!entry.includes('google.com'), entry);
});

test('a run in which neither the original answers nor the archive has a capture opens no branch and no pull request, and says it asked', async (t) => {
  const { fake, repo, lines, run } = await scene(t, {
    files: { [GLOSSARY]: searched() },
    rows: searchRows({}),
    verdicts: { [NIST]: 'dead' },
    archiveOptions: { empty: [NIST] },
    outbound: [searchOf()],
  });
  const before = repo.read(GLOSSARY);

  await run();

  assert.deepEqual(repo.remoteBranches(), ['main']);
  assert.equal(fake.created().length, 0);
  assert.equal(repo.read(GLOSSARY), before);
  assert.equal(lines.at(-2), SCANNED);
  assert.equal(
    lines.at(-1),
    'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=none'
  );
});

test('an original that answers with a parked page is not restored, and the run that found only that opens nothing', async (t) => {
  const { fake, lines, run } = await scene(t, {
    files: { [GLOSSARY]: searched() },
    rows: searchRows({}),
    pages: { [NIST]: page(PARKED) },
    archiveOptions: { empty: [NIST] },
    outbound: [searchOf()],
  });

  await run();

  assert.equal(fake.created().length, 0);
  assert.ok(lines.at(-1).includes('restored=0 upgraded=0 pr=none'));
});

test('citations that could not be asked are counted as waiting, and named in the pull request that other changes made', async (t) => {
  const { fake, lines, run } = await scene(t, {
    files: { [GLOSSARY]: searched(), [SECOND]: searched({ original: OTHER }) },
    rows: searchRows({}, { original: OTHER, entry: SECOND }),
    verdicts: { [NIST]: 'unverified', [OTHER]: 'answered' },
    archiveOptions: { empty: [NIST] },
    outbound: [searchOf()],
  });

  const done = await run();

  assert.ok(done.pullRequest);
  assert.ok(
    lines
      .at(-1)
      .startsWith('repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=1 watching=0 restored=1 upgraded=0 pr=')
  );
  assert.match(
    fake.created()[0].body.body,
    /1 citation that rests on a search link was left as it is because the original address or the Internet Archive could not be asked/
  );
});

test('with a link repair pull request already open, no search row is examined either, and the line still carries the new fields', async (t) => {
  const { check, read, lines, run } = await scene(t, {
    files: { [GLOSSARY]: searched() },
    rows: searchRows({}),
    github: { openBranches: ['autowriter/link-rot-2026-10-30'] },
    outbound: [searchOf()],
  });

  await run();

  assert.deepEqual(check.asked, []);
  assert.deepEqual(read, []);
  assert.equal(
    lines.at(-1),
    'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 watching=0 restored=0 upgraded=0 pr=none (pull request #41 (autowriter/link-rot-2026-10-30) is still open, so nothing was checked)'
  );
});

test('a row that cannot be rewritten is named on a line of its own before the summary, and never fails the run', async (t) => {
  const refused = searched({ body: `See [the framework](${searchOf()}).\n\n\`\`\`sh\ncurl ${searchOf()}\n\`\`\`\n` });
  const { lines, run } = await scene(t, {
    files: { [GLOSSARY]: refused },
    rows: searchRows({}),
    outbound: [searchOf()],
  });

  const done = await run();

  assert.equal(done.pullRequest, null);
  assert.ok(
    lines.some((line) => line.startsWith(`repair-links: a search link was left as it is: ${GLOSSARY}: `)),
    lines.join('\n')
  );
  assert.ok(lines.at(-1).endsWith('restored=0 upgraded=0 pr=none'));
});
