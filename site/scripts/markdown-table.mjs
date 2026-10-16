export function table(header, bodyRows) {
  const rows = bodyRows.map((row) => row.map((cell) => String(cell)));
  const grid = [header, ...rows];
  const widths = header.map((_, column) => Math.max(3, ...grid.map((row) => row[column].length)));
  const line = (row) => `| ${row.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`;
  return [line(header), `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`, ...rows.map(line)].join('\n');
}
