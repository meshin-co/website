import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { readLedger } from './autowriter-ledger.mjs';
import { EscalationError } from './escalate.mjs';
import { NOW, WEBHOOK, fakeApi, withScene } from './fixtures/spend-run.mjs';
import { recordFiles } from './record-layout.mjs';
import { noticeFile, noticePosted, noticeSlug, raiseNotice } from './spend-notice.mjs';

const ENV = {
  GITHUB_TOKEN: 'ghp_SECRETtokenVALUE0123456789',
  GITHUB_REPOSITORY: 'meshin-co/website',
  SLACK_WEBHOOK_URL: WEBHOOK,
};
const raise = (scene, api, month = '2026-11') =>
  raiseNotice({
    repoRoot: scene.root,
    month,
    spentUsd: 25.5,
    ceilingUsd: 25,
    env: ENV,
    fetch: api.fetch,
    now: () => NOW,
  });
const ledgerOf = (scene, month = '2026-11') => readLedger(join(scene.root, noticeFile(month)));

test('the notice of a month is a ledger named for that month', () => {
  assert.equal(noticeSlug('2026-11'), 'spend-ceiling-2026-11');
  assert.equal(noticeSlug('2027-01'), 'spend-ceiling-2027-01');
});

test('the notice of a month is filed under that month, so its path depends on the month and on nothing else', () => {
  assert.equal(noticeFile('2026-11'), 'audits/autowriter/2026/11/spend-ceiling-2026-11.json');
  assert.equal(noticeFile('2027-01'), 'audits/autowriter/2027/01/spend-ceiling-2027-01.json');
});

test(
  'a raised notice is filed in the directory of the month it is about, whatever day it is raised, and nowhere else',
  withScene(async (scene) => {
    await raise(scene, fakeApi());
    await raise(scene, fakeApi(), '2026-12');
    assert.deepEqual(recordFiles(scene.root, 'ledger'), [
      'audits/autowriter/2026/11/spend-ceiling-2026-11.json',
      'audits/autowriter/2026/12/spend-ceiling-2026-12.json',
    ]);
  })
);

test(
  'no notice file means no notice was posted',
  withScene((scene) => {
    assert.equal(noticePosted({ repoRoot: scene.root, month: '2026-11' }), false);
  })
);

test(
  'a delivered notice counts for its own month only',
  withScene(async (scene) => {
    await raise(scene, fakeApi());
    assert.equal(noticePosted({ repoRoot: scene.root, month: '2026-11' }), true);
    assert.equal(noticePosted({ repoRoot: scene.root, month: '2026-12' }), false);
  })
);

test(
  'the notice names the month, the spend and the ceiling in its title and says what the stop means',
  withScene(async (scene) => {
    await raise(scene, fakeApi());
    const [escalation] = ledgerOf(scene).escalations;
    assert.equal(escalation.kind, 'spend-ceiling');
    assert.match(escalation.title, /2026-11/);
    assert.match(escalation.title, /25\.5 USD of 25 USD/);
    assert.match(escalation.detail, /before it called any model/);
  })
);

test(
  'a notice whose Slack post failed is not posted, and the retry sends only what is missing',
  withScene(async (scene) => {
    const api = fakeApi({ slack: [500, 200] });
    await assert.rejects(() => raise(scene, api), EscalationError);
    assert.equal(noticePosted({ repoRoot: scene.root, month: '2026-11' }), false);
    await raise(scene, api);
    assert.equal(noticePosted({ repoRoot: scene.root, month: '2026-11' }), true);
    assert.equal(api.calls.issue.length, 1);
    assert.equal(api.calls.slack.length, 2);
    assert.equal(ledgerOf(scene).escalations.length, 1);
  })
);

test(
  'a notice whose issue failed is not posted either, and the retry opens the issue without a second Slack post',
  withScene(async (scene) => {
    const api = fakeApi({ issue: [403, 201] });
    await assert.rejects(() => raise(scene, api), EscalationError);
    assert.equal(noticePosted({ repoRoot: scene.root, month: '2026-11' }), false);
    await raise(scene, api);
    assert.equal(noticePosted({ repoRoot: scene.root, month: '2026-11' }), true);
    assert.equal(api.calls.issue.length, 2);
    assert.equal(api.calls.slack.length, 1);
  })
);

test(
  'a damaged notice file is an error, never read as no notice',
  withScene((scene) => {
    scene.put(noticeFile('2026-11'), '{ nope');
    assert.throws(() => noticePosted({ repoRoot: scene.root, month: '2026-11' }), /spend-ceiling-2026-11\.json/);
  })
);
