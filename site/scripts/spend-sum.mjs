import { ENDED_VERDICTS } from './autowriter-ledger.mjs';
import { REPAIR_ROLES, WRITING_ROLES } from './generation-record.mjs';

const MICRO = 1e6;
const INSTANT = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?Z$/;

export const microOf = (usd) => Math.round(usd * MICRO);

export const isUtcInstant = (value) => typeof value === 'string' && INSTANT.test(value);

export const instantError = (value) =>
  new Error(`${JSON.stringify(value)} is not a UTC instant such as 2026-11-01T00:00:00Z`);

export function monthOf(instant) {
  const text = instant instanceof Date && !Number.isNaN(instant.getTime()) ? instant.toISOString() : instant;
  if (!isUtcInstant(text)) throw instantError(instant);
  return text.slice(0, 7);
}

export const ledgerStemOf = (path) => path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');

const callsMicro = (record, roles) =>
  record.calls.filter(({ role }) => roles.includes(role)).reduce((total, { costUsd }) => total + microOf(costUsd), 0);

export const recordMicro = (record) => (record ? callsMicro(record, WRITING_ROLES) : 0);
export const recordRepairMicro = (record) => (record ? callsMicro(record, REPAIR_ROLES) : 0);
export const attemptsMicro = (ledger) =>
  ledger ? ledger.attempts.reduce((total, { costUsd }) => total + microOf(costUsd), 0) : 0;
const ledgerGenerationMicro = (ledger) => microOf(ledger?.generation?.costUsd ?? 0);

function generationPart({ ledger, record }) {
  const at = record?.generatedAt ?? ledger?.verdict.decidedAt;
  return {
    kind: 'writing',
    month: at === null || at === undefined ? null : monthOf(at),
    micro: Math.max(ledgerGenerationMicro(ledger), recordMicro(record)),
  };
}

const attemptParts = ({ ledger }) =>
  (ledger?.attempts ?? []).map(({ recordedAt, costUsd }) => ({
    kind: 'repair',
    month: monthOf(recordedAt),
    micro: microOf(costUsd),
  }));

function uncoveredRepairParts({ ledger, record }) {
  const uncovered = recordRepairMicro(record) - attemptsMicro(ledger);
  return uncovered > 0 ? [{ kind: 'repair', month: monthOf(record.generatedAt), micro: uncovered }] : [];
}

const partsOf = (item) => [generationPart(item), ...attemptParts(item), ...uncoveredRepairParts(item)];

export const hasEnded = ({ verdict }) => ENDED_VERDICTS.includes(verdict.state);

const unrecordedKind = ({ ledger, record }) => (record ? null : hasEnded(ledger) ? 'ended' : 'unmatched');

function breakdownOf(items, keeps) {
  const sums = { writing: 0, repair: 0, ended: 0, unmatched: 0 };
  for (const item of items) {
    const unrecorded = unrecordedKind(item);
    for (const part of partsOf(item)) if (keeps(part)) sums[unrecorded ?? part.kind] += part.micro;
  }
  return {
    writingMicro: sums.writing,
    repairMicro: sums.repair,
    endedMicro: sums.ended,
    unmatchedMicro: sums.unmatched,
    totalMicro: sums.writing + sums.repair + sums.ended + sums.unmatched,
  };
}

export const monthlyBreakdown = ({ ledgers, month }) =>
  breakdownOf(ledgers, (part) => part.month === null || part.month === month);

export const totalBreakdown = ({ ledgers }) => breakdownOf(ledgers, () => true);

export const monthlySpend = (input) => monthlyBreakdown(input).totalMicro;

const combined = (group) => (group === undefined ? null : { ...group[0], calls: group.flatMap(({ calls }) => calls) });

export function spendItemsOf({ ledgers, records }) {
  const named = Map.groupBy(records, ({ ledger }) => ledgerStemOf(ledger));
  const known = new Set(ledgers.map(({ slug }) => slug));
  return [
    ...ledgers.map((ledger) => ({ ledger, record: combined(named.get(ledger.slug)) })),
    ...records.filter(({ ledger }) => !known.has(ledgerStemOf(ledger))).map((record) => ({ ledger: null, record })),
  ];
}

export const usdOf = (micro) => micro / MICRO;

const writingSentence = ({ ledger, record }) =>
  `${ledger.slug}: its generation record's writing calls cost ${usdOf(recordMicro(record))} USD but its ledger records ` +
  `${ledger.generation?.costUsd ?? 0} USD for the generation, so the record cost is counted`;

const repairSentence = ({ ledger, record }) =>
  `${ledger.slug}: its generation record's repair calls cost ${usdOf(recordRepairMicro(record))} USD but its ledger records ` +
  `${usdOf(attemptsMicro(ledger))} USD for its attempts, so the record cost is counted`;

const recordOnlySentence = ({ record }) =>
  `${record.slug}: its generation record names the ledger ${record.ledger}, which does not exist, so its cost is counted from the record alone`;

export function spendWarnings({ ledgers }) {
  return ledgers.flatMap((item) => {
    if (item.ledger === null) return [recordOnlySentence(item)];
    return [
      ...(recordMicro(item.record) > ledgerGenerationMicro(item.ledger) ? [writingSentence(item)] : []),
      ...(recordRepairMicro(item.record) > attemptsMicro(item.ledger) ? [repairSentence(item)] : []),
    ];
  });
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
