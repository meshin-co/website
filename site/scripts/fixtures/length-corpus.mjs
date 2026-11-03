import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const DATA = 'site/src/data';

export const words = (count) =>
  Array.from({ length: count }, (_, index) => (index === count - 1 ? 'end.' : `w${index}`)).join(' ');

const sections = (counts) => counts.map((count, index) => `## Question ${index + 1}?\n\n${words(count)}\n`).join('\n');

export const entryFile = (counts) => `---\ntitle: An entry\n---\n${sections(counts)}`;

export const STEADY = {
  [`${DATA}/post/short.md`]: entryFile([100, 120, 140, 160]),
  [`${DATA}/post/middle.md`]: entryFile([200, 210, 220, 230]),
  [`${DATA}/post/long.md`]: entryFile([300, 310, 320, 330, 340]),
  [`${DATA}/glossary/alpha.md`]: entryFile([50, 60]),
  [`${DATA}/glossary/beta.md`]: entryFile([70, 80]),
};

export function writeFiles(root, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

export function repoWith(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'entry-length-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFiles(root, files);
  return root;
}
