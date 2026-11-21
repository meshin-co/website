import { isOutcome } from './repair-outcome.mjs';
import { STOPS } from './repair-why.mjs';

const GATE = /^gate:[a-z0-9-]+$/;
const COMMIT = /^[0-9a-f]{40}$/;
const MAX_TEXT = 300;

const isText = (value) => typeof value === 'string' && value.trim() !== '' && value.length <= MAX_TEXT;

const FIELDS = {
  stop: (value) => STOPS.includes(value),
  gate: (value) => typeof value === 'string' && GATE.test(value),
  rule: isText,
  subject: isText,
  ciRun: (value) => Number.isSafeInteger(value) && value > 0,
  measuredMain: (value) => typeof value === 'string' && COMMIT.test(value),
};

export function parseReport(line) {
  let printed;
  try {
    printed = JSON.parse(line);
  } catch {
    return null;
  }
  if (printed === null || typeof printed !== 'object' || !isOutcome(printed.outcome)) return null;
  const known = Object.entries(FIELDS).filter(([name, valid]) => valid(printed[name]));
  return { outcome: printed.outcome, report: Object.fromEntries(known.map(([name]) => [name, printed[name]])) };
}
