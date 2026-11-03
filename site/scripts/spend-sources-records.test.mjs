import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { callOf } from './fixtures/generation-input.mjs';
import { createScene, ledgerOf, recordOf } from './fixtures/spend-scene.mjs';
import { readLedgers } from './spend-sources.mjs';
import { microOf, monthlySpend } from './spend-sum.mjs';

const AT = '2026-11-02T08:00:00Z';
const MONTH = '2026-11';

const withScene = (body) => async () => {
  const scene = createScene();
  try {
    await body(scene);
  } finally {
    scene.cleanup();
  }
};
const read = (scene) => readLedgers({ repoRoot: scene.root });

test(
  'the glossary term of a run names the ledger of the run, so it is part of that run and not a record without a ledger',
  withScene((scene) => {
    scene.putLedger(ledgerOf({ slug: 'run-post', generationUsd: 1.5 }));
    scene.putRecord(recordOf({ slug: 'run-post', generatedAt: AT, usd: 1 }));
    scene.putRecord(recordOf({ slug: 'run-term', generatedAt: AT, usd: 0.5, ledgerSlug: 'run-post' }));
    scene.commit();
    const [only, ...rest] = read(scene);
    assert.deepEqual(rest, []);
    assert.equal(only.ledger.slug, 'run-post');
    assert.equal(monthlySpend({ ledgers: [only], month: MONTH }), microOf(1.5));
  })
);

test(
  'a record on one branch whose ledger is on main is not set aside, because the ledger exists in a source',
  withScene((scene) => {
    scene.putLedger(ledgerOf({ slug: 'split-post', generationUsd: 1 }));
    scene.commit();
    scene.onBranch('autowriter/split-post', () => {
      scene.putRecord(recordOf({ slug: 'split-post', generatedAt: AT, usd: 1 }));
    });
    assert.deepEqual(
      read(scene).map(({ ledger }) => ledger?.slug),
      ['split-post']
    );
  })
);

test(
  'a record on two sources comes back once, as the version that costs the most',
  withScene((scene) => {
    scene.putRecord(recordOf({ slug: 'twice-post', generatedAt: AT, usd: 1 }));
    scene.commit();
    scene.onBranch('autowriter/twice-post', () => {
      scene.putRecord(recordOf({ slug: 'twice-post', generatedAt: AT, usd: 3 }));
    });
    const items = read(scene);
    assert.equal(items.length, 1);
    assert.equal(monthlySpend({ ledgers: items, month: MONTH }), microOf(3));
  })
);

test(
  'a record whose repair calls the ledger attempts do not cover is counted at the record cost',
  withScene((scene) => {
    scene.putLedger(ledgerOf({ slug: 'fixed-post', generationUsd: 1 }));
    scene.putRecord(
      recordOf({
        slug: 'fixed-post',
        generatedAt: AT,
        usd: 1,
        extraCalls: [callOf('repair', { input: 500000, output: 0 }, 'repair-fixed-post')],
      })
    );
    scene.commit();
    assert.equal(monthlySpend({ ledgers: read(scene), month: MONTH }), microOf(1.5));
  })
);

test(
  'the glossary term of a run that cost more than its ledger records is counted at its record cost, as the report counts it',
  withScene((scene) => {
    scene.putLedger(ledgerOf({ slug: 'run-post', generationUsd: 1 }));
    scene.putRecord(recordOf({ slug: 'run-post', generatedAt: AT, usd: 1 }));
    scene.putRecord(recordOf({ slug: 'run-term', generatedAt: AT, usd: 0.5, ledgerSlug: 'run-post' }));
    scene.commit();
    assert.equal(monthlySpend({ ledgers: read(scene), month: MONTH }), microOf(1.5));
  })
);
