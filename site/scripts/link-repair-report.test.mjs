import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BRANCH_PREFIX,
  LISTED_PER_SECTION,
  branchFor,
  commitMessage,
  pullRequestBody,
  pullRequestTitle,
  summaryLine,
} from './link-repair-report.mjs';

const NIST = 'https://www.nist.gov/itl/ai-risk-management-framework';
const SNAPSHOT = 'https://web.archive.org/web/20230302214609/' + NIST;
const SEARCH = 'https://www.google.com/search?q=%22A+report%22+Example+Org';

const archive = (changes = {}) => ({
  original: NIST,
  entry: 'site/src/data/glossary/ai-rmf.md',
  outcome: 'archive',
  replacement: SNAPSHOT,
  citedOn: '2023-03-01',
  firstSeenDead: '2026-11-03',
  why: 'the Internet Archive capture of 2023-03-02 is 1 day from the citation date 2023-03-01 and carries the title',
  ...changes,
});
const search = (changes = {}) =>
  archive({
    original: 'https://example.org/report',
    entry: 'site/src/data/post/a-post.md',
    outcome: 'search',
    replacement: SEARCH,
    why: 'no usable Internet Archive capture: the archive holds no snapshot of https://example.org/report',
    ...changes,
  });
const unplaced = (changes = {}) => ({
  original: 'https://template.example/gone',
  entry: null,
  outcome: 'unplaced',
  replacement: null,
  citedOn: null,
  firstSeenDead: '2026-11-03',
  why: 'no collection entry cites it, so it is linked from a template or a page that only a person can edit',
  pages: ['/', '/about'],
  ...changes,
});

const resultOf = ({
  rows = [archive(), search(), unplaced()],
  waitingForCap = [],
  waitingForArchive = [],
  dead,
} = {}) => {
  const count = (outcome) => rows.filter((row) => row.outcome === outcome).length;
  return {
    checked: 120,
    dead: dead ?? [...rows.map(({ original }) => original), ...waitingForCap],
    rows,
    waitingForCap,
    waitingForArchive,
    counts: {
      dead: (dead ?? rows).length + waitingForCap.length,
      archive: count('archive'),
      search: count('search'),
      unplaced: count('unplaced'),
      waiting: waitingForCap.length + waitingForArchive.length,
    },
  };
};

test('the branch is a branch of the writer, and a branch the watcher can slug', () => {
  assert.equal(BRANCH_PREFIX, 'autowriter/link-rot-');
  assert.equal(branchFor('2026-11-03'), 'autowriter/link-rot-2026-11-03');
  assert.equal(branchFor('2026-11-03', 2), 'autowriter/link-rot-2026-11-03-2');
  assert.match(branchFor('2026-11-03', 7).slice('autowriter/'.length), /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('the summary line is one line of counts a person and a script can both read, with the pull request or none', () => {
  const counts = { dead: 5, archive: 2, search: 1, unplaced: 1, waiting: 3 };

  assert.equal(
    summaryLine({ counts, pullRequest: 'https://github.com/meshin-co/website/pull/12' }),
    'repair-links: dead=5 archive=2 search=1 unplaced=1 waiting=3 pr=https://github.com/meshin-co/website/pull/12'
  );
  assert.equal(
    summaryLine({ counts, pullRequest: null }),
    'repair-links: dead=5 archive=2 search=1 unplaced=1 waiting=3 pr=none'
  );
  assert.ok(!summaryLine({ counts, pullRequest: null }).includes('\n'));
});

test('the summary line can say why nothing was checked, and still ends in the pull request field', () => {
  const line = summaryLine({
    counts: { dead: 0, archive: 0, search: 0, unplaced: 0, waiting: 0 },
    pullRequest: null,
    note: 'pull request #4 is still open, so nothing was checked',
  });

  assert.equal(
    line,
    'repair-links: dead=0 archive=0 search=0 unplaced=0 waiting=0 pr=none (pull request #4 is still open, so nothing was checked)'
  );
});

test('the title says what changed in entries, and a run that only records unplaced addresses says that instead', () => {
  assert.equal(
    pullRequestTitle({ today: '2026-11-03', counts: { archive: 2, search: 1, unplaced: 1 } }),
    'fix(links): repair 3 dead citations (2026-11-03)'
  );
  assert.equal(
    pullRequestTitle({ today: '2026-11-03', counts: { archive: 1, search: 0, unplaced: 0 } }),
    'fix(links): repair 1 dead citation (2026-11-03)'
  );
  assert.equal(
    pullRequestTitle({ today: '2026-11-03', counts: { archive: 0, search: 0, unplaced: 2 } }),
    'chore(links): record 2 dead addresses no entry can be repaired for (2026-11-03)'
  );
});

test('the commit message is the title, so the squash merge reads the same as the pull request', () => {
  const counts = { archive: 2, search: 1, unplaced: 1 };

  assert.equal(
    commitMessage({ today: '2026-11-03', counts }).split('\n')[0],
    pullRequestTitle({ today: '2026-11-03', counts })
  );
});

test('the body names every replacement address, the entry it is in, the citation date and the reason', () => {
  const body = pullRequestBody({ today: '2026-11-03', result: resultOf() });

  assert.ok(body.includes(SNAPSHOT));
  assert.ok(body.includes('site/src/data/glossary/ai-rmf.md'));
  assert.ok(body.includes('2023-03-01'));
  assert.ok(body.includes('the Internet Archive capture of 2023-03-02 is 1 day from the citation date'));
  assert.ok(body.includes(NIST), 'the address that was cited is named too');
});

test('a search link is said not to be a source, and the claim beside it is said to be uncheckable now', () => {
  const body = pullRequestBody({ today: '2026-11-03', result: resultOf() });

  assert.match(body, /a search page is not a source/i);
  assert.match(body, /claim beside it can no longer be checked/i);
  assert.ok(body.includes(SEARCH));
});

test('an unplaced address is named with the pages that carry it and the reason, and a person is told to edit the page', () => {
  const body = pullRequestBody({ today: '2026-11-03', result: resultOf() });

  assert.ok(body.includes('https://template.example/gone'));
  assert.match(body, /on \/, \/about/);
  assert.match(body, /only a person can edit/);
});

test('a section with nothing in it is not printed', () => {
  const body = pullRequestBody({ today: '2026-11-03', result: resultOf({ rows: [archive()] }) });

  assert.ok(!/search page is not a source/i.test(body));
  assert.ok(!body.includes('Not placed'));
  assert.ok(!body.includes('Waiting'));
});

test('the dead addresses beyond the cap are counted in the body, with the cap that caused it', () => {
  const waitingForCap = ['https://gone.example/a', 'https://gone.example/b'];
  const body = pullRequestBody({ today: '2026-11-03', result: resultOf({ rows: [archive()], waitingForCap }) });

  assert.match(body, /2 more dead addresses wait for the next run/);
  assert.match(body, /at most 20 addresses per run/);
});

test('a citation left alone because the archive did not answer is named, and is not described as repaired', () => {
  const waitingForArchive = [{ address: NIST, entry: 'site/src/data/post/x.md' }];
  const body = pullRequestBody({ today: '2026-11-03', result: resultOf({ rows: [search()], waitingForArchive }) });

  assert.match(body, /1 citation was left as it is because the Internet Archive did not answer/);
  assert.ok(body.includes('site/src/data/post/x.md'));
});

test('the body says only addresses changed and that the register is generated', () => {
  const body = pullRequestBody({ today: '2026-11-03', result: resultOf() });

  assert.match(body, /only the address changed/i);
  assert.match(body, /audits\/link-rot\.json/);
  assert.match(body, /never edit it by hand/i);
});

test('the run that made the pull request is linked when it is known', () => {
  const body = pullRequestBody({
    today: '2026-11-03',
    result: resultOf(),
    runUrl: 'https://github.com/o/r/actions/runs/9',
  });

  assert.ok(body.includes('https://github.com/o/r/actions/runs/9'));
  assert.ok(!pullRequestBody({ today: '2026-11-03', result: resultOf() }).includes('/actions/runs/'));
});

test('a body for a thousand rows stays under what GitHub accepts, and says how many it left out and where they are', () => {
  const rows = Array.from({ length: 1000 }, (_, index) =>
    archive({ entry: 'site/src/data/post/entry-' + String(index).padStart(4, '0') + '.md' })
  );

  const body = pullRequestBody({ today: '2026-11-03', result: resultOf({ rows }) });

  assert.ok(body.length < 60_000, String(body.length));
  assert.equal(LISTED_PER_SECTION, 40);
  assert.match(body, /960 more rows are in audits\/link-rot\.json/);
});
