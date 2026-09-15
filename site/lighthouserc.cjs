const { existsSync, readFileSync } = require('node:fs');

const { shardOf, shardRoutes } = require('./scripts/lh-shards.cjs');

const desktop = process.env.LHCI_FORM_FACTOR === 'desktop';

const CORE = {
  'categories:performance': ['error', { minScore: 1 }],
  'categories:accessibility': ['error', { minScore: 1 }],
  'categories:best-practices': ['error', { minScore: 1 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 1850 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
  'total-blocking-time': ['error', { maxNumericValue: 50 }],
};

const SEO = { 'categories:seo': ['error', { minScore: 1 }] };

const gatePath = 'dist/gate-routes.json';
const gate = existsSync(gatePath) ? JSON.parse(readFileSync(gatePath, 'utf8')) : { measured: [], lighthouseRoutes: [] };
const measured = gate.measured;
const allAudited = gate.lighthouseRoutes.filter((route) => measured.some((row) => row.route === route));
const shard = shardOf(process.env);
const audited = shardRoutes(allAudited, shard);
const noindexRoutes = measured.filter((row) => row.noindex).map((row) => row.route);
const port = Number(process.env.GATE_SERVER_PORT ?? 4330) + shard.index - 1;
const origin = `http://127.0.0.1:${port}`;
const url = audited.map((route) =>
  `${origin}${route === '/404' ? '/404.html' : `${route}/`.replace('//', '/')}`.replace(/\/$/, '/')
);

const escaped = noindexRoutes.map((route) => route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const noindexPattern = escaped.length > 0 ? `(${escaped.join('|')})(/|\\.html|/index\\.html)?$` : null;

const assert = noindexPattern
  ? {
      assertMatrix: [
        { matchingUrlPattern: noindexPattern, assertions: CORE },
        { matchingUrlPattern: `^(?!.*${noindexPattern}).*$`, assertions: { ...CORE, ...SEO } },
      ],
    }
  : { assertions: { ...CORE, ...SEO } };

module.exports = {
  ci: {
    collect: {
      startServerCommand: `GATE_SERVER_PORT=${port} node scripts/gate-server.mjs dist`,
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
    assert,
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
