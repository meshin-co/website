export const SIBLINGS = 1;
export const MAX_ITEMS = 2 * SIBLINGS + 5;

const EDGE_PAGES = MAX_ITEMS - 2;
const GAP = null;

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, offset) => from + offset);

function assertWhole(name, value, max) {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new RangeError(`pageWindow: ${name} must be a whole number from 1 to ${max}, got ${String(value)}`);
  }
}

function slots(current, total) {
  if (total <= MAX_ITEMS) return range(1, total);
  if (current <= EDGE_PAGES - SIBLINGS) return [...range(1, EDGE_PAGES), GAP, total];
  if (current > total - EDGE_PAGES + SIBLINGS) return [1, GAP, ...range(total - EDGE_PAGES + 1, total)];
  return [1, GAP, ...range(current - SIBLINGS, current + SIBLINGS), GAP, total];
}

const itemOf = (slot, current) =>
  slot === GAP ? { kind: 'gap' } : { kind: slot === current ? 'current' : 'link', page: slot };

export function pageWindow(current, total) {
  assertWhole('total', total, Number.MAX_SAFE_INTEGER);
  assertWhole('current', current, total);
  return {
    previous: current > 1 ? current - 1 : null,
    next: current < total ? current + 1 : null,
    items: slots(current, total).map((slot) => itemOf(slot, current)),
  };
}
