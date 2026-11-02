import { posix } from 'node:path';

import { EXPORT_MANIFEST, isSeed, seedTarget } from './engine-partition.mjs';

export const ENGINE_CONFIG_PATH = 'site/engine.config.json';
export const CONTENT_SCHEMA_PATH = 'site/src/content.config.ts';
export const PACKAGE_PATH = 'site/package.json';
export const MACHINE_TEXT_PATH = 'site/src/utils/machine-text.mjs';
export const SITE_CONFIG_PATH = 'site/src/config.yaml';
export const SITE_ROOT = 'site/';
export const MIN_IDENTITY_TERM = 4;

const IMAGE_EXTENSIONS = new Set(['.png', '.svg', '.ico', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const SCRIPT_TOKEN = /(?:^|[\s&;|(])((?:[\w.-]+\/)*[\w.-]+\.(?:mjs|cjs|js|ts))(?=$|[\s&;|)])/g;
const ASSET_SCRIPT = /^assets:/;
const WRITE_CALL = /\b(?:writeFileSync|writeFile|toFile|copyFileSync)\(\s*(join\([^)]*\)|`[^`]*`|'[^']*'|"[^"]*")/g;
const QUOTED = /(['"`])([^'"`]*)\1/g;
const TEMPLATE_HOLE = /\$\{[^}]*\}/g;

export class PartitionFactsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PartitionFactsError';
  }
}

function required(read, path, what) {
  const text = read(path);
  if (text === null || text === undefined) throw new PartitionFactsError(`${path} cannot be read; ${what}`);
  return text;
}

function manifestSeedsOf({ files, read }) {
  if (!files.includes(EXPORT_MANIFEST)) return [];
  const manifest = parseJson(read(EXPORT_MANIFEST) ?? '', EXPORT_MANIFEST);
  if (!Array.isArray(manifest?.seeds) || manifest.seeds.some((seed) => typeof seed !== 'string')) {
    throw new PartitionFactsError(`${EXPORT_MANIFEST} has no list of seeded files in "seeds"`);
  }
  return manifest.seeds;
}

function parseJson(text, path) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new PartitionFactsError(`${path} is not valid JSON (${error.message})`);
  }
}

function configFacts(read) {
  const config = parseJson(
    required(read, ENGINE_CONFIG_PATH, 'it holds the layout the partition derives from'),
    ENGINE_CONFIG_PATH
  );
  const { diff, content } = config;
  if (!diff || !content?.dataDirectory) {
    throw new PartitionFactsError(`${ENGINE_CONFIG_PATH} holds no diff section or no content.dataDirectory`);
  }
  return {
    config,
    dataDirectory: content.dataDirectory.replace(/\/$/, ''),
    automationDirectories: diff.automationDirectories,
    shippedDirectories: diff.shippedDirectories,
    testTooling: diff.testTooling,
    testFile: new RegExp(diff.testFilePattern),
    testDirectory: new RegExp(diff.testDirectoryPattern),
  };
}

function collectionsOf(read) {
  const text = required(read, CONTENT_SCHEMA_PATH, 'it names the collections whose entries belong to the site');
  const block = /export const collections = \{([^}]*)\}/.exec(text)?.[1];
  const names = block ? [...block.matchAll(/^\s*([A-Za-z_]\w*)\s*:/gm)].map(([, name]) => name) : [];
  if (names.length === 0) throw new PartitionFactsError(`${CONTENT_SCHEMA_PATH} exports no collections`);
  return new Set(names);
}

const scriptFilesOf = (command) =>
  [...command.matchAll(SCRIPT_TOKEN)].map(([, token]) => token).filter((token) => !token.startsWith('node_modules/'));

function scriptRootsOf(read) {
  const { scripts = {} } = parseJson(
    required(read, PACKAGE_PATH, 'its scripts name the code directories'),
    PACKAGE_PATH
  );
  const roots = new Set();
  for (const command of Object.values(scripts)) {
    for (const token of scriptFilesOf(command)) {
      if (!token.includes('/')) continue;
      const directory = `${posix.dirname(token)}/`;
      roots.add(directory.startsWith(SITE_ROOT) ? directory : `${SITE_ROOT}${directory}`);
    }
  }
  return [...roots].sort();
}

function noindexRoutesOf(read) {
  const text = required(read, MACHINE_TEXT_PATH, 'it declares which static pages the engine serves as machinery');
  const list = /NOINDEX_STATIC_PAGES\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(text)?.[1] ?? '';
  return new Set([...list.matchAll(/['"`]([^'"`]+)['"`]/g)].map(([, route]) => route));
}

function siteAssetDirectoriesOf(files, shippedDirectories) {
  const found = new Set();
  for (const shipped of shippedDirectories) {
    const root = `${shipped}assets/`;
    for (const file of files) {
      const rest = file.startsWith(root) ? file.slice(root.length).split('/') : [];
      if (rest.length > 1 && IMAGE_EXTENSIONS.has(posix.extname(file))) found.add(`${root}${rest[0]}/`);
    }
  }
  return [...found].sort();
}

const escapePattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function writtenPattern(argument) {
  if (argument.startsWith('join(')) {
    const segments = [...argument.matchAll(QUOTED)].map(([, , segment]) => segment);
    return segments.length === 0 ? null : segments.join('/');
  }
  return argument.slice(1, -1);
}

function repositoryPattern(written) {
  const relative = written.startsWith('../') ? written.slice(3) : `${SITE_ROOT}${written.replace(/^\.\//, '')}`;
  const source = relative.split(TEMPLATE_HOLE).map(escapePattern).join('[^/]+');
  return new RegExp(`^${source}$`);
}

function generatedOutputsOf({ files, read }) {
  const { scripts = {} } = parseJson(
    required(read, PACKAGE_PATH, 'its assets scripts write generated files'),
    PACKAGE_PATH
  );
  const generators = new Set(
    Object.entries(scripts)
      .filter(([name]) => ASSET_SCRIPT.test(name))
      .flatMap(([, command]) => scriptFilesOf(command))
      .map((token) => (token.startsWith(SITE_ROOT) ? token : `${SITE_ROOT}${token}`))
  );
  const written = [];
  for (const generator of generators) {
    const text = read(generator) ?? '';
    for (const [, argument] of text.matchAll(WRITE_CALL)) {
      const path = writtenPattern(argument);
      if (path) written.push(repositoryPattern(path));
    }
  }
  return new Set(files.filter((file) => written.some((pattern) => pattern.test(file))));
}

const words = (text) => (text ?? '').toLowerCase().match(/[a-z0-9][a-z0-9.-]*[a-z0-9]|[a-z0-9]/g) ?? [];

function authorTerms(read, config) {
  const slug = config.content?.formats?.article?.author;
  if (!slug) return [];
  const entry = read(`${config.content.dataDirectory.replace(/\/$/, '')}/author/${slug}.md`);
  const name = entry
    ? /^name:\s*(.+)$/m
        .exec(entry)?.[1]
        ?.trim()
        .replace(/^['"]|['"]$/g, '')
    : null;
  return [slug, ...words(name)];
}

export function identityOf(read) {
  const yaml = read(SITE_CONFIG_PATH);
  if (!yaml) return { terms: [] };
  const config = parseJson(required(read, ENGINE_CONFIG_PATH, 'the author slug lives there'), ENGINE_CONFIG_PATH);
  const name = /^\s{2}name:\s*(.+)$/m
    .exec(yaml)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
  const url = /^\s{2}site:\s*['"]?(https?:\/\/[^'"\s]+)/m.exec(yaml)?.[1];
  const host = url ? new URL(url).host.toLowerCase().replace(/^www\./, '') : null;
  const terms = [name?.toLowerCase(), host, host?.split('.')[0], ...authorTerms(read, config)]
    .filter(Boolean)
    .map((term) => term.toLowerCase())
    .filter((term) => term.length >= MIN_IDENTITY_TERM);
  return { terms: [...new Set(terms)] };
}

export const identityTermIn = (text, identity) => {
  const lower = text.toLowerCase();
  return identity.terms.find((term) => lower.includes(term)) ?? null;
};

const RULES_ROOT = '.omp/rules/';

const isCodeReader = (file, scriptRoots, config) =>
  (scriptRoots.some((root) => file.startsWith(root)) &&
    !config.testFile.test(file) &&
    !config.testDirectory.test(file)) ||
  config.automationDirectories.some((directory) => file.startsWith(directory)) ||
  file === PACKAGE_PATH ||
  file.startsWith(RULES_ROOT);

function engineDocumentsOf({ files, read, seeded, scriptRoots, config, identity }) {
  const readers = files.filter((file) => isCodeReader(file, scriptRoots, config));
  const readerText = readers.map((file) => read(file) ?? '').join('\n');
  return new Set(
    files.filter((file) => {
      if (!file.startsWith('docs/') || !file.endsWith('.md') || seeded.has(file)) return false;
      if (!readerText.includes(file)) return false;
      return identityTermIn(read(file) ?? '', identity) === null;
    })
  );
}

export function readPartitionFacts({ files, read }) {
  const { config, ...layout } = configFacts(read);
  const seeded = new Set([...files.filter(isSeed).map(seedTarget), ...manifestSeedsOf({ files, read })]);
  const scriptRoots = scriptRootsOf(read);
  const identity = identityOf(read);
  return {
    ...layout,
    config,
    collections: collectionsOf(read),
    scriptRoots,
    noindexRoutes: noindexRoutesOf(read),
    seeded,
    siteAssetDirectories: siteAssetDirectoriesOf(files, layout.shippedDirectories),
    generatedOutputs: generatedOutputsOf({ files, read }),
    engineDocuments: engineDocumentsOf({ files, read, seeded, scriptRoots, config: layout, identity }),
    identity,
  };
}
