import { RepairStop } from './repair-outcome.mjs';

export const STOPS = ['no-artifact', 'no-findings', 'refused', 'build-broke', 'scope'];
export const REMEASURABLE_STOPS = ['no-artifact', 'no-findings', 'refused'];

export const refusedBecause = ({ gate, rule, subjects }) => ({ stop: 'refused', gate, rule, subject: subjects[0] });

export async function explained(error, { run, judged }) {
  const named = error instanceof RepairStop ? error.details.why : undefined;
  if (named === undefined) return error;
  const facts = REMEASURABLE_STOPS.includes(named.stop) ? await judged(run) : {};
  error.details = { ...error.details, why: { ...facts, ...named, ciRun: run.id } };
  return error;
}
