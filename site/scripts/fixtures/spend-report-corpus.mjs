import { newLedger } from '../autowriter-ledger.mjs';
import { buildRecord, callTotals, ledgerWithGeneration } from '../generation-record.mjs';
import { recordPath as filedAt } from '../record-layout.mjs';
import { costUsd } from '../writer-cost.mjs';
import { callOf, recordInput, termInput } from './generation-input.mjs';

export const REVISION = '3fa620f';
export const DECIDED_AT = '2026-11-03T09:00:00.000Z';
export const PRICE = { inputPerMillion: 1, outputPerMillion: 5 };
export const MODEL = 'gpt-6.1-terra-2026-10-01';

export const FILED_AT = '2026-11-03T09:00:00.000Z';
export const ledgerPath = (slug) => filedAt('ledger', slug, FILED_AT);
export const recordPath = (slug) => filedAt('generation', slug, FILED_AT);
export const asText = (value) => `${JSON.stringify(value, null, 2)}\n`;

const FORMATS = {
  article: { input: recordInput, collection: 'post', prefix: '/blog' },
  term: { input: termInput, collection: 'glossary', prefix: '/glossary' },
};

export function writingCall({ role = 'draft', input = 12000, output = 3000, price = PRICE, model = MODEL, tag } = {}) {
  const call = callOf(role, { input, output }, tag ?? `${role}-${input}-${output}`);
  return { ...call, resolvedModel: model, price: { ...price }, costUsd: costUsd(price, { input, output }) };
}

export function recordOf({ slug, format = 'article', at, runId = 'run-1', ledgerSlug = slug, calls }) {
  const { input, collection, prefix } = FORMATS[format];
  const base = input();
  const made = calls ?? [writingCall({ tag: `${slug}-draft` })];
  const entryPath = `site/src/data/${collection}/${slug}.md`;
  return buildRecord({
    ...base,
    claim: { ...base.claim, slug, runId },
    route: `${prefix}/${slug}`,
    entryPath,
    ledger: ledgerPath(ledgerSlug),
    generatedAt: at,
    calls: made,
    published: { callIndex: made.length - 1 },
    files: [entryPath, recordPath(slug)],
  });
}

export const ledgerOf = ({ slug, runId = 'run-1', calls }) =>
  ledgerWithGeneration(newLedger({ slug, runId, pullRequest: null }), callTotals(calls));

export const mergedLedger = (ledger) => ({
  ...ledger,
  pullRequest: 7,
  verdict: { state: 'merged', reason: null, decidedAt: DECIDED_AT },
  measurementDebt: {
    mergedCommit: 'a'.repeat(40),
    fingerprint: 'b'.repeat(64),
    recordedAt: DECIDED_AT,
    clear: 'run npm run gate:lh on the merged tree',
  },
});

export const stoppedLedger = (ledger) => ({
  ...ledger,
  verdict: { state: 'stopped', reason: 'generation failed (output): the response was cut off', decidedAt: DECIDED_AT },
});

const receipt = (channel) => ({
  channel,
  attemptedAt: DECIDED_AT,
  delivered: true,
  status: channel === 'issue' ? 201 : 200,
  issue: channel === 'issue' ? 12 : null,
  error: null,
});

export const escalatedLedger = (ledger) => ({
  ...ledger,
  verdict: {
    state: 'escalated',
    reason: `Write daily stopped while writing ${ledger.slug} (output)`,
    decidedAt: DECIDED_AT,
  },
  escalations: [
    {
      id: 'esc-1',
      kind: 'hard-stop',
      title: `Write daily stopped while writing ${ledger.slug} (output)`,
      detail: 'npm run write:entry failed with kind output: the response was cut off.',
      raisedAt: DECIDED_AT,
      receipts: [receipt('issue'), receipt('slack')],
    },
  ],
});

export const discardedLedger = (ledger) => ({
  ...ledger,
  pullRequest: 78,
  verdict: { state: 'discarded', reason: 'the owner closed the pull request unmerged', decidedAt: DECIDED_AT },
});

export const filesOf = ({ ledgers = [], records = [] }) => ({
  ledgers: ledgers.map((ledger) => ({ path: ledgerPath(ledger.slug), text: asText(ledger) })),
  records: records.map((record) => ({ path: recordPath(record.slug), text: asText(record) })),
});
