export function partitionFacts(overrides = {}) {
  return {
    dataDirectory: 'site/src/data',
    collections: new Set(['post', 'glossary', 'author']),
    scriptRoots: ['site/scripts/'],
    noindexRoutes: new Set(['/404', '/search', '/styleguide']),
    seeded: new Set(['site/src/config.yaml', 'AGENTS.md']),
    generatedOutputs: new Set(['site/public/logo.svg']),
    automationDirectories: ['.github/', '.githooks/'],
    shippedDirectories: ['site/src/', 'site/public/'],
    testFile: /\.(?:test|spec)\.[cm]?[jt]s$/,
    testDirectory: /(?:^|\/)(?:tests|fixtures)\//,
    testTooling: ['site/playwright.config.ts'],
    siteAssetDirectories: ['site/src/assets/images/', 'site/src/assets/favicons/'],
    engineDocuments: new Set(['docs/plan/reference/calibration-gate.md']),
    identity: { terms: ['example.test', 'example', 'ada', 'lovelace'] },
    ...overrides,
  };
}
