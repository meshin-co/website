import { WriterError } from './writer-error.mjs';

const tokenCount = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new WriterError('price', `usage.${field} must be a non-negative whole number of tokens`);
  }
  return value;
};

export function costUsd(rates, usage) {
  const inputCost = tokenCount(usage.input, 'input') * rates.inputPerMillion;
  const outputCost = tokenCount(usage.output, 'output') * rates.outputPerMillion;
  return Math.round(inputCost + outputCost) / 1e6;
}
