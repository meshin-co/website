const base = require('./lighthouserc.cjs');

module.exports = {
  ci: {
    ...base.ci,
    collect: {
      ...base.ci.collect,
      settings: {
        ...base.ci.collect.settings,
        formFactor: 'desktop',
        screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
        throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
        emulatedUserAgent: false,
      },
    },
  },
};
