import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { MONTHLY_SPEND_CEILING_USD, readLedger } from './autowriter-ledger.mjs';
import { NOTICE, fakeApi, harness, spending, withScene } from './fixtures/spend-run.mjs';
import { ledgerOf, recordOf } from './fixtures/spend-scene.mjs';
import { ceilingStatus } from './spend-ceiling.mjs';

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
      [{ month: '2026-11', spentUsd: 1.25, ceilingUsd: CEILING, reached: false, notice: 'none' }]
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
      [{ month: '2026-11', spentUsd: CEILING, ceilingUsd: CEILING, reached: true, notice: 'written' }]
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
      readdirSync(join(scene.root, 'audits/autowriter'))
        .filter((name) => name.startsWith('spend-ceiling-'))
        .sort(),
      ['spend-ceiling-2026-11.json', 'spend-ceiling-2026-12.json']
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
    scene.put('audits/autowriter/bad-post.json', 'not json');
    const run = harness(scene);
    assert.equal(await run.run(), 1);
    assert.match(run.err.join('\n'), /bad-post\.json/);
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
