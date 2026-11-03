import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';

import { MONTHLY_SPEND_CEILING_USD, readLedger } from './autowriter-ledger.mjs';
import { NOTICE, fakeApi, harness, spending, withScene } from './fixtures/spend-run.mjs';
import { PLACES } from './fixtures/record-depths.mjs';
import { FILED_AT, ledgerOf, recordOf } from './fixtures/spend-scene.mjs';
import { recordFiles, recordPath } from './record-layout.mjs';
import { ceilingStatus, inspect, monthLineOf } from './spend-ceiling.mjs';

const CEILING = MONTHLY_SPEND_CEILING_USD;
const IN_NOVEMBER = '2026-11-03T08:00:00Z';
const status = (scene) => ceilingStatus({ repoRoot: scene.root, now: new Date('2026-11-10T09:00:00.000Z') });

test(
  'a notice ledger carries no spend and does not change the sum',
  withScene(async (scene) => {
    scene.putLedger(spending('big-post', CEILING));
    const first = harness(scene);
    assert.equal(await first.run(), 0);
    const after = status(scene);
    assert.equal(after.spentMicro, CEILING * 1e6);
    assert.equal(after.noticePosted, true);
  })
);

test(
  'under the ceiling the run prints one JSON line, calls nothing and says no model was called',
  withScene(async (scene) => {
    scene.putLedger(spending('small-post', 1.25));
    const run = harness(scene);
    assert.equal(await run.run(), 0);
    assert.deepEqual(
      run.out.map((line) => JSON.parse(line)),
      [
        {
          month: '2026-11',
          spentUsd: 1.25,
          ceilingUsd: CEILING,
          reached: false,
          notice: 'none',
          ledgers: 1,
          records: 0,
        },
      ]
    );
    assert.deepEqual(run.err, []);
    assert.deepEqual(run.api.calls, { slack: [], issue: [] });
    assert.equal(existsSync(join(scene.root, NOTICE)), false);
    assert.deepEqual(run.output().trim().split('\n'), ['stopped=false', 'notice=none', `ledger=${NOTICE}`]);
    assert.match(run.summary(), /No model was called by this job/);
    assert.match(run.summary(), /2026-11/);
  })
);

test(
  'at the ceiling the first run opens one issue, posts once to Slack and writes the notice ledger',
  withScene(async (scene) => {
    scene.putLedger(spending('full-post', CEILING));
    const run = harness(scene);
    assert.equal(await run.run(), 0);
    assert.deepEqual(
      run.out.map((line) => JSON.parse(line)),
      [
        {
          month: '2026-11',
          spentUsd: CEILING,
          ceilingUsd: CEILING,
          reached: true,
          notice: 'written',
          ledgers: 1,
          records: 0,
        },
      ]
    );
    assert.equal(run.api.calls.issue.length, 1);
    assert.equal(run.api.calls.slack.length, 1);
    assert.match(run.api.calls.slack[0].text, /spend-ceiling/);
    assert.match(run.api.calls.slack[0].text, /2026-11/);
    const ledger = readLedger(join(scene.root, NOTICE));
    assert.equal(ledger.slug, 'spend-ceiling-2026-11');
    assert.equal(ledger.escalations.length, 1);
    assert.equal(ledger.escalations[0].kind, 'spend-ceiling');
    assert.deepEqual(
      ledger.escalations[0].receipts.map(({ channel, delivered }) => [channel, delivered]),
      [
        ['issue', true],
        ['slack', true],
      ]
    );
    assert.equal(ledger.spend.costUsd, 0);
    assert.deepEqual(run.output().trim().split('\n'), ['stopped=true', 'notice=written', `ledger=${NOTICE}`]);
    assert.match(run.summary(), /No model was called by this job/);
  })
);

test(
  'Slack is told once: a second run in the same month finds the delivered notice and posts nothing',
  withScene(async (scene) => {
    scene.putLedger(spending('full-post', CEILING + 1));
    const api = fakeApi();
    const first = harness(scene, { api });
    const second = harness(scene, { api, now: new Date('2026-11-11T09:00:00Z') });
    assert.equal(await first.run(), 0);
    assert.equal(await second.run(), 0);
    assert.equal(api.calls.slack.length, 1);
    assert.equal(api.calls.issue.length, 1);
    assert.equal(JSON.parse(second.out[0]).notice, 'exists');
    assert.equal(JSON.parse(second.out[0]).reached, true);
    assert.equal(JSON.parse(first.out[0]).ledgers, 1);
    assert.equal(JSON.parse(second.out[0]).ledgers, 2);
    assert.deepEqual(second.output().trim().split('\n'), ['stopped=true', 'notice=exists', `ledger=${NOTICE}`]);
    assert.equal(readLedger(join(scene.root, NOTICE)).escalations.length, 1);
  })
);

test(
  'the next month has its own notice file and posts again only when the ceiling is reached again',
  withScene(async (scene) => {
    scene.putLedger(spending('november-post', CEILING));
    const api = fakeApi();
    const november = harness(scene, { api });
    assert.equal(await november.run(), 0);
    const december = harness(scene, { api, now: new Date('2026-12-02T09:00:00Z') });
    assert.equal(await december.run(), 0);
    assert.equal(JSON.parse(december.out[0]).notice, 'none');
    assert.equal(api.calls.slack.length, 1);
    scene.putLedger(spending('december-post', CEILING, '2026-12-01T10:00:00Z'));
    const again = harness(scene, { api, now: new Date('2026-12-03T09:00:00Z') });
    assert.equal(await again.run(), 0);
    assert.equal(JSON.parse(again.out[0]).notice, 'written');
    assert.equal(api.calls.slack.length, 2);
    assert.deepEqual(
      recordFiles(scene.root, 'ledger').filter((path) => basename(path).startsWith('spend-ceiling-')),
      ['audits/autowriter/2026/11/spend-ceiling-2026-11.json', 'audits/autowriter/2026/12/spend-ceiling-2026-12.json']
    );
  })
);

test(
  'a Slack delivery that fails exits 1, names Slack and sets no output, so the run goes red',
  withScene(async (scene) => {
    scene.putLedger(spending('full-post', CEILING));
    const run = harness(scene, { api: fakeApi({ slack: [500] }) });
    assert.equal(await run.run(), 1);
    assert.deepEqual(run.out, []);
    assert.match(run.err.join('\n'), /slack/i);
    assert.equal(run.output(), '');
  })
);

test(
  'an issue that cannot be opened exits 1',
  withScene(async (scene) => {
    scene.putLedger(spending('full-post', CEILING));
    const run = harness(scene, { api: fakeApi({ issue: [403] }) });
    assert.equal(await run.run(), 1);
    assert.match(run.err.join('\n'), /issue/i);
  })
);

test(
  'after a failed delivery the next run finishes the same escalation without a second issue',
  withScene(async (scene) => {
    scene.putLedger(spending('full-post', CEILING));
    const api = fakeApi({ slack: [500, 200] });
    const failed = harness(scene, { api });
    assert.equal(await failed.run(), 1);
    const retried = harness(scene, { api });
    assert.equal(await retried.run(), 0);
    assert.equal(JSON.parse(retried.out[0]).notice, 'written');
    assert.equal(api.calls.issue.length, 1);
    assert.equal(api.calls.slack.length, 2);
    const ledger = readLedger(join(scene.root, NOTICE));
    assert.equal(ledger.escalations.length, 1);
    const third = harness(scene, { api });
    assert.equal(await third.run(), 0);
    assert.equal(JSON.parse(third.out[0]).notice, 'exists');
    assert.equal(api.calls.slack.length, 2);
  })
);

test(
  'unreadable data exits 1 with the file named and calls nothing',
  withScene(async (scene) => {
    scene.put(recordPath('ledger', 'bad-post', IN_NOVEMBER), 'not json');
    const run = harness(scene);
    assert.equal(await run.run(), 1);
    assert.match(run.err.join('\n'), /audits\/autowriter\/2026\/11\/bad-post\.json/);
    assert.deepEqual(run.out, []);
    assert.deepEqual(run.api.calls, { slack: [], issue: [] });
  })
);

test(
  'a damaged notice ledger exits 1 instead of being posted over',
  withScene(async (scene) => {
    scene.putLedger(spending('full-post', CEILING));
    scene.put(NOTICE, '{ nope');
    const run = harness(scene);
    assert.equal(await run.run(), 1);
    assert.match(run.err.join('\n'), /spend-ceiling-2026-11\.json/);
    assert.deepEqual(run.api.calls, { slack: [], issue: [] });
  })
);

test(
  'a ledger that under-counts its generation record prints one warning line and still exits 0',
  withScene(async (scene) => {
    scene.putLedger(ledgerOf({ slug: 'short-post', generationUsd: 1 }));
    scene.putRecord(recordOf({ slug: 'short-post', generatedAt: IN_NOVEMBER, usd: 2 }));
    const run = harness(scene);
    assert.equal(await run.run(), 0);
    assert.equal(run.err.length, 1);
    assert.match(run.err[0], /^warning: short-post/);
    assert.equal(JSON.parse(run.out[0]).spentUsd, 2);
    assert.equal(JSON.parse(run.out[0]).ledgers, 1);
    assert.equal(JSON.parse(run.out[0]).records, 1);
  })
);

test(
  '--now picks the month, and a bad argument is a usage error with exit 2',
  withScene(async (scene) => {
    scene.putLedger(spending('oct-post', 2, '2026-10-05T00:00:00Z'));
    const run = harness(scene);
    assert.equal(await run.run(['--now', '2026-10-20T00:00:00Z']), 0);
    assert.equal(JSON.parse(run.out[0]).month, '2026-10');
    assert.equal(JSON.parse(run.out[0]).spentUsd, 2);
    for (const argv of [['--now', 'yesterday'], ['--nope', '1'], ['--now'], ['stray']]) {
      const bad = harness(scene);
      assert.equal(await bad.run(argv), 2, argv.join(' '));
      assert.match(bad.err.join('\n'), /Usage/);
      assert.deepEqual(bad.out, []);
    }
  })
);

const READ = {
  month: '2026-11',
  spentUsd: 7,
  ceilingUsd: CEILING,
  reached: false,
  notice: 'none',
  ledgers: 3,
  records: 3,
};

const ENTRIES = [
  ['alpha-post', 1],
  ['beta-post', 2],
  ['gamma-post', 4],
];
const beside = (at) => ENTRIES.map(() => [at, at]);
const APART = [
  [FILED_AT.flat, FILED_AT.month],
  [FILED_AT.month, FILED_AT.deeper],
  [FILED_AT.deeper, FILED_AT.flat],
];

const putEntries = (scene, places, { without = [] } = {}) =>
  ENTRIES.forEach(([slug, usd], index) => {
    const [ledgerAt, recordAt] = places[index];
    scene.put(ledgerAt('ledger', slug), ledgerOf({ slug, generationUsd: usd }));
    if (!without.includes(slug))
      scene.put(recordAt('generation', slug), recordOf({ slug, generatedAt: IN_NOVEMBER, usd }));
  });

const linesOf = (run) => run.out.map((line) => JSON.parse(line));

for (const [layout, place] of Object.entries(PLACES)) {
  test(
    `the line counts three ledgers and three generation records, all filed ${place}`,
    withScene(async (scene) => {
      putEntries(scene, beside(FILED_AT[layout]));
      const run = harness(scene);
      assert.equal(await run.run(), 0);
      assert.deepEqual(linesOf(run), [READ]);
      assert.deepEqual(run.err, []);
    })
  );
}

test(
  'the line counts the same when the ledgers and the records of one repository lie at all three depths',
  withScene(async (scene) => {
    putEntries(scene, APART);
    const run = harness(scene);
    assert.equal(await run.run(), 0);
    assert.deepEqual(linesOf(run), [READ]);
  })
);

test(
  'a ledger without a generation record counts as a ledger and not as a record, at whatever depth it lies',
  withScene(async (scene) => {
    putEntries(scene, APART, { without: ['alpha-post'] });
    const run = harness(scene);
    assert.equal(await run.run(), 0);
    assert.deepEqual(linesOf(run), [{ ...READ, records: 2 }]);
  })
);

test(
  'moving the files from the flat layout into their months changes neither a count nor the spend',
  withScene(async (scene) => {
    putEntries(scene, beside(FILED_AT.flat));
    scene.commit('flat');
    const before = harness(scene);
    assert.equal(await before.run(), 0);
    for (const family of ['ledger', 'generation'])
      for (const path of recordFiles(scene.root, family)) {
        const month = FILED_AT.month(family, basename(path, '.json'));
        mkdirSync(dirname(join(scene.root, month)), { recursive: true });
        scene.git('mv', path, month);
      }
    scene.commit('month');
    assert.deepEqual(recordFiles(scene.root, 'ledger'), [
      'audits/autowriter/2026/11/alpha-post.json',
      'audits/autowriter/2026/11/beta-post.json',
      'audits/autowriter/2026/11/gamma-post.json',
    ]);
    const after = harness(scene);
    assert.equal(await after.run(), 0);
    assert.deepEqual(linesOf(before), [READ]);
    assert.deepEqual(linesOf(after), [READ]);
  })
);

test(
  'a generation record whose ledger is gone is counted by the ceiling and named in a warning, and is not counted as a ledger',
  withScene((scene) => {
    scene.putRecord(recordOf({ slug: 'orphan-post', generatedAt: IN_NOVEMBER, usd: 2 }));
    const { status, warnings, read } = inspect({ repoRoot: scene.root, now: new Date('2026-11-10T09:00:00.000Z') });
    assert.equal(status.spentUsd, 2);
    assert.deepEqual(read, { ledgers: 0, records: 1 });
    assert.match(warnings[0], /orphan-post: .* which does not exist, so its cost is counted from the record alone/);
  })
);

test('the status of a month becomes the one sentence the report and Slack carry', () => {
  assert.equal(
    monthLineOf({ month: '2026-11', spentMicro: 22_748, ceilingUsd: 25 }),
    '2026-11 so far: 0.022748 USD spent of the 25.00 USD monthly ceiling, 24.977252 USD left.'
  );
  assert.equal(
    monthLineOf({ month: '2026-11', spentMicro: 25_000_000, ceilingUsd: 25 }),
    '2026-11 so far: 25.00 USD spent of the 25.00 USD monthly ceiling, none left: the ceiling is reached, so the writer does not run for the rest of the month.'
  );
});
