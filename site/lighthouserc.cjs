const assertions = {
  'categories:performance': ['error', { minScore: 1 }],
  'categories:accessibility': ['error', { minScore: 1 }],
  'categories:best-practices': ['error', { minScore: 1 }],
  'categories:seo': ['error', { minScore: 1 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 1800 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
  'total-blocking-time': ['error', { maxNumericValue: 50 }],
};

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
      settings: {
        
        blockedUrlPatterns: ['*plausible.io*'],
      },
    },
    assert: { assertions },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
