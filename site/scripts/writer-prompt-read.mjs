import { LengthError, lengthFor } from './entry-length.mjs';
import { blockBetween, bulletAt, declarationAt, promptBlockAt, sectionAt } from './prompt-extract.mjs';
import { bandFor } from './sentence-band.mjs';
import { WriterError } from './writer-error.mjs';
import { listing, readText, routeList, sha256Of, tagSlugs } from './writer-tree.mjs';

const anchorOf = (take, claim) => (typeof take.anchor === 'function' ? take.anchor(claim) : take.anchor);

const TEXT_TAKES = {
  whole: (text, path) => {
    if (text.trim() === '') throw new WriterError('config', `${path} is empty`);
    return text.trimEnd();
  },
  bullet: bulletAt,
  section: sectionAt,
  declaration: declarationAt,
  between: (text, path, [from, until]) => blockBetween(text, path, from, until),
};

function parsed(text, path) {
  try {
    return JSON.parse(text);
  } catch {
    throw new WriterError('config', `${path} is not valid JSON`);
  }
}

function present(value, path, label) {
  const empty = value == null || value === '' || (typeof value === 'object' && Object.keys(value).length === 0);
  if (empty) throw new WriterError('config', `${path}: ${label} is gone or empty`);
  return value;
}

function bandOf(text, path, format) {
  try {
    return bandFor(parsed(text, path), format);
  } catch (error) {
    throw error instanceof WriterError ? error : new WriterError('config', error.message);
  }
}

function lengthOf(text, path, format) {
  try {
    return lengthFor(parsed(text, path), format);
  } catch (error) {
    throw error instanceof LengthError ? new WriterError('config', error.message) : error;
  }
}

const DATA_TAKES = {
  json: ({ text, path, take }) =>
    present(
      take.field === undefined ? parsed(text, path) : parsed(text, path)?.[take.field],
      path,
      take.field ?? 'the list'
    ),
  band: ({ text, path, claim }) => bandOf(text, path, claim.format),
  length: ({ text, path, claim }) => lengthOf(text, path, claim.format),
  routes: ({ repoRoot }) => routeList(repoRoot),
  tags: ({ repoRoot }) => tagSlugs(repoRoot),
  promptBlock: ({ text, path, take, claim }) => promptBlockAt(text, path, anchorOf(take, claim)),
};

const isDirectory = ({ take }) => take.every(({ kind }) => kind === 'slugs');
const applies = (take, claim) => take.formats === undefined || take.formats.includes(claim.format);

function readFile({ repoRoot, claim, source, result }) {
  const { path, take } = source;
  const text = readText(repoRoot, path);
  const blocks = [];
  result.files.push({ path, sha256: sha256Of(text) });
  for (const item of take.filter((one) => applies(one, claim))) {
    if (item.kind in TEXT_TAKES) blocks.push(TEXT_TAKES[item.kind](text, path, anchorOf(item, claim)));
    else result.data[item.key] = DATA_TAKES[item.kind]({ repoRoot, text, path, take: item, claim });
  }
  if (blocks.length > 0) result.texts.push({ path, blocks });
}

export function readSources({ repoRoot, claim, sources }) {
  const result = { texts: [], data: {}, files: [] };
  for (const source of sources) {
    if (isDirectory(source)) {
      for (const { key } of source.take)
        result.data[key] = present(listing(repoRoot, source.path), source.path, 'the listing');
    } else readFile({ repoRoot, claim, source, result });
  }
  return result;
}
