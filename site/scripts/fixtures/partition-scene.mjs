import { partitionFacts } from './partition-facts.mjs';

export const SCENE_CONFIG = {
  schema: 1,
  diff: {
    proseDirectories: ['docs/', 'audits/'],
    shippedDirectories: ['site/src/', 'site/public/'],
    automationDirectories: ['.github/', '.githooks/'],
    testTooling: ['site/playwright.config.ts'],
    testFilePattern: '\\.(?:test|spec)\\.[cm]?[jt]s$',
    testDirectoryPattern: '(?:^|/)(?:tests|fixtures)/',
  },
  content: {
    dataDirectory: 'site/src/data',
    formats: {
      term: { collection: 'glossary', routePrefix: '/glossary/' },
      article: { collection: 'post', routePrefix: '/blog/', author: 'ada', resourceCollection: 'resource' },
    },
  },
};

export const SCENE_TEXT = {
  'site/engine.config.json': JSON.stringify(SCENE_CONFIG),
  'site/src/content.config.ts': [
    "import { defineCollection } from 'astro:content';",
    'const postCollection = defineCollection({});',
    'export const collections = {',
    '  post: postCollection,',
    '  glossary: glossaryCollection,',
    '  resource: resourceCollection,',
    '  author: authorCollection,',
    '};',
  ].join('\n'),
  'site/package.json': JSON.stringify({
    scripts: {
      'gate:docs': 'node scripts/run-docs-gate.mjs ..',
      'assets:logo': 'node scripts/generate-logo.mjs',
      'lh:check': 'cd .. && node site/scripts/run-lh-evidence.mjs check',
    },
  }),
  'site/scripts/generate-logo.mjs': "writeFileSync('public/logo.svg', standalone());\n",
  'site/scripts/measure-entry-length.mjs': 'export {};\n',
  'site/scripts/measure-sentence-band.mjs': 'export {};\n',
  'site/src/utils/route-exceptions.mjs': [
    'export const ROUTE_EXCEPTIONS = [',
    "  { route: '/404', reason: 'The error page answers any address that does not exist.' },",
    "  { route: '/search', reason: 'The search page builds its results in the browser.' },",
    '];',
    '',
    'export const EMPTY_COLLECTIONS = [',
    "  { collection: 'case', reason: 'No case study exists yet.' },",
    '];',
    '',
  ].join('\n'),
  'site/src/config.yaml': "site:\n  name: example.test\n  site: 'https://example.test'\n",
  'site/src/data/author/ada.md': '---\nname: Ada Lovelace\n---\n',
  'site/.agents/skills/run-the-gate.md': 'Follow docs/plan/reference/calibration-gate.md step by step.\n',
  'docs/plan/reference/calibration-gate.md': 'Eleven steps. No waiver.\n',
  'docs/PRD.md': 'The plan of the site.\n',
  'docs/CONTENT-GATE.md': 'The rows a page must clear.\n',
  'site/scripts/engine-anchors.mjs': "export const note = 'docs/CONTENT-GATE.md';\n",
  '.omp/rules/openspec.md': 'Close the change with docs/plan/reference/calibration-gate.md.\n',
};

export const SCENE_FILES = [
  ...Object.keys(SCENE_TEXT),
  'AGENTS.md',
  'docs/SEMANTIC-CORE.md',
  'seed/AGENTS.md.seed',
  'seed/docs/SEMANTIC-CORE.md.seed',
  'seed/site/src/config.yaml.seed',
  'seed/audits/routes.json.seed',
  'seed/audits/search-demand.md.seed',
  'seed/site/content-facts.json.seed',
  'seed/site/src/data/tags.mjs.seed',
  'seed/site/src/data/glossary/an-example-term.md.seed',
  'seed/site/src/data/post/an-example-post.md.seed',
  'seed/site/src/data/resource/an-example-resource.md.seed',
  'site/content-facts.json',
  'site/banned-phrases.json',
  'site/controlled-words.json',
  'site/src/data/tags.mjs',
  'site/public/logo.svg',
  'site/src/assets/images/og-default.png',
  'site/src/assets/fonts/Face.ttf',
  'site/src/assets/styles/tailwind.css',
  'site/.nvmrc',
  '.github/workflows/ci.yml',
  '.github/workflows/watch-pr.yml',
  '.github/workflows/write-daily.yml',
];

export const sceneReader = (overrides = {}) => {
  const text = { ...SCENE_TEXT, ...overrides };
  return (path) => (Object.hasOwn(text, path) ? text[path] : '');
};

export const sceneFacts = (overrides = {}) => partitionFacts(overrides);
