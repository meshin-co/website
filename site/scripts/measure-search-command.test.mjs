import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildSearchIndex, chunkPath, manifestPath } from '../src/utils/search-index.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { articles, change, withDist, without } from './fixtures/search-budget-world.mjs';
import { measureSearchIndex, projectReach, renderMeasurement } from './measure-search.mjs';
import { firstQueryWorstCase } from './search-budget.mjs';

const SCRIPT = fileURLToPath(new URL('./measure-search.mjs', import.meta.url));
const TODAY = '2026-11-04';
const OPTIONS = { perDay: 2, today: TODAY };
const DAY = 86_400_000;

const reach = (headroom, growth, perDay = 1) => projectReach({ headroom, growth, perDay, today: TODAY });

test('a limit is reached after headroom over growth articles, on the day those articles are published at the rate given', () => {
  assert.deepEqual(reach(1130, 1, 2), { kind: 'date', articles: 1130, days: 565, date: '2028-05-22', inside: true });
  assert.deepEqual(reach(22224, 5, 2), { kind: 'date', articles: 4445, days: 2223, date: '2032-12-05', inside: false });
  assert.deepEqual(reach(0, 5, 2), { kind: 'date', articles: 0, days: 0, date: TODAY, inside: true });
});

test('a limit is inside five years up to the same day five years on, and beyond from the next day', () => {
  assert.deepEqual(reach(1826, 1), { kind: 'date', articles: 1826, days: 1826, date: '2031-11-04', inside: true });
  assert.deepEqual(reach(1827, 1), { kind: 'date', articles: 1827, days: 1827, date: '2031-11-05', inside: false });
});

test('a limit already crossed, one nothing grows towards and one over a hundred years away are told apart, and no date is made up for them', () => {
  assert.deepEqual(reach(-3, 1), { kind: 'over', by: 3 });
  assert.deepEqual(reach(10, 0), { kind: 'never' });
  assert.deepEqual(reach(10, Number.NaN), { kind: 'never' });
  assert.deepEqual(reach(36_500, 1), {
    kind: 'date',
    articles: 36_500,
    days: 36_500,
    date: '2126-10-11',
    inside: false,
  });
  assert.deepEqual(reach(36_501, 1), { kind: 'far' });
});

const MEASURED = {
  files: 37,
  gz: 74464,
  manifest: { files: 1, gz: 280, largest: 280 },
  chunks: { files: 17, gz: 60629, largest: 3733 },
  pages: { files: 19, gz: 13555, largest: 1465 },
  others: { files: 0, gz: 0, largest: 0 },
  documents: 110,
  articles: 10,
  kindRuns: 15,
  worst: { manifest: 280, chunks: 29500, pages: 13532, total: 43312 },
  unfilled: { chunks: 0, pages: 1, bytes: 713 },
  growth: { postingBytes: 5597, chunks: 0.4555, files: 0.6222, manifestBytes: 4.34 },
  lists: { cut: 0, soonest: { key: 're', postings: 98, carriers: 10 } },
};

test('the measurement is printed as a total, a table of the three kinds of file, the counts, the worst first query and one line for each limit', () => {
  assert.deepEqual(renderMeasurement(MEASURED, OPTIONS), [
    'search index: 37 files, 74464 bytes gz',
    'class           files  bytes gz  largest',
    'manifest            1       280      280',
    'term chunks        17     60629     3733',
    'document pages     19     13555     1465',
    '',
    'documents: 110, of which 10 Writing articles; 15 kind runs',
    'first query worst case: 43312 bytes gz of 65536 (manifest 280 + 8 largest chunks 29500 + 19 largest pages 13532), 22224 to spare',
    'still to fill: 713 bytes gz, the pages and chunks a query can fetch that do not exist yet (pages 1, chunks 0)',
    'one more article adds about 5597 bytes of chunk text: 0.46 chunks, 0.62 files and 4.3 bytes of manifest (raw, gzip assumed to save nothing), estimated from the postings and keys the articles own',
    'first query budget (65536 bytes gz): after 4957 more articles, in 2479 days, on 2033-08-18, at 2 articles a day, beyond 5 years',
    'file budget (4000 files): after 6370 more articles, in 3185 days, on 2035-07-25, at 2 articles a day, beyond 5 years',
    'list cap (1228 postings): "re" holds 98, carried by 10 of 10 articles; after 1130 more articles, in 565 days, on 2028-05-22, at 2 articles a day, inside 5 years',
  ]);
});

test('an index over its budget, with other files and cut lists, says so line by line', () => {
  const crowded = {
    ...MEASURED,
    files: 39,
    gz: 74514,
    others: { files: 2, gz: 50, largest: 30 },
    worst: { manifest: 280, chunks: 30000, pages: 40000, total: 70280 },
    unfilled: { chunks: 0, pages: 0, bytes: 0 },
    lists: { cut: 3, soonest: null },
  };

  assert.deepEqual(renderMeasurement(crowded, OPTIONS), [
    'search index: 39 files, 74514 bytes gz',
    'class           files  bytes gz  largest',
    'manifest            1       280      280',
    'term chunks        17     60629     3733',
    'document pages     19     13555     1465',
    'other files         2        50       30',
    '',
    'documents: 110, of which 10 Writing articles; 15 kind runs',
    'first query worst case: 70280 bytes gz of 65536 (manifest 280 + 8 largest chunks 30000 + 19 largest pages 40000), 4744 over the budget',
    'one more article adds about 5597 bytes of chunk text: 0.46 chunks, 0.62 files and 4.3 bytes of manifest (raw, gzip assumed to save nothing), estimated from the postings and keys the articles own',
    'first query budget (65536 bytes gz): already over by 4744 bytes gz',
    'file budget (4000 files): after 6367 more articles, in 3184 days, on 2035-07-24, at 2 articles a day, beyond 5 years',
    'list cap (1228 postings): 3 lists are cut already and keep their best 1228 documents',
  ]);
});

const lineOf = (measured, start) => renderMeasurement(measured, OPTIONS).find((line) => line.startsWith(start));
const withGrowth = (growth) => ({ ...MEASURED, growth: { ...MEASURED.growth, ...growth } });

test('a first query that does not grow with an article and one that grows past a hundred years are not given a date', () => {
  assert.equal(
    lineOf(withGrowth({ manifestBytes: 0 }), 'first query budget'),
    'first query budget (65536 bytes gz): not reached, it does not grow with an article'
  );
  assert.equal(
    lineOf(withGrowth({ manifestBytes: 1e-9 }), 'first query budget'),
    'first query budget (65536 bytes gz): not reached within 100 years'
  );
});

test('the first query line says to spare up to exactly the budget and over the budget from one byte more', () => {
  const at = (total) => lineOf({ ...MEASURED, worst: { ...MEASURED.worst, total } }, 'first query worst case');

  assert.ok(at(65536).endsWith('), 0 to spare'), at(65536));
  assert.ok(at(65537).endsWith('), 1 over the budget'), at(65537));
});

test('an index with no Writing article prints no growth and no limit, and a list cap no article carries says so', () => {
  const none = { ...MEASURED, articles: 0, growth: null, lists: { cut: 0, soonest: null } };
  const lines = renderMeasurement(none, OPTIONS);

  assert.equal(lines.at(-1), 'no Writing articles in the index, so there is no growth per article to project');
  assert.equal(lines.filter((line) => /budget|list cap|one more article/.test(line)).length, 0);
  assert.equal(
    lineOf({ ...MEASURED, lists: { cut: 0, soonest: null } }, 'list cap'),
    'list cap (1228 postings): no list holds an article'
  );
});

const PAGES = articles(6, { words: 40 }).map((page, at) => ({ ...page, href: `/pages/page-${at}`, kind: 'Page' }));
const ownWords = (article, at) => ({
  ...article,
  text: `${article.text} ${Array.from({ length: 300 }, (_, word) => `w${at.toString(36)}x${word.toString(36)}`).join(' ')}`,
});
const INDEX = buildSearchIndex([...articles(30, { words: 150 }).map(ownWords), ...PAGES]);
const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const REACH_LINE =
  /^(first query budget|file budget|list cap) .*after (\d+) more articles, in (\d+) days, on (\d{4}-\d{2}-\d{2}), at ([\d.]+) articles a day, (inside|beyond) 5 years$/;
const reachLines = (stdout) =>
  stdout
    .split('\n')
    .map((line) => REACH_LINE.exec(line))
    .filter(Boolean);

test('the command prints the measurement of the dist it is given and exits 0, from the files on disk', () => {
  withDist(INDEX.files, (dist) => {
    const { status, stdout, stderr } = cli(dist, '--per-day', '2', '--today', TODAY);

    assert.equal(status, 0, stderr);
    assert.equal(stderr, '');
    assert.equal(stdout, `${renderMeasurement(measureSearchIndex(INDEX.files), OPTIONS).join('\n')}\n`);
    assert.ok(stdout.includes(`first query worst case: ${firstQueryWorstCase(dist)} bytes gz of 65536`));
  });
});

test('the rate and the day the dates start from are the flags given: days follow the rate, dates follow the day', () => {
  withDist(INDEX.files, (dist) => {
    const { stdout } = cli(dist, '--per-day=4', '--today=2030-01-01');
    const lines = reachLines(stdout);

    assert.equal(lines.length, 3);
    for (const [, , articlesToGo, days, date, perDay] of lines) {
      assert.equal(perDay, '4');
      assert.equal(Number(days), Math.ceil(Number(articlesToGo) / 4));
      assert.equal(Date.parse(`${date}T00:00:00Z`) - Date.parse('2030-01-01T00:00:00Z'), Number(days) * DAY);
    }
  });
});

test('with no rate given the command takes the articles a day from the write times of the engine config', () => {
  withDist(INDEX.files, (dist) => {
    const writesADay = readEngineConfig().loop.writeTimesUtc.length;
    const lines = reachLines(cli(dist, '--today', TODAY).stdout);

    assert.equal(lines.length, 3);
    assert.deepEqual([...new Set(lines.map((line) => line[5]))], [String(writesADay)]);
  });
});

const LATE_UTC = '2031-03-15T23:30:00Z';
const FAKE_CLOCK = encodeURIComponent(
  `const Real = Date; globalThis.Date = class extends Real { constructor(...args) { super(...(args.length === 0 ? [${Date.parse(LATE_UTC)}] : args)); } static now() { return ${Date.parse(LATE_UTC)}; } };`
);

test('with no day given the dates start from today in UTC, in whatever time zone the command runs', () => {
  withDist(INDEX.files, (dist) => {
    const run = spawnSync(
      process.execPath,
      ['--import', `data:text/javascript,${FAKE_CLOCK}`, SCRIPT, dist, '--per-day', '2'],
      {
        encoding: 'utf8',
        env: { ...process.env, TZ: 'Pacific/Kiritimati' },
      }
    );
    const [, , , days, date] = reachLines(run.stdout)[0];

    assert.equal(run.status, 0, run.stderr);
    assert.equal(Date.parse(`${date}T00:00:00Z`) - Date.parse('2031-03-15T00:00:00Z'), Number(days) * DAY);
  });
});

test('the command refuses an index it cannot measure with exit 2 and one MEASURE-SEARCH line naming the dist and the file', () => {
  const lost = chunkPath(INDEX.manifest.version, 0);
  const refusals = [
    [new Map(), `${manifestPath} is missing`],
    [change(INDEX.files, manifestPath, '{"version":'), `${manifestPath} is not valid JSON`],
    [without(INDEX.files, lost), `${lost} is named by the manifest but missing`],
  ];

  for (const [files, reason] of refusals) {
    withDist(files, (dist) => {
      const { status, stdout, stderr } = cli(dist);

      assert.equal(status, 2, reason);
      assert.equal(stdout, '');
      assert.equal(stderr, `MEASURE-SEARCH ${dist}: ${reason}\n`);
    });
  }
});

test('the command refuses a command line it does not understand with the usage and exit 2', () => {
  withDist(INDEX.files, (dist) => {
    const lines = [
      [],
      [dist, dist],
      [dist, '--unknown'],
      [dist, '--per-day'],
      [dist, '--per-day=0'],
      [dist, '--per-day=-2'],
      [dist, '--per-day=many'],
      [dist, '--today=tomorrow'],
      [dist, '--today=2026-13-01'],
      [dist, '--today=2026-02-30'],
    ];

    for (const args of lines) {
      const { status, stdout, stderr } = cli(...args);

      assert.equal(status, 2, args.join(' '));
      assert.equal(stdout, '');
      assert.match(
        stderr,
        /^usage: node scripts\/measure-search\.mjs <dist directory> \[--per-day <articles>\] \[--today <YYYY-MM-DD>\]\n$/
      );
    }
  });
});
