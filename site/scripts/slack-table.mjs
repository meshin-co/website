export const PHONE_COLUMNS = 34;

const GAP = '  ';
const ALIGNMENTS = ['left', 'right', 'decimal'];

export const widthOf = (lines) => Math.max(0, ...lines.map((line) => line.length));

function decimalParts(cell) {
  const point = cell.indexOf('.');
  return point < 0 ? [cell, ''] : [cell.slice(0, point), cell.slice(point)];
}

function onDecimalPoint(cells) {
  const parts = cells.map(decimalParts);
  const whole = widthOf(parts.map(([integer]) => integer));
  const fraction = widthOf(parts.map(([, rest]) => rest));
  return parts.map(([integer, rest]) => integer.padStart(whole) + rest.padEnd(fraction));
}

function checked({ header, align, rows }) {
  if (!Array.isArray(align) || align.length !== header.length || !align.every((side) => ALIGNMENTS.includes(side)))
    throw new Error(`align must name ${ALIGNMENTS.join(', ')} for each of the ${header.length} columns`);
  rows.forEach((row, at) => {
    if (row.length !== header.length)
      throw new Error(`each row needs ${header.length} cells, and row ${at + 1} has ${row.length}`);
  });
}

export function monoTable(table) {
  checked(table);
  const { header, align, rows } = table;
  const columns = header.map((title, at) => {
    const cells = rows.map((row) => row[at]);
    const body = align[at] === 'decimal' ? onDecimalPoint(cells) : cells;
    const width = widthOf([title, ...body]);
    return [title, ...body].map((cell) => (align[at] === 'left' ? cell.padEnd(width) : cell.padStart(width)));
  });
  return [header, ...rows].map((_, line) =>
    columns
      .map((column) => column[line])
      .join(GAP)
      .trimEnd()
  );
}
