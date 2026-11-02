import { WRITING_ROLES } from './generation-record.mjs';

const MICRO = 1e6;
const INSTANT = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?Z$/;

export const microOf = (usd) => Math.round(usd * MICRO);

export function monthOf(instant) {
  const text = instant instanceof Date && !Number.isNaN(instant.getTime()) ? instant.toISOString() : instant;
  if (typeof text !== 'string' || !INSTANT.test(text))
    throw new Error(`${JSON.stringify(instant)} is not a UTC instant such as 2026-11-01T00:00:00Z`);
  return text.slice(0, 7);
}

const writingCostUsd = (record) =>
  record.calls
    .filter(({ role }) => WRITING_ROLES.includes(role))
    .reduce((total, { costUsd }) => total + microOf(costUsd), 0) / MICRO;
export const recordMicro = (record) => (record ? microOf(writingCostUsd(record)) : 0);
const ledgerGenerationMicro = (ledger) => microOf(ledger.generation?.costUsd ?? 0);

function generationPart({ ledger, record }, month) {
  const at = record?.generatedAt ?? ledger.verdict.decidedAt;
  return {
    month: at === null || at === undefined ? month : monthOf(at),
    micro: Math.max(ledgerGenerationMicro(ledger), recordMicro(record)),
  };
}

const partsOf = (item, month) => [
  generationPart(item, month),
  ...item.ledger.attempts.map(({ recordedAt, costUsd }) => ({ month: monthOf(recordedAt), micro: microOf(costUsd) })),
];

export function monthlySpend({ ledgers, month }) {
  return ledgers
    .flatMap((item) => partsOf(item, month))
    .filter((part) => part.month === month)
    .reduce((total, part) => total + part.micro, 0);
}

export function spendWarnings({ ledgers }) {
  return ledgers
    .filter(({ ledger, record }) => recordMicro(record) > ledgerGenerationMicro(ledger))
    .map(
      ({ ledger, record }) =>
        `${ledger.slug}: its generation record's writing calls cost ${writingCostUsd(record)} USD but its ledger records ` +
        `${ledger.generation?.costUsd ?? 0} USD for the generation, so the record cost is counted`
    );
}

const bySlug = (left, right) =>
  left.ledger.slug < right.ledger.slug ? -1 : left.ledger.slug > right.ledger.slug ? 1 : 0;

export function chooseVersions(candidates) {
  const groups = Map.groupBy(candidates, ({ ledger }) => ledger.slug);
  return [...groups.values()]
    .map((versions) => {
      const chosen = versions.reduce((best, next) =>
        microOf(next.ledger.spend.costUsd) > microOf(best.ledger.spend.costUsd) ? next : best
      );
      const record = chosen.record ?? versions.find((version) => version.record)?.record ?? null;
      return { source: chosen.source, ledger: chosen.ledger, record };
    })
    .sort(bySlug);
}
