import { WriterError } from './writer-error.mjs';

export const OUTCOMES = [
  'repaired',
  'stale',
  'unrepairable',
  'no-convergence',
  'spend-ceiling',
  'credential',
  'failed',
];

export const ESCALATION_KIND = {
  unrepairable: 'unrepairable',
  'no-convergence': 'no-convergence',
  'spend-ceiling': 'spend-ceiling',
  credential: 'credential',
  failed: 'hard-stop',
};

export const isOutcome = (word) => OUTCOMES.includes(word);

export const exitCodeOf = (outcome) => (outcome === 'repaired' ? 0 : 1);

export class RepairStop extends Error {
  constructor(outcome, message, details = {}) {
    if (!isOutcome(outcome)) throw new Error(`${outcome} is not a repair outcome`);
    if (outcome === 'repaired') throw new Error('repaired is not a stop');
    super(message);
    this.name = 'RepairStop';
    this.outcome = outcome;
    this.details = details;
  }
}

export function outcomeOf(error) {
  if (error instanceof RepairStop) return error.outcome;
  if (error instanceof WriterError && error.kind === 'credential') return 'credential';
  return 'failed';
}
