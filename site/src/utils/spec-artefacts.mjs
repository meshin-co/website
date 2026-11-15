import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

export const MIRROR_FILE = 'mirror.json';

export const PUBLISHED_FILES = Object.freeze({
  id: 'published-files',
  heading: 'Published files',
  intro:
    'Each file is served exactly as stored, and the digest beside it is computed from the bytes served when the site is built. Compare a copy with the digest before you rely on it.',
});

const MEDIA_TYPES = Object.freeze({ '.json': 'application/json' });
const ENTRY_EXTENSION = /\.mdx?$/;
const SPEC_DATA = 'src/data/spec';

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

const folderOf = (entry, root) => join(root, entry.filePath.replace(ENTRY_EXTENSION, ''));
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function specArtefacts(entry, { root = process.cwd() } = {}) {
  const folder = folderOf(entry, root);
  if (!existsSync(folder)) return [];
  const { name, version } = entry.data;
  return readdirSync(folder, { withFileTypes: true })
    .filter((item) => item.name !== MIRROR_FILE)
    .sort(byName)
    .map((item) => {
      const file = item.name;
      if (!item.isFile()) throw new Error(`${folder}: ${file} is not a file, and only files are published`);
      const mediaType = MEDIA_TYPES[extname(file)];
      if (!mediaType)
        throw new Error(`${folder}: ${file} has no media type on record; add its extension to MEDIA_TYPES`);
      const bytes = readFileSync(join(folder, file));
      return {
        file,
        path: `/spec/${name}/${version}/${file}`,
        mediaType,
        bytes,
        size: bytes.length,
        sha256: sha256Hex(bytes),
      };
    });
}

const isText = (value) => typeof value === 'string' && value !== '';
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function readDeclaration(path) {
  let declaration;
  try {
    declaration = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { problems: [`${MIRROR_FILE} is not JSON: ${error.message}`] };
  }
  if (!isPlainObject(declaration)) {
    return { problems: [`${MIRROR_FILE} must be an object that maps a file name to its source`] };
  }
  const problems = [];
  const sources = [];
  for (const [file, source] of Object.entries(declaration)) {
    if (isPlainObject(source) && isText(source.checkout) && isText(source.path)) sources.push([file, source]);
    else problems.push(`${MIRROR_FILE}: the source of ${file} must be an object with a text checkout and a text path`);
  }
  return { problems, sources };
}

function compareMirror({ folder, root, file, source }) {
  const copy = join(folder, file);
  if (!existsSync(copy)) {
    return { problems: [`${MIRROR_FILE} declares ${file}, which is not in the folder ${relative(root, folder)}`] };
  }
  const checkout = resolve(root, source.checkout);
  if (!existsSync(checkout)) {
    return { skipped: `no checkout at ${checkout}, which ${MIRROR_FILE} declares as ${source.checkout}` };
  }
  const upstream = join(checkout, source.path);
  if (!existsSync(upstream)) {
    return {
      problems: [
        `${checkout} holds no ${source.path}, so ${file} cannot be compared with it: the layout of that checkout moved`,
      ],
    };
  }
  const stored = readFileSync(copy);
  const current = readFileSync(upstream);
  if (stored.equals(current)) return { compared: true };
  return {
    compared: true,
    problems: [
      `${file} is not the upstream file. The stored copy is ${sha256Hex(stored)} (${stored.length} bytes) and the upstream file is ${sha256Hex(current)} (${current.length} bytes). Refresh the copy with: cp ${upstream} ${copy}`,
    ],
  };
}

function folderAccount({ folder, root }) {
  const declarationPath = join(folder, MIRROR_FILE);
  if (!existsSync(declarationPath)) return { declared: 0, compared: 0, skipped: [], problems: [] };
  const { problems, sources = [] } = readDeclaration(declarationPath);
  const outcomes = sources.map(([file, source]) => ({ file, ...compareMirror({ folder, root, file, source }) }));
  return {
    declared: sources.length,
    compared: outcomes.filter(({ compared }) => compared).length,
    skipped: outcomes.filter(({ skipped }) => skipped).map(({ file, skipped }) => ({ file, reason: skipped })),
    problems: [...problems, ...outcomes.flatMap((outcome) => outcome.problems ?? [])],
  };
}

export function mirrorAccount(entry, { root = process.cwd() } = {}) {
  return folderAccount({ folder: folderOf(entry, root), root });
}

export function mirrorProblems(entry, options) {
  return mirrorAccount(entry, options).problems;
}

const sum = (accounts, key) => accounts.reduce((total, account) => total + account[key], 0);

export function specMirrors({ root = process.cwd() } = {}) {
  const base = join(root, SPEC_DATA);
  const names = existsSync(base)
    ? readdirSync(base, { withFileTypes: true })
        .filter((item) => item.isDirectory() && existsSync(join(base, item.name, MIRROR_FILE)))
        .sort(byName)
        .map((item) => item.name)
    : [];
  const accounts = names.map((name) => ({ name, ...folderAccount({ folder: join(base, name), root }) }));
  return {
    declared: sum(accounts, 'declared'),
    compared: sum(accounts, 'compared'),
    skipped: accounts.flatMap(({ name, skipped }) =>
      skipped.map(({ file, reason }) => ({ file: `${SPEC_DATA}/${name}/${file}`, reason }))
    ),
    problems: accounts.flatMap(({ name, problems }) => problems.map((problem) => `${SPEC_DATA}/${name}: ${problem}`)),
  };
}

export function mirrorSummary({ declared, compared, skipped }) {
  if (declared === 0) return ['mirrors: none declared'];
  const counts = `mirrors: ${declared} declared, ${compared} compared, ${declared - compared} not compared`;
  return [
    compared === 0 ? `${counts}; nothing was compared with an upstream file` : counts,
    ...skipped.map(({ file, reason }) => `not compared: ${file}: ${reason}`),
  ];
}

export function publishedArtefacts(entry, options) {
  const problems = mirrorProblems(entry, options);
  if (problems.length > 0)
    throw new Error(`${entry.filePath}:\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  return specArtefacts(entry, options);
}

export function publishedFilesMarkdown({ site, artefacts }) {
  if (artefacts.length === 0) return '';
  const lines = artefacts.map(
    ({ file, path, mediaType, sha256 }) => `- [${file}](${site}${path}): \`${mediaType}\`, SHA-256 \`${sha256}\``
  );
  return [`## ${PUBLISHED_FILES.heading}`, '', PUBLISHED_FILES.intro, '', ...lines, ''].join('\n');
}
