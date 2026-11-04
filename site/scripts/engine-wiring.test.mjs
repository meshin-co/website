import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after as afterAll, test } from 'node:test';

import { engineScene } from './fixtures/engine-scene.mjs';

const scenes = [];
afterAll(() => scenes.forEach((scene) => scene.remove()));
const sceneOf = (options) => {
  const scene = engineScene(options);
  scenes.push(scene);
  return scene;
};

const LOOP = {
  attemptCap: 7,
  tickMinutes: 6,
  quarantineHours: 20,
  monthlySpendCeilingUsd: 41.5,
  claimLifetimeDays: 21,
  holdLabel: 'pause-bot',
  writeTimesUtc: ['05:30', '17:45'],
  categoryRotation: ['executive', 'governance'],
};
const DEMAND = {
  property: 'sc-domain:elsewhere.test',
  windowDays: 30,
  dataLagDays: 5,
  maxAgeDays: 50,
  minImpressions: 4,
  strengthenBand: { min: 3, max: 12 },
};
const NOTES_RULE = { prefix: '/notes/', family: 'article', profile: 'article' };

const withLoop = (config) => ({ ...config, loop: { ...LOOP } });
const withDemand = (config) => ({ ...config, demand: { ...DEMAND } });
const withRoutes = (config) => ({
  ...config,
  routeFamilies: {
    rules: [NOTES_RULE, ...config.routeFamilies.rules],
    fallback: { family: 'tag-index', profile: 'offer' },
  },
});

const LIVE = [
  [
    'the attempt cap, the quarantine and the spend ceiling come from the loop section',
    'site/scripts/autowriter-ledger.mjs',
    withLoop,
    '[m.ATTEMPT_CAP, m.QUARANTINE_HOURS, m.MONTHLY_SPEND_CEILING_USD]',
    [7, 20, 41.5],
  ],
  [
    'the hold label and the chain limit come from the loop section',
    'site/scripts/pr-classify.mjs',
    withLoop,
    '[m.HOLD_LABEL, m.CHAIN_LIMIT_HOURS]',
    ['pause-bot', 44],
  ],
  [
    'the claim lifetime comes from the loop section',
    'site/scripts/autowriter-claim-store.mjs',
    withLoop,
    'm.CLAIM_LIFETIME_DAYS',
    21,
  ],
  [
    'the title family of a route comes from the route table, the fallback included',
    'site/scripts/semantic-core.mjs',
    withRoutes,
    "[m.familyFor('/notes/x'), m.familyFor('/blog/x'), m.familyFor('/nowhere')]",
    ['article', 'article', 'tag-index'],
  ],
  [
    'the content profile of a route comes from the route table, the fallback included',
    'site/scripts/content-gate.mjs',
    withRoutes,
    "[m.profileFor('/notes/x'), m.profileFor('/services/x'), m.profileFor('/nowhere')]",
    ['article', 'offer', 'offer'],
  ],
  [
    'the demand window and its data lag come from the demand section',
    'site/scripts/search-demand.mjs',
    withDemand,
    "m.measuredWindow('2026-11-02')",
    { measured: '2026-11-02', startDate: '2026-09-28', endDate: '2026-10-28' },
  ],
  [
    'the age limit of the committed report comes from the demand section',
    'site/scripts/search-demand-gate.mjs',
    withDemand,
    'm.MAX_AGE_DAYS',
    50,
  ],
  [
    'the strengthen band and the impression floor come from the demand section',
    'site/scripts/topic-demand.mjs',
    withDemand,
    '[m.STRENGTHEN_BAND, m.MIN_IMPRESSIONS]',
    [{ min: 3, max: 12 }, 4],
  ],
  [
    'the times the writer runs at come from the loop section',
    'site/scripts/schedule-workflow.mjs',
    withLoop,
    'm.WRITE_TIMES_UTC',
    ['05:30', '17:45'],
  ],
  [
    'the categories the writer rotates through come from the loop section',
    'site/scripts/topic-categories.mjs',
    withLoop,
    'm.CATEGORY_ROTATION',
    ['executive', 'governance'],
  ],
];

for (const [label, module, mutate, expression, expected] of LIVE) {
  test(`${label}`, () => {
    const scene = sceneOf({ entries: [module], mutate, extraFiles: ['site/src/config.yaml'] });
    assert.deepEqual(scene.evaluate(module, expression), expected);
  });
}

const REQUIRED = [
  ['site/scripts/autowriter-ledger.mjs', 'loop.attemptCap'],
  ['site/scripts/pr-classify.mjs', 'loop.holdLabel'],
  ['site/scripts/autowriter-claim-store.mjs', 'loop.claimLifetimeDays'],
  ['site/scripts/semantic-core.mjs', 'routeFamilies.fallback'],
  ['site/scripts/content-gate.mjs', 'routeFamilies.rules'],
  ['site/scripts/search-demand.mjs', 'demand.dataLagDays'],
  ['site/scripts/search-demand-gate.mjs', 'demand.maxAgeDays'],
  ['site/scripts/topic-demand.mjs', 'demand.strengthenBand'],
  ['site/scripts/schedule-workflow.mjs', 'loop.writeTimesUtc'],
  ['site/scripts/topic-categories.mjs', 'loop.categoryRotation'],
];

for (const [module, field] of REQUIRED) {
  test(`${module} refuses to load when ${field} is missing from its own configuration file`, () => {
    const [section, key] = field.split('.');
    const scene = sceneOf({
      entries: [module],
      mutate: (config) => {
        delete config[section][key];
        return config;
      },
    });
    assert.throws(
      () => scene.evaluate(module, '0'),
      (error) =>
        error.message.includes(join(scene.root, 'site/engine.config.json')) &&
        error.message.includes(`${field} is required`)
    );
  });
}
