const MEASURED =
  /^[*_]*Measured:[*_]*\s*(\d{4}-\d{2}-\d{2})\b(?:\s*\(window (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\))?/m;
const COUNT = /^\d+$/;
const DECIMAL = /^\d+(?:\.\d+)?$/;

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const lineValue = (label, text) =>
  new RegExp(`^[*_]*${escaped(label)}:[*_]*[ \\t]*(.*?)[ \\t]*$`, 'm').exec(text)?.[1] || null;

export function measuredOf(text) {
  const [, measured = null, windowStart = null, windowEnd = null] = MEASURED.exec(text) ?? [];
  return { measured, windowStart, windowEnd };
}

export const count = (cell) => (COUNT.test(cell ?? '') ? Number(cell) : null);

export const decimal = (cell) => (DECIMAL.test(cell ?? '') ? Number(cell) : null);

export const unticked = (cell) => cell.replaceAll('`', '').trim();

export const routesIn = (cell) =>
  cell
    .split(',')
    .map(unticked)
    .filter((route) => route !== '' && route !== '-');
