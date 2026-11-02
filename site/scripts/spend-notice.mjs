import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LEDGER_DIR, ledgerFile, readLedger, requiredChannels } from './autowriter-ledger.mjs';
import { redeliver } from './escalate.mjs';
import { raiseOnRun } from './escalate-run.mjs';

const KIND = 'spend-ceiling';

export const noticeSlug = (month) => `spend-ceiling-${month}`;
export const noticeFile = (month) => ledgerFile(noticeSlug(month));
const noticePath = (repoRoot, month) => join(repoRoot, LEDGER_DIR, `${noticeSlug(month)}.json`);

const reachedEscalations = (ledger) => ledger.escalations.filter(({ kind }) => kind === KIND);
const deliveredTo = ({ receipts }, channel) =>
  receipts.some((receipt) => receipt.channel === channel && receipt.delivered);
const isDelivered = (escalation) => requiredChannels(KIND).every((channel) => deliveredTo(escalation, channel));

const escalationsOf = (path) => (existsSync(path) ? reachedEscalations(readLedger(path)) : []);

export const noticePosted = ({ repoRoot, month }) => escalationsOf(noticePath(repoRoot, month)).some(isDelivered);

const usd = (value) => `${value} USD`;

export function raiseNotice({ repoRoot, month, spentUsd, ceilingUsd, env, fetch, now }) {
  const path = noticePath(repoRoot, month);
  const pending = escalationsOf(path).findLast((escalation) => !isDelivered(escalation));
  if (pending) return redeliver({ ledgerPath: path, id: pending.id, env, fetch, now });
  return raiseOnRun({
    ledgerDir: join(repoRoot, LEDGER_DIR),
    slug: noticeSlug(month),
    kind: KIND,
    title: `Monthly spend ceiling reached for ${month}: ${usd(spentUsd)} of ${usd(ceilingUsd)}`,
    detail:
      `The attempt ledgers record ${usd(spentUsd)} of model spend in ${month} (UTC calendar month) ` +
      `against the ceiling of ${usd(ceilingUsd)}. Write daily stopped before it called any model and will ` +
      `stop again on every run until the month changes. The sum covers the generation and repair costs in ` +
      `audits/autowriter on main and on every autowriter branch.`,
    env,
    fetch,
    now,
  });
}
