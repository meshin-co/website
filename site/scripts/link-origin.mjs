import { DEFAULT_RULES } from './build-surface.mjs';
import { diffScope } from './diff-scope.mjs';

const ADDRESS = /https?:\/\/(?:[^\s"'<>`\\()]|\([^\s()<>"'`]*\))+/gi;
const SOURCE_TEXT = /\.(?:md|mdx|astro|[cm]?[jt]sx?|json|ya?ml|html)$/;
const TRAILING_PUNCTUATION = /[.,;:!?*_]$/;
const count = (text, character) => text.split(character).length - 1;

export function canonicalUrl(raw) {
  if (typeof raw !== 'string') return null;
  const decoded = raw.replaceAll('&amp;', '&');
  if (!URL.canParse(decoded)) return null;
  const url = new URL(decoded);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url.href;
}

function trimmed(token) {
  let address = token;
  for (;;) {
    if (TRAILING_PUNCTUATION.test(address)) address = address.slice(0, -1);
    else if (address.endsWith(')') && count(address, '(') < count(address, ')')) address = address.slice(0, -1);
    else return address;
  }
}

export function urlsIn(text) {
  const found = new Set();
  for (const [token] of (typeof text === 'string' ? text : '').matchAll(ADDRESS)) {
    const url = canonicalUrl(trimmed(token));
    if (url !== null) found.add(url);
  }
  return found;
}

export function introducedUrls({ before, after }) {
  const known = urlsIn(before);
  return new Set([...urlsIn(after)].filter((url) => !known.has(url)));
}

export const isShippedSource = (path, rules = DEFAULT_RULES) =>
  rules.shippedDirectories.some((directory) => path.startsWith(directory)) &&
  SOURCE_TEXT.test(path) &&
  !rules.testFile.test(path);

export function linkOrigins({ git, readFile, range, rules = DEFAULT_RULES }) {
  const { base, files } = diffScope({ git, range });
  if (base === null) return null;
  const introduced = new Set();
  for (const path of files.filter((file) => isShippedSource(file, rules))) {
    const before = git(['show', `${base}:${path}`]);
    for (const url of introducedUrls({ before, after: readFile(path) })) introduced.add(url);
  }
  const onMain = urlsIn(git(['grep', '-I', '-h', '-e', 'https\\?://', base, '--', ...rules.shippedDirectories]));
  return { base, introduced, onMain };
}
