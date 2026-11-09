export function table(header, bodyRows) {
  const rows = bodyRows.map((row) => row.map((cell) => String(cell)));
  const grid = [header, ...rows];
  const widths = header.map((_, column) => Math.max(3, ...grid.map((row) => row[column].length)));
  const line = (row) => `| ${row.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`;
  return [line(header), `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`, ...rows.map(line)].join('\n');
}

export const code = (route) => `\`${route}\``;
export const codes = (routes) => (routes.length === 0 ? '-' : routes.map(code).join(', '));
export const cellText = (value) => String(value).replaceAll('|', '\\|');

const cellsOf = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replaceAll('\\|', '|').trim());

const isDelimiterRow = (line) => cellsOf(line).every((cell) => /^:?-+:?$/.test(cell));
const startsRow = (line) => line?.trimStart().startsWith('|');

export function tablesIn(markdown) {
  const lines = markdown.split('\n');
  const tables = [];
  for (let at = 0; at < lines.length - 1; at += 1) {
    if (!startsRow(lines[at]) || !startsRow(lines[at + 1]) || !isDelimiterRow(lines[at + 1])) continue;
    const rows = [];
    let end = at + 2;
    while (startsRow(lines[end])) rows.push(cellsOf(lines[end++]));
    tables.push({ header: cellsOf(lines[at]), rows });
    at = end - 1;
  }
  return tables;
}

export const tableWith = (tables, names, absent = []) =>
  tables.find(
    ({ header }) => names.every((name) => header.includes(name)) && !absent.some((name) => header.includes(name))
  );

export const recordsOf = (found) =>
  (found?.rows ?? []).map((cells) => Object.fromEntries(found.header.map((name, at) => [name, cells[at] ?? ''])));
