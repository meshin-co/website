const UNBORN = /^0{7,40}\.\./;

const nonBlankLines = (text) =>
  (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export function diffScope({ git, range }) {
  if (range && !UNBORN.test(range)) {
    const ranged = git(['diff', '--name-only', range]);
    if (ranged !== null && ranged !== undefined) return { base: range.split('..')[0], files: nonBlankLines(ranged) };
  }
  const base = (git(['merge-base', 'HEAD', 'origin/main']) ?? '').trim();
  const committed = base ? nonBlankLines(git(['diff', '--name-only', `${base}..HEAD`])) : [];
  const working = nonBlankLines(git(['diff', '--name-only', 'HEAD']));
  const untracked = nonBlankLines(git(['ls-files', '--others', '--exclude-standard']));
  return { base: base || null, files: [...new Set([...committed, ...working, ...untracked])] };
}
