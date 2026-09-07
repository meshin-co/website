const desktop = process.env.LHCI_FORM_FACTOR === 'desktop';

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
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
      assertions: {
        'categories:performance': ['error', { minScore: 1 }],
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
        'total-blocking-time': ['error', { maxNumericValue: 50 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
