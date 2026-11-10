import { posix } from 'node:path';

export const CLASSES = Object.freeze(['engine', 'site', 'evidence']);
export const SEED_ROOT = 'seed/';
export const SEED_SUFFIX = '.seed';
export const EXPORT_MANIFEST = 'engine-export.json';

const SOURCE_EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.mjs', '.cjs', '.js']);
const TOOLING_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.mjs', '.cjs', '.js', '.ts', '.toml']);
const PAGES_ROOT = 'site/src/pages/';
const PUBLIC_ROOT = 'site/public/';
const CLIENT_CODE_ROOT = 'site/public/search/';
const EDITOR_ROOT = 'site/.vscode/';
const AGENTS_ROOT = 'site/.agents/';
const AGENT_FILES = new Set(['AGENTS.md', 'CLAUDE.md']);
const LICENCE_FILES = new Set(['LICENSE', 'LICENSE.md']);
const FIXTURE_NAME = /\.fixture\.[a-z]+$/;
const SITE_MARK = /\.site\.(?:test\.)?[a-z]{2,4}$/;

const extensionOf = (file) => posix.extname(file);
const under =
  (...prefixes) =>
  (file) =>
    prefixes.some((prefix) => file.startsWith(prefix));
const hasSegment = (segment) => (file) => file.split('/').includes(segment);
const isSource = (file) => SOURCE_EXTENSIONS.has(extensionOf(file));

export const seedTarget = (file) => file.slice(SEED_ROOT.length, -SEED_SUFFIX.length);
export const isSeed = (file) => file.startsWith(SEED_ROOT) && file.endsWith(SEED_SUFFIX);
const isSiteMarked = (file) => SITE_MARK.test(posix.basename(file));
export const isSkill = (file) => file.startsWith(AGENTS_ROOT) && !isSiteMarked(file);

export function routeOfPage(file) {
  const route = file
    .slice(PAGES_ROOT.length)
    .replace(/\.astro$/, '')
    .replace(/(^|\/)index$/, '');
  return `/${route}`;
}

const dataSegments = (file, { dataDirectory }) =>
  file.startsWith(`${dataDirectory}/`) ? file.slice(dataDirectory.length + 1).split('/') : [];
const underScripts = (file, { scriptRoots }) => scriptRoots.some((root) => file.startsWith(root));
const isTest = (file, { testFile, testDirectory, testTooling }) =>
  testFile.test(file) || testDirectory.test(file) || testTooling.includes(file);

const siteEntry = (file, facts) => {
  const [collection, ...rest] = dataSegments(file, facts);
  return rest.length > 0 && facts.collections.has(collection);
};

const siteVocabulary = (file, facts) => dataSegments(file, facts).length === 1 && !isTest(file, facts);

const pageKind = (file, facts) => {
  if (!file.startsWith(PAGES_ROOT)) return null;
  if (extensionOf(file) !== '.astro') return 'endpoint';
  if (file.includes('[')) return 'template';
  return facts.noindexRoutes.has(routeOfPage(file)) ? 'machinery' : 'authored';
};

const siteAsset = (file, facts) => {
  if (file.startsWith(PUBLIC_ROOT)) return !(isSource(file) && file.startsWith(CLIENT_CODE_ROOT));
  return facts.siteAssetDirectories.some((directory) => file.startsWith(directory));
};

const rootTooling = (file) => {
  const parts = file.split('/');
  const depth = file.startsWith('site/') ? 2 : 1;
  if (parts.length !== depth) return false;
  return parts.at(-1).startsWith('.') || TOOLING_EXTENSIONS.has(extensionOf(file));
};

const reachesBuild = (file, { shippedDirectories }) =>
  shippedDirectories.some((directory) => file.startsWith(directory)) &&
  (isSource(file) || file.endsWith('.css') || file.includes('/assets/fonts/'));

const agentPointer = (file) => AGENT_FILES.has(posix.basename(file)) && file !== 'AGENTS.md';

export const RULES = Object.freeze([
  {
    id: 'seed-template',
    class: 'engine',
    why: 'it lives under the seed root with the seed suffix; the export writes it at its target path',
    test: isSeed,
  },
  {
    id: 'export-manifest',
    class: 'engine',
    why: 'it is the manifest the export writes at the root of the repository it creates',
    test: (file) => file === EXPORT_MANIFEST,
  },
  {
    id: 'seeded',
    class: 'site',
    why: 'the engine ships a starter in its place, so the site owns the real file',
    test: (file, { seeded }) => seeded.has(file),
  },
  {
    id: 'closed-change',
    class: 'evidence',
    why: 'it is a record of change work under openspec/changes, closed or in flight',
    test: under('openspec/changes/'),
  },
  {
    id: 'investigation-record',
    class: 'evidence',
    why: 'it is a dated investigation record',
    test: under('investigation/'),
  },
  {
    id: 'measurement',
    class: 'evidence',
    why: 'it lives where the generators write measured output',
    test: under('audits/'),
  },
  {
    id: 'visual-baseline',
    class: 'evidence',
    why: 'it is a screenshot the visual gate captured from this site',
    test: hasSegment('__screenshots__'),
  },
  {
    id: 'source-capture',
    class: 'evidence',
    why: 'it is a capture of an external document the plan was written from',
    test: under('docs/sources/'),
  },
  {
    id: 'collection-entry',
    class: 'site',
    why: 'it is an entry of a collection the content schema defines',
    test: siteEntry,
  },
  {
    id: 'site-vocabulary',
    class: 'site',
    why: 'it sits beside the collections and holds the site vocabulary they read',
    test: siteVocabulary,
  },
  {
    id: 'fixture-data',
    class: 'engine',
    why: 'its name says it is test data, and test data pins behaviour against an invented site',
    test: (file) => FIXTURE_NAME.test(posix.basename(file)),
  },
  {
    id: 'site-marked',
    class: 'site',
    why: 'its name carries the .site marker before its extension: its author declared it belongs to one site, so it stays with that site and is never exported',
    test: isSiteMarked,
  },
  {
    id: 'test',
    class: 'engine',
    why: 'it matches the test patterns of the engine configuration',
    test: isTest,
  },
  {
    id: 'generated-output',
    class: 'site',
    why: 'an assets script writes it from the site identity, so the site regenerates it and never copies it',
    test: (file, { generatedOutputs }) => generatedOutputs.has(file),
  },
  {
    id: 'authored-page',
    class: 'site',
    why: 'it is a static page whose route the engine does not serve as machinery, so it holds the site copy',
    test: (file, facts) => pageKind(file, facts) === 'authored',
  },
  {
    id: 'page-machinery',
    class: 'engine',
    why: 'it is a dynamic template, an endpoint or a page the engine marks noindex by design',
    test: (file, facts) => pageKind(file, facts) !== null,
  },
  {
    id: 'site-asset',
    class: 'site',
    why: 'it is a static asset the site serves or a brand image, not code',
    test: siteAsset,
  },
  {
    id: 'automation',
    class: 'engine',
    why: 'it lives in a directory the engine configuration names as automation',
    test: (file, { automationDirectories }) => automationDirectories.some((directory) => file.startsWith(directory)),
  },
  {
    id: 'script',
    class: 'engine',
    why: 'it lives in a directory that an npm script runs from',
    test: underScripts,
  },
  {
    id: 'skill',
    class: 'engine',
    why: 'it is a skill an agent reads to run the engine',
    test: isSkill,
  },
  {
    id: 'specification',
    class: 'engine',
    why: 'it is part of the spec tree that states what the harness proves',
    test: under('openspec/', '.omp/'),
  },
  {
    id: 'shipped-source',
    class: 'engine',
    why: 'it is source code or a stylesheet under a directory that reaches the built site',
    test: reachesBuild,
  },
  {
    id: 'vendored-integration',
    class: 'engine',
    why: 'it is vendored integration code the build imports',
    test: under('site/vendor/'),
  },
  {
    id: 'editor-config',
    class: 'engine',
    why: 'it is editor configuration of the application, shared by everyone who opens it',
    test: under(EDITOR_ROOT),
  },
  {
    id: 'agent-pointer',
    class: 'engine',
    why: 'it points an agent at the repository law, and names no site',
    test: agentPointer,
  },
  {
    id: 'licence',
    class: 'engine',
    why: 'it is the licence of code the engine carries, and a licence travels with the code it covers',
    test: (file) => LICENCE_FILES.has(posix.basename(file)),
  },
  {
    id: 'directory-readme',
    class: 'engine',
    why: 'it explains a directory of the application to whoever opens it',
    test: (file) => posix.basename(file) === 'README.md' && file.startsWith('site/'),
  },
  {
    id: 'project-tooling',
    class: 'engine',
    why: 'it is a configuration file at the root of the project that a tool reads',
    test: rootTooling,
  },
  {
    id: 'engine-document',
    class: 'engine',
    why: 'a script, workflow, hook, rule or skill the engine carries names it as the procedure to follow, and it names no site',
    test: (file, { engineDocuments }) => engineDocuments.has(file),
  },
  {
    id: 'unread-prose',
    class: 'site',
    why: 'it is prose that no engine file reads or names, so it records the site itself',
    test: (file) => extensionOf(file) === '.md' && file.startsWith('docs/'),
  },
]);

export const IDENTITY_EXEMPT_RULES = Object.freeze(['test', 'fixture-data', 'export-manifest']);

export function classify(file, facts) {
  const rule = RULES.find((candidate) => candidate.test(file, facts));
  return rule ? { file, class: rule.class, rule: rule.id } : { file, class: null, rule: null };
}

export function partition(files, facts) {
  const rows = files.map((file) => classify(file, facts));
  const counts = Object.fromEntries(CLASSES.map((name) => [name, rows.filter((row) => row.class === name).length]));
  return { rows, counts, unclassified: rows.filter((row) => row.class === null).map((row) => row.file) };
}
