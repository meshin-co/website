import assert from 'node:assert/strict';

export const headingsOf = (markdown) =>
  markdown
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3));

export function sectionOf(markdown, title) {
  const lines = markdown.split('\n');
  const start = lines.indexOf(`## ${title}`);
  assert.notEqual(start, -1, `no section "${title}"`);
  const length = lines.slice(start + 1).findIndex((line) => line.startsWith('## '));
  return lines.slice(start + 1, length === -1 ? undefined : start + 1 + length);
}

const cellsOf = (line) =>
  line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());

export function tablesOf(markdown, title) {
  const tables = [];
  let inside = false;
  for (const line of sectionOf(markdown, title)) {
    if (!line.startsWith('|')) {
      inside = false;
      continue;
    }
    if (!inside) tables.push([]);
    inside = true;
    tables.at(-1).push(cellsOf(line));
  }
  return tables.map(([header, , ...rows]) => ({ header, rows }));
}

export const proseOf = (markdown, title) =>
  sectionOf(markdown, title)
    .filter((line) => line !== '' && !line.startsWith('|') && !line.startsWith('- '))
    .join(' ');

export const itemsOf = (markdown, title) => sectionOf(markdown, title).filter((line) => line.startsWith('- '));
