const { existsSync, readFileSync } = require('node:fs');

const desktop = process.env.LHCI_FORM_FACTOR === 'desktop';

const CORE = {
  'categories:performance': ['error', { minScore: 1 }],
  'categories:accessibility': ['error', { minScore: 1 }],
  'categories:best-practices': ['error', { minScore: 1 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 1800 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
  'total-blocking-time': ['error', { maxNumericValue: 50 }],
};

const SEO = { 'categories:seo': ['error', { minScore: 1 }] };

const gatePath = 'dist/gate-routes.json';
const gate = existsSync(gatePath) ? JSON.parse(readFileSync(gatePath, 'utf8')) : { measured: [], lighthouseRoutes: [] };
const measured = gate.measured;
const audited = gate.lighthouseRoutes.filter((route) => measured.some((row) => row.route === route));
const noindexRoutes = measured.filter((row) => row.noindex).map((row) => row.route);
const url = audited.map((route) => (route === '/404' ? '/404.html' : `${route}/`.replace('//', '/')));

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
      staticDistDir: './dist',
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
