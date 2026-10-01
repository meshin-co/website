const { shardOf, shardRoutes } = require('./scripts/lh-shards.cjs');
const {
  NOINDEX_ROUTE_PATTERN,
  SEO_AUDITS_EXCEPT_CRAWLABLE,
  resolveAuditPlan,
  urlPathOf,
} = require('./scripts/lh-routes.cjs');

const desktop = process.env.LHCI_FORM_FACTOR === 'desktop';
const distDir = process.env.LH_DIST_DIR || 'dist';

const onMedian = (rule) => ['error', { ...rule, aggregationMethod: 'median' }];

const CORE = {
  'categories:performance': onMedian({ minScore: 1 }),
  'categories:accessibility': onMedian({ minScore: 1 }),
  'categories:best-practices': onMedian({ minScore: 1 }),
  'largest-contentful-paint': onMedian({ maxNumericValue: 1850 }),
  'cumulative-layout-shift': onMedian({ maxNumericValue: 0.02 }),
  'total-blocking-time': onMedian({ maxNumericValue: 50 }),
};

const SEO_CATEGORY = { 'categories:seo': onMedian({ minScore: 1 }) };
const SEO_WITHOUT_CRAWLABLE = Object.fromEntries(
  SEO_AUDITS_EXCEPT_CRAWLABLE.map((audit) => [audit, onMedian({ minScore: 1 })])
);

const noindexByDesign = `https?://[^/]+(?:${NOINDEX_ROUTE_PATTERN})/?$`;

const shard = shardOf(process.env);
const audited = shardRoutes(resolveAuditPlan({ distDir, env: process.env }).expected, shard);
const port = Number(process.env.GATE_SERVER_PORT ?? 4330) + shard.index - 1;
const origin = `http://127.0.0.1:${port}`;
const url = audited.map((route) => `${origin}${urlPathOf(route)}`);

module.exports = {
  ci: {
    collect: {
      startServerCommand: `GATE_SERVER_PORT=${port} node scripts/gate-server.mjs ${distDir}`,
      startServerReadyPattern: 'gate server listening',
      url,
      numberOfRuns: 3,
      settings: {
        blockedUrlPatterns: ['*plausible.io*'],
        formFactor: desktop ? 'desktop' : 'mobile',
        screenEmulation: desktop
          ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
          : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        throttling: desktop
          ? { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }
          : {
              rttMs: 150,
              throughputKbps: 1638.4,
              cpuSlowdownMultiplier: 4,
              requestLatencyMs: 562.5,
              downloadThroughputKbps: 1474.56,
              uploadThroughputKbps: 675,
            },
        emulatedUserAgent: !desktop,
      },
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: `^${noindexByDesign}`, assertions: { ...CORE, ...SEO_WITHOUT_CRAWLABLE } },
        { matchingUrlPattern: `^(?!${noindexByDesign}).*$`, assertions: { ...CORE, ...SEO_CATEGORY } },
      ],
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
