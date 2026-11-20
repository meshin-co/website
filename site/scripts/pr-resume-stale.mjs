import { REMEASURABLE_STOPS } from './repair-why.mjs';

const lastEscalation = (ledger) => ledger?.escalations.at(-1);

export const hasMeasuredMain = (ledger) => lastEscalation(ledger)?.measuredMain !== undefined;

export function staleVerdictOf(ledger, mainTip) {
  const { stop, gate, measuredMain } = lastEscalation(ledger) ?? {};
  const provable = REMEASURABLE_STOPS.includes(stop) && Boolean(gate) && Boolean(measuredMain);
  if (!provable || mainTip === null || mainTip === measuredMain) return null;
  return { gate, measuredMain, mainSha: mainTip };
}

export const remeasureSpent = ({ remeasures = [] }) => remeasures.length > 0;
