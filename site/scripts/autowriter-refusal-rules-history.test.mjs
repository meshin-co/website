import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { REMOVAL_REFUSALS, sealSignature } from './autowriter-refusals.mjs';
import { historyReport, pipelineCommits, repositoryGit } from './autowriter-refusal-rules.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';
import {
  BOT,
  HUMAN,
  branchCommit,
  commitAs,
  gitIn,
  initRepo,
  mergeAs,
  removeRepos,
  shallowClone,
} from './fixtures/history-repo.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const RULES_URL = pathToFileURL(join(SITE, 'scripts/autowriter-refusal-rules.mjs')).href;
const CLAIMED_AT = '2026-11-01T07:00:00.000Z';
const GENERATIONS = recordDirectory('generation');
const DISPOSITIONS = recordDirectory('disposition');
const RECORD = recordPath('generation', 'first-post', CLAIMED_AT);
const SECOND_RECORD = recordPath('generation', 'second-post', CLAIMED_AT);
const BAND = 'audits/sentence-band.json';
const DISPOSITION = `${DISPOSITIONS}/main.json`;
const PIPELINE_REASON = 'The text of this target changed in the run in which the unattended writer added /blog/x.';

const made = [];
after(() => removeRepos(...made));
const track = (root) => {
  made.push(root);
  return root;
};
const repoWith = (files = {}) => {
  const root = track(initRepo());
  commitAs(root, HUMAN, { write: { 'README.md': 'start\n', ...files }, message: 'chore(fixture): start' });
  return root;
};
const written = (slug) =>
  `feat(autowriter): write ${slug}\n\nProvenance: ${recordPath('generation', slug, CLAIMED_AT)}`;
const pipelineWrite = { write: { [RECORD]: '{}\n', [BAND]: '{}\n' }, message: written('first-post') };
const judged = (root) => pipelineCommits(repositoryGit(root));
const shas = (root) => judged(root).map(({ sha }) => sha);
const entry = (digest, extra = {}) => ({
  target: 'src/data/post/a.md',
  location: 'frontmatter.title',
  status: 'verified',
  reason: 'Read on 2026-10-08.',
  digest,
  ...extra,
});
const listing = (...entries) => `${JSON.stringify(entries, null, 2)}\n`;

test('a commit by the bot that changed a record is a pipeline commit, with or without the Provenance line', () => {
  const root = repoWith();
  const sha = commitAs(root, BOT, { ...pipelineWrite, message: 'feat(autowriter): write first-post' });
  const found = judged(root);
  assert.equal(found.length, 1);
  assert.equal(found[0].sha, sha);
  assert.deepEqual(found[0].records, [RECORD]);
  assert.deepEqual(
    found[0].changes.map(({ path }) => path),
    [RECORD, BAND]
  );
});

test('a person who names the changed record in a Provenance line is judged, and a line naming another record is not', () => {
  const root = repoWith();
  const named = commitAs(root, HUMAN, { write: { [RECORD]: '{}\n' }, message: written('first-post') });
  commitAs(root, HUMAN, { write: { [SECOND_RECORD]: '{}\n' }, message: written('third-post') });
  assert.deepEqual(shas(root), [named]);
});

test('a person who touched a record and the band with no Provenance line is not judged, so history never fails for good', () => {
  const root = repoWith();
  commitAs(root, HUMAN, { ...pipelineWrite, message: 'feat(content): a record written by hand' });
  assert.deepEqual(judged(root), []);
  assert.deepEqual(historyReport({ root }), { findings: [], commits: 0, skipped: null });
});

test('a commit by the bot that changed no record is not judged, because the rule reads records', () => {
  const root = repoWith();
  commitAs(root, BOT, { write: { [BAND]: '{}\n' }, message: 'chore(autowriter): move the band' });
  assert.deepEqual(judged(root), []);
});

test('only a .json file under the generations directory is a record, at any depth, and no sibling directory is one', () => {
  const root = repoWith();
  const write = {
    [`${GENERATIONS}/zz.md`]: 'x\n',
    [`${GENERATIONS}/2026/11/zz.md`]: 'x\n',
    [`${GENERATIONS}-old/zz.json`]: '{}\n',
    [recordPath('claim', 'zz', CLAIMED_AT)]: '{}\n',
    [recordPath('ledger', 'zz', CLAIMED_AT)]: '{}\n',
    [BAND]: '{}\n',
  };
  commitAs(root, BOT, { write, message: 'feat(autowriter): write zz' });
  assert.deepEqual(judged(root), []);
});

test('a record is found at any depth: one flat, one in its month and one below it are three records of one commit', () => {
  const root = repoWith();
  const records = [`${GENERATIONS}/third-post.json`, RECORD, `${GENERATIONS}/2026/11/extra/fourth-post.json`];
  const write = { ...Object.fromEntries(records.map((path) => [path, '{}\n'])), [BAND]: '{}\n' };
  commitAs(root, BOT, { write, message: 'feat(autowriter): write three posts' });
  const [found, ...later] = judged(root);
  assert.equal(later.length, 0);
  assert.deepEqual([...found.records].sort(), [...records].sort());
  const { findings, commits } = historyReport({ root });
  assert.equal(commits, 1);
  assert.equal(findings.length, 3);
  assert.deepEqual(findings.map(({ path }) => path).sort(), [...records].sort());
});

test('a root commit by the bot is read as everything added, so no file has a before side', () => {
  const root = track(initRepo());
  const sha = commitAs(root, BOT, pipelineWrite);
  const found = judged(root);
  assert.deepEqual(shas(root), [sha]);
  assert.deepEqual(
    found[0].changes.map(({ before }) => before),
    [null, null]
  );
  assert.equal(historyReport({ root }).findings.length, 1);
});

test('a merge commit is skipped, and a branch that was merged is read through its own commits', () => {
  const root = repoWith();
  const side = branchCommit(root, 'side', BOT, pipelineWrite);
  commitAs(root, HUMAN, { write: { 'main.txt': 'm\n' }, message: 'chore(fixture): main moves' });
  mergeAs(root, 'side', BOT, `Merge side\n\nProvenance: ${RECORD}`);
  assert.deepEqual(shas(root), [side]);
});

test('a commit on a branch that HEAD does not contain is not judged', () => {
  const root = repoWith();
  branchCommit(root, 'unmerged', BOT, pipelineWrite);
  assert.deepEqual(judged(root), []);
});

test('pipeline commits come newest first', () => {
  const root = repoWith();
  const first = commitAs(root, BOT, { write: { [RECORD]: '{}\n' }, message: written('first-post') });
  const second = commitAs(root, BOT, { write: { [SECOND_RECORD]: '{}\n' }, message: written('second-post') });
  assert.deepEqual(shas(root), [second, first]);
});

test('a pipeline commit that moved the band is one finding, naming the record, the path, the refusal and the commit', () => {
  const root = repoWith();
  const sha = commitAs(root, BOT, pipelineWrite);
  const { findings, commits, skipped } = historyReport({ root });
  assert.equal(commits, 1);
  assert.equal(skipped, null);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'refused-path-committed');
  assert.equal(findings[0].path, RECORD);
  const pattern = /^touched audits\/sentence-band\.json \(sentence-band: .+\), in commit [0-9a-f]{12}$/;
  assert.match(findings[0].detail, pattern);
  assert.ok(findings[0].detail.endsWith(`, in commit ${sha.slice(0, 12)}`));
});

test('a pipeline commit that changed two records is counted once and found once for each of them', () => {
  const root = repoWith();
  const write = { [RECORD]: '{}\n', [SECOND_RECORD]: '{}\n', [BAND]: '{}\n' };
  commitAs(root, BOT, { write, message: `${written('first-post')}\nProvenance: ${SECOND_RECORD}` });
  const { findings, commits } = historyReport({ root });
  assert.equal(commits, 1);
  assert.deepEqual(
    findings.map(({ path }) => path),
    [RECORD, SECOND_RECORD]
  );
});

test('a pipeline commit that deleted a record and moved the band is judged on the record it deleted, for both', () => {
  const root = repoWith({ [RECORD]: '{}\n' });
  commitAs(root, BOT, { remove: [RECORD], write: { [BAND]: '{}\n' }, message: 'feat(autowriter): drop first-post' });
  const found = historyReport({ root }).findings;
  assert.deepEqual(
    found.map(({ path }) => path),
    [RECORD, RECORD]
  );
  assert.deepEqual(found.map(({ rule }) => rule).sort(), [
    'generation-record-removed-committed',
    'refused-path-committed',
  ]);
});

test('a pipeline commit that moved a digest while its reason and status stayed is a seal, found with the entry', () => {
  const before = listing(entry('a'.repeat(12)));
  const after = listing(entry('b'.repeat(12)));
  const root = repoWith({ [DISPOSITION]: before });
  const write = { [RECORD]: '{}\n', [DISPOSITION]: after };
  const sha = commitAs(root, BOT, { write, message: written('first-post') });
  const seal = sealSignature({ path: DISPOSITION, before, after });
  const sealed = `sealed src/data/post/a.md frontmatter.title in ${DISPOSITION}`;
  const detail = `${sealed} (${seal.id}: ${seal.why}), in commit ${sha.slice(0, 12)}`;
  assert.deepEqual(historyReport({ root }).findings, [{ rule: 'disposition-seal-committed', path: RECORD, detail }]);
});

test('a seal is found in a disposition file wherever it lies: flat, in its month and below it make three findings', () => {
  const before = listing(entry('a'.repeat(12)));
  const after = listing(entry('b'.repeat(12)));
  const paths = [
    DISPOSITION,
    recordPath('disposition', 'first-post', CLAIMED_AT),
    `${DISPOSITIONS}/2026/11/extra/generated-first-post.json`,
  ];
  const root = repoWith(Object.fromEntries(paths.map((path) => [path, before])));
  const write = { [RECORD]: '{}\n', ...Object.fromEntries(paths.map((path) => [path, after])) };
  commitAs(root, BOT, { write, message: written('first-post') });
  const { findings, commits } = historyReport({ root });
  assert.equal(commits, 1);
  assert.equal(findings.length, 3);
  assert.deepEqual([...new Set(findings.map(({ rule }) => rule))], ['disposition-seal-committed']);
  for (const path of paths)
    assert.ok(
      findings.some(({ detail }) => detail.includes(` in ${path} (`)),
      path
    );
});

test('a restate the pipeline wrote itself, a new disposition file and a deleted one are not seals', () => {
  const restated = listing(entry('a'.repeat(12), { reason: PIPELINE_REASON }));
  const root = repoWith({ [DISPOSITION]: restated, [`${DISPOSITIONS}/gone.json`]: restated });
  const moved = listing(entry('b'.repeat(12), { reason: PIPELINE_REASON }));
  const write = { [RECORD]: '{}\n', [DISPOSITION]: moved, [`${DISPOSITIONS}/new.json`]: moved };
  commitAs(root, BOT, { write, remove: [`${DISPOSITIONS}/gone.json`], message: written('first-post') });
  assert.deepEqual(historyReport({ root }), { findings: [], commits: 1, skipped: null });
});

test('a shallow clone is not judged: no finding, no commit count, and the reason says so', () => {
  const root = repoWith();
  commitAs(root, BOT, pipelineWrite);
  commitAs(root, HUMAN, { write: { 'more.txt': 'm\n' }, message: 'chore(fixture): more' });
  const clone = track(shallowClone(root));
  assert.deepEqual(historyReport({ root: clone }), { findings: [], commits: null, skipped: 'the clone is shallow' });
  assert.equal(historyReport({ root }).findings.length, 1);
});

test('a directory that is not a repository is not judged, and a folder inside a repository is not its root', () => {
  const plain = track(mkdtempSync(join(tmpdir(), 'autowriter-history-plain-')));
  const skipped = `${plain} is not a git repository`;
  assert.deepEqual(historyReport({ root: plain }), { findings: [], commits: null, skipped });
  const inside = join(repoWith({ 'site/keep.txt': 'k\n' }), 'site');
  assert.equal(historyReport({ root: inside }).skipped, `${inside} is not a git repository`);
});

const probe = (directory, root) =>
  spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { historyReport } from ${JSON.stringify(RULES_URL)};\n` +
        `console.log(JSON.stringify(historyReport({ root: ${JSON.stringify(root)} })));`,
    ],
    { cwd: directory, encoding: 'utf8' }
  );

test('the module loads and judges the root given from the repository root, from site/ and from any other directory', () => {
  const root = repoWith();
  commitAs(root, BOT, pipelineWrite);
  const runs = [REPO, SITE, tmpdir()].map((directory) => probe(directory, root));
  for (const run of runs) assert.equal(run.status, 0, run.stderr);
  const [fromRepo, ...others] = runs.map((run) => JSON.parse(run.stdout));
  assert.equal(fromRepo.findings.length, 1);
  for (const other of others) assert.deepEqual(other, fromRepo);
});

test('a GIT_DIR left in the environment does not move the repository that is read', () => {
  const root = repoWith();
  commitAs(root, BOT, pipelineWrite);
  const elsewhere = repoWith();
  const kept = process.env.GIT_DIR;
  process.env.GIT_DIR = join(elsewhere, '.git');
  try {
    assert.equal(historyReport({ root }).findings.length, 1);
  } finally {
    if (kept === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = kept;
  }
});

test('a git read that fails is neither a skip nor a pass', () => {
  const root = repoWith();
  const failing = () => {
    throw new Error('fatal: the object store is unreadable');
  };
  assert.throws(() => historyReport({ root, git: failing }), /the object store is unreadable/);
});

test('git is run in the root given, with the input given on its standard input and the environment given on top', () => {
  const root = repoWith();
  const git = repositoryGit(root, { GIT_AUTHOR_NAME: 'Zed', GIT_AUTHOR_EMAIL: 'zed@example.test' });
  assert.equal(git(['rev-parse', '--show-toplevel']).trim(), realpathSync(root));
  assert.equal(git(['hash-object', '--stdin'], 'hello\n').trim(), 'ce013625030ba8dba906f756967f9e9ca394464a');
  assert.match(git(['var', 'GIT_AUTHOR_IDENT']), /^Zed <zed@example\.test> /);
});

test('a location variable of the caller is dropped, and one passed on purpose is kept', () => {
  const root = repoWith();
  const elsewhere = join(repoWith(), '.git/index');
  const mine = join(root, '.git/zz-index');
  const kept = process.env.GIT_INDEX_FILE;
  process.env.GIT_INDEX_FILE = elsewhere;
  try {
    assert.equal(repositoryGit(root)(['rev-parse', '--git-path', 'index']).trim(), '.git/index');
    assert.equal(repositoryGit(root, { GIT_INDEX_FILE: mine })(['rev-parse', '--git-path', 'index']).trim(), mine);
  } finally {
    if (kept === undefined) delete process.env.GIT_INDEX_FILE;
    else process.env.GIT_INDEX_FILE = kept;
  }
});

test('a signature display that the configuration asks of git is not read as part of a commit', () => {
  const root = repoWith({ [RECORD]: '{}\n' });
  commitAs(root, BOT, { write: { [RECORD]: '{"a":1}\n' }, message: written('first-post') });
  const stub = join(track(mkdtempSync(join(tmpdir(), 'autowriter-history-gpg-'))), 'gpg.sh');
  writeFileSync(stub, '#!/bin/sh\necho "gpg: Signature made (stub)" >&2\n', { mode: 0o755 });
  gitIn(root, ['config', 'log.showSignature', 'true']);
  gitIn(root, ['config', 'gpg.program', stub]);
  const [headers, ...message] = gitIn(root, ['cat-file', 'commit', 'HEAD']).split('\n\n');
  const signature = 'gpgsig -----BEGIN PGP SIGNATURE-----\n \n abc\n -----END PGP SIGNATURE-----';
  const object = `${headers}\n${signature}\n\n${message.join('\n\n')}`;
  const signed = repositoryGit(root)(['hash-object', '-t', 'commit', '-w', '--stdin'], object).trim();
  gitIn(root, ['update-ref', 'HEAD', signed]);
  assert.equal(gitIn(root, ['-c', 'log.showSignature=true', 'log', '-1', '--format=%H']).startsWith('gpg:'), true);
  assert.deepEqual(shas(root), [signed]);
});

const REMOVED = 'generation-record-removed-committed';
const removedDetail = (path, sha) =>
  `removed ${path} (generation-record-removed: ${REMOVAL_REFUSALS[0].why}), in commit ${sha.slice(0, 12)}`;
const FLAT_RECORD = `${GENERATIONS}/first-post.json`;
const DEEP_RECORD = `${GENERATIONS}/2026/11/extra/first-post.json`;
const PLACEMENTS = [
  ['flat', FLAT_RECORD],
  ['in its month', RECORD],
  ['below its month', DEEP_RECORD],
];

test('a pipeline commit that removed a record is one finding under its own rule, naming the record, the refusal, why and the commit', () => {
  const root = repoWith({ [RECORD]: '{}\n' });
  const sha = commitAs(root, BOT, { remove: [RECORD], message: 'feat(autowriter): drop first-post' });
  assert.deepEqual(historyReport({ root }), {
    findings: [{ rule: REMOVED, path: RECORD, detail: removedDetail(RECORD, sha) }],
    commits: 1,
    skipped: null,
  });
});

test('a person who removed a record is not judged, so a record can still be removed by hand', () => {
  const root = repoWith({ [RECORD]: '{}\n' });
  commitAs(root, HUMAN, { remove: [RECORD], message: 'chore: drop first-post' });
  assert.deepEqual(historyReport({ root }), { findings: [], commits: 0, skipped: null });
});

test('a pipeline commit that wrote or changed a record, or removed a file that is no record, removed no record', () => {
  const root = repoWith({ [RECORD]: '{}\n', 'site/src/data/post/old.md': 'old\n' });
  commitAs(root, BOT, {
    write: { [RECORD]: '{"again":1}\n', [SECOND_RECORD]: '{}\n' },
    remove: ['site/src/data/post/old.md'],
    message: written('second-post'),
  });
  assert.deepEqual(historyReport({ root }), { findings: [], commits: 1, skipped: null });
});

const MOVES = [
  ['to another name in its month', recordPath('generation', 'renamed-post', CLAIMED_AT), true],
  ['to another month', recordPath('generation', 'first-post', '2026-12-01T00:00:00.000Z'), true],
  ['to the flat generations directory', FLAT_RECORD, true],
  ['out of the directory', 'audits/autowriter/first-post.json', false],
  ['to another tree', 'audits/archive/first-post.json', false],
];

for (const [how, target, inFamily] of MOVES) {
  test(`a pipeline commit that moved a record in its month ${how} removed it from where it was, and is found`, () => {
    const root = repoWith({ [RECORD]: '{"slug":"first-post"}\n' });
    const write = { [target]: '{"slug":"first-post"}\n' };
    const sha = commitAs(root, BOT, { remove: [RECORD], write, message: 'feat(autowriter): move first-post' });
    const { findings, commits } = historyReport({ root });
    const judgedOn = inFamily ? [RECORD, target].sort() : [RECORD];

    assert.equal(commits, 1);
    assert.deepEqual(
      findings.map(({ rule, path }) => [rule, path]).sort(),
      judgedOn.map((path) => [REMOVED, path])
    );
    for (const finding of findings) assert.equal(finding.detail, removedDetail(RECORD, sha));
  });
}

for (const [where, path] of PLACEMENTS) {
  test(`a pipeline commit that moved a record into the directory from elsewhere, ${where}, added it and is not found`, () => {
    const elsewhere = 'audits/elsewhere/first-post.json';
    const root = repoWith({ [elsewhere]: '{}\n' });
    const sha = commitAs(root, BOT, { remove: [elsewhere], write: { [path]: '{}\n' }, message: written('first-post') });

    assert.deepEqual(
      judged(root).map(({ sha: found, records }) => [found, records]),
      [[sha, [path]]]
    );
    assert.deepEqual(historyReport({ root }), { findings: [], commits: 1, skipped: null });
  });
}

test('a commit by the bot that only added a record filed in its month is a pipeline commit, and gives no finding', () => {
  const root = repoWith();
  const sha = commitAs(root, BOT, { write: { [RECORD]: '{}\n' }, message: 'feat(autowriter): write first-post' });
  const found = judged(root);

  assert.deepEqual(
    found.map(({ sha: commit, records }) => [commit, records]),
    [[sha, [RECORD]]]
  );
  assert.equal(found[0].records[0], `${GENERATIONS}/2026/11/first-post.json`);
  assert.deepEqual(historyReport({ root }), { findings: [], commits: 1, skipped: null });
});

test('a pipeline commit that removed a record is found once wherever the record was filed: flat, in its month, below it make three', () => {
  const root = repoWith(Object.fromEntries(PLACEMENTS.map(([, path]) => [path, '{}\n'])));
  const removals = PLACEMENTS.map(([, path]) => [
    path,
    commitAs(root, BOT, { remove: [path], message: 'feat(autowriter): drop first-post' }),
  ]);
  const { findings, commits } = historyReport({ root });

  assert.equal(commits, 3);
  assert.equal(findings.length, 3);
  assert.deepEqual(
    findings.map(({ rule, path, detail }) => [rule, path, detail]).sort(),
    removals.map(([path, sha]) => [REMOVED, path, removedDetail(path, sha)]).sort()
  );
});

for (const [where, path] of PLACEMENTS) {
  test(`a person who removed a record ${where} is not judged`, () => {
    const root = repoWith({ [path]: '{}\n' });
    commitAs(root, HUMAN, { remove: [path], message: 'chore: drop first-post' });

    assert.deepEqual(historyReport({ root }), { findings: [], commits: 0, skipped: null });
  });
}

const REHOMES = [
  ['flat to its month', FLAT_RECORD, RECORD],
  ['its month to flat', RECORD, FLAT_RECORD],
  ['its month to below it', RECORD, DEEP_RECORD],
];

for (const [how, from, to] of REHOMES) {
  test(`a pipeline commit that re-homed a record ${how} removed it from where it was, so it is found on both records`, () => {
    const root = repoWith({ [from]: '{}\n' });
    const sha = commitAs(root, BOT, { remove: [from], write: { [to]: '{}\n' }, message: 'feat(autowriter): re-home' });
    const { findings, commits } = historyReport({ root });

    assert.equal(commits, 1);
    assert.deepEqual(
      findings.map(({ rule, path }) => [rule, path]).sort(),
      [from, to].sort().map((path) => [REMOVED, path])
    );
    for (const finding of findings) assert.equal(finding.detail, removedDetail(from, sha));
  });

  test(`a person who re-homed a record ${how} is not judged, because only a person re-homes a record`, () => {
    const root = repoWith({ [from]: '{}\n' });
    commitAs(root, HUMAN, { remove: [from], write: { [to]: '{}\n' }, message: 'chore: re-home first-post' });

    assert.deepEqual(historyReport({ root }), { findings: [], commits: 0, skipped: null });
  });
}

test('a bot commit that touches only a record filed two levels deep is seen, and one that touches nothing there is not', () => {
  const root = repoWith();
  commitAs(root, BOT, { write: { 'site/notes.txt': 'n\n' }, message: 'chore(autowriter): notes' });
  commitAs(root, BOT, { write: { [`${GENERATIONS}-old/first-post.json`]: '{}\n' }, message: 'chore(autowriter): old' });
  const deep = commitAs(root, BOT, { write: { [DEEP_RECORD]: '{}\n' }, message: 'feat(autowriter): write deep' });
  assert.deepEqual(shas(root), [deep]);
  const [found] = judged(root);

  assert.equal(found.sha, deep);
  assert.deepEqual(found.records, [DEEP_RECORD]);
  assert.deepEqual(
    found.changes.map(({ path }) => path),
    [DEEP_RECORD]
  );
  assert.deepEqual(historyReport({ root }), { findings: [], commits: 1, skipped: null });
});
