import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MONTHLY_SPEND_CEILING_USD } from './autowriter-ledger.mjs';
import { NOW, spending, withScene } from './fixtures/spend-run.mjs';
import { ledgerOf, recordOf } from './fixtures/spend-scene.mjs';
import { ceilingStatus } from './spend-ceiling.mjs';

const CEILING = MONTHLY_SPEND_CEILING_USD;
const status = (scene, options = {}) => ceilingStatus({ repoRoot: scene.root, now: NOW, ...options });

test(
  'the ceiling comes from the ledger module and an empty repository has spent nothing',
  withScene((scene) => {
    const result = status(scene);
    assert.deepEqual(result, {
      month: '2026-11',
      spentMicro: 0,
      spentUsd: 0,
      ceilingUsd: CEILING,
      reached: false,
      noticePosted: false,
    });
  })
);

test(
  'reached means spent is at or above the ceiling, to the micro-dollar',
  withScene((scene) => {
    scene.putLedger(spending('first-post', CEILING - 0.000001));
    assert.equal(status(scene).reached, false);
    assert.equal(status(scene).spentMicro, CEILING * 1e6 - 1);
    scene.putLedger(spending('second-post', 0.000001));
    const at = status(scene);
    assert.equal(at.reached, true);
    assert.equal(at.spentMicro, CEILING * 1e6);
    assert.equal(at.spentUsd, CEILING);
  })
);

test(
  'the month under test is the UTC calendar month of now: spend of the last second of October is not November',
  withScene((scene) => {
    scene.putLedger(spending('october-post', CEILING, '2026-10-31T23:59:59Z'));
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2026-11-01T00:00:00Z') }).reached, false);
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2026-10-31T23:59:59Z') }).reached, true);
  })
);

test(
  'one ledger that straddles the boundary is split by the instant of each attempt',
  withScene((scene) => {
    scene.putLedger(
      ledgerOf({
        slug: 'straddle-post',
        attempts: [
          { at: '2026-10-31T23:59:59Z', usd: 10 },
          { at: '2026-11-01T00:00:00Z', usd: 3 },
        ],
      })
    );
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2026-10-20T00:00:00Z') }).spentMicro, 10_000_000);
    assert.equal(status(scene).spentMicro, 3_000_000);
  })
);

test(
  'a leap day belongs to February and the first of March to March',
  withScene((scene) => {
    scene.putLedger(
      ledgerOf({
        slug: 'leap-post',
        attempts: [
          { at: '2028-02-29T23:59:59Z', usd: 4 },
          { at: '2028-03-01T00:00:00Z', usd: 5 },
        ],
      })
    );
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2028-02-29T12:00:00Z') }).spentMicro, 4_000_000);
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2028-03-01T00:00:00Z') }).spentMicro, 5_000_000);
  })
);

test(
  'the generation is placed by its record, the attempts by their own instants',
  withScene((scene) => {
    scene.putLedger(
      ledgerOf({ slug: 'placed-post', generationUsd: 7, attempts: [{ at: '2026-11-01T00:00:01Z', usd: 2 }] })
    );
    scene.putRecord(recordOf({ slug: 'placed-post', generatedAt: '2026-10-31T23:00:00.000Z', usd: 7 }));
    assert.equal(status(scene).spentMicro, 2_000_000);
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2026-10-31T23:30:00Z') }).spentMicro, 7_000_000);
  })
);

test(
  'a generation that cannot be placed counts against whichever month is under test',
  withScene((scene) => {
    scene.putLedger(ledgerOf({ slug: 'lost-post', generationUsd: CEILING }));
    assert.equal(status(scene).reached, true);
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2026-12-02T00:00:00Z') }).reached, true);
  })
);

test(
  'a stopped write with no record is placed by the instant it was decided',
  withScene((scene) => {
    scene.putLedger(ledgerOf({ slug: 'stopped-post', generationUsd: 6, decidedAt: '2026-10-30T10:00:00Z' }));
    assert.equal(status(scene).spentMicro, 0);
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2026-10-31T00:00:00Z') }).spentMicro, 6_000_000);
  })
);

test(
  'spend that lives only on an autowriter branch counts toward the ceiling',
  withScene((scene) => {
    scene.onBranch('autowriter/open-post', () => scene.putLedger(spending('open-post', CEILING)));
    assert.equal(status(scene).reached, true);
  })
);

test(
  'one slug on main and on its branch is counted once, as the larger version',
  withScene((scene) => {
    scene.putLedger(spending('twice-post', 12));
    scene.commit();
    scene.onBranch('autowriter/twice-post', () => scene.putLedger(spending('twice-post', 20)));
    const result = status(scene);
    assert.equal(result.spentMicro, 20_000_000);
    assert.equal(result.reached, CEILING <= 20);
  })
);

test(
  'a malformed ledger stops the check with the file named, because the ceiling is never judged on unread data',
  withScene((scene) => {
    scene.put('audits/autowriter/broken-post.json', '{ nope');
    assert.throws(() => status(scene), /broken-post\.json/);
  })
);

test(
  'spend merged to origin/main counts from a detached older checkout, split by month at the boundary',
  withScene((scene) => {
    scene.putLedger(
      ledgerOf({
        slug: 'merged-post',
        attempts: [
          { at: '2026-10-31T23:59:59Z', usd: 10 },
          { at: '2026-11-01T00:00:00Z', usd: CEILING },
        ],
      })
    );
    scene.git('update-ref', 'refs/remotes/origin/main', scene.commit());
    scene.git('checkout', '-q', '--detach', 'HEAD~1');
    scene.git('branch', '-q', '-D', 'main');
    const november = status(scene);
    assert.equal(november.spentMicro, CEILING * 1e6);
    assert.equal(november.reached, true);
    assert.equal(ceilingStatus({ repoRoot: scene.root, now: new Date('2026-10-31T23:59:59Z') }).spentMicro, 10_000_000);
  })
);
