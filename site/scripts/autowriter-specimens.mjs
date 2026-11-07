import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { brandFromDisk, titleSuffix } from '../src/utils/brand.mjs';
import { generatedTitles, normaliseTitle } from './autowriter-claims.mjs';
import { historySpecimens } from './autowriter-history-specimens.mjs';
import { ATTEMPT_CAP } from './autowriter-ledger.mjs';
import { recordSpecimens } from './autowriter-record-specimens.mjs';
import { spendSpecimens } from './autowriter-spend-specimens.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';

const GATE = 'gate:autowriter';
const HASH = 'c'.repeat(40);
const INSTANT = '2026-11-02T07:00:00.000Z';
const LEDGER_PATH = recordPath('ledger', 'zz-specimen', INSTANT);
const CLAIM_PATH = recordPath('claim', 'zz-specimen', '2026-11-01T07:00:00.000Z');
const STRAY_LEDGER_PATH = `${recordDirectory('ledger')}/zz-specimen.json`;
const WORKFLOW_PATH = '../.github/workflows/ci.yml';
const CORE_PATH = '../docs/SEMANTIC-CORE.md';

const AGGREGATE_NEEDS = 'needs: [changes, build, types-and-units, cheap-gates, visual-and-axe, deploy-preview]';
const AGGREGATE_IF = "if: always() && (github.event_name != 'workflow_dispatch' || inputs.full)";
const AGGREGATE_NAME =
  "name: ${{ github.event_name == 'pull_request' && 'all required jobs passed' || format('all required jobs passed ({0})', github.event_name) }}";
const BASELINES_STEP = 'name: Commit regenerated linux baselines\n        env:\n          ';
const BASELINES_PAT_ENV = BASELINES_STEP + 'AUTOWRITER_PAT: ${{ secrets.AUTOWRITER_PAT }}';
const BASELINES_DEFAULT_ENV = BASELINES_STEP + 'GITHUB_TOKEN: ${{ github.token }}';
const CLASSIFIER_BEFORE = 'BEFORE: ${{ github.event.pull_request.base.sha || github.event.before }}';
const CLASSIFIER_LAST_PUSH = 'BEFORE: ${{ github.event.before }}';

const attempt = (number, extra = {}) => ({
  number,
  judgedCommit: HASH,
  recordedAt: INSTANT,
  failingRule: 'banned-phrase',
  failingPath: 'site/src/data/post/zz-specimen.md',
  tokens: { input: 10, output: 5 },
  costUsd: 0.5,
  ...extra,
});

const ledger = ({ attempts = [], verdict, escalations = [] }) => ({
  schema: 1,
  slug: 'zz-specimen',
  runId: '1',
  pullRequest: null,
  attempts,
  spend: {
    tokens: { input: 10 * attempts.length, output: 5 * attempts.length },
    costUsd: 0.5 * attempts.length,
  },
  verdict: verdict ?? { state: 'open', reason: null, decidedAt: null },
  escalations,
});

const receipt = (channel, extra = {}) => ({
  channel,
  attemptedAt: INSTANT,
  delivered: true,
  status: 201,
  issue: 1,
  error: null,
  ...extra,
});

const attemptsUpToCap = Array.from({ length: ATTEMPT_CAP }, (_, index) => attempt(index + 1));

const escalated = (receipts) =>
  ledger({
    attempts: attemptsUpToCap,
    verdict: { state: 'escalated', reason: 'the same rule failed on every attempt', decidedAt: INSTANT },
    escalations: [
      {
        id: 'esc-1',
        kind: 'no-convergence',
        title: 'The loop will not converge',
        detail: 'The same rule failed on every attempt.',
        raisedAt: INSTANT,
        receipts,
      },
    ],
  });

const asJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function heldTitle(copySite) {
  const rows = generatedTitles(await readFile(join(copySite, CORE_PATH), 'utf8'));
  const held = rows.find(({ family }) => family === 'term');
  if (!held) throw new Error('specimen found no term title in the generated layer of the semantic core');
  return normaliseTitle(held.title, titleSuffix(brandFromDisk()));
}

const claimOn = (title) => ({
  schema: 1,
  slug: 'zz-specimen',
  title,
  format: 'term',
  query: 'zz specimen query',
  demand: { impressions: 0, position: null },
  prompt: { number: 1, text: 'A planted specimen prompt.' },
  origin: 'demand',
  runId: '1',
  status: 'claimed',
  claimedAt: '2026-11-01T07:00:00.000Z',
  expiresAt: '2099-01-01T00:00:00.000Z',
});

const categoryClaimWithPrompt = () => ({
  ...claimOn('A planted category specimen'),
  format: 'article',
  origin: 'category',
  category: 'governance',
});

const withoutPrompt = (claim) => Object.fromEntries(Object.entries(claim).filter(([key]) => key !== 'prompt'));

const orderedClaimWithWeakness = () => ({
  ...withoutPrompt(claimOn('A planted ordered specimen')),
  format: 'article',
  origin: 'ordered',
  weakness: ['no-buyer-prompt'],
});

const planLedger = (addUntrackedFile, build) => (copySite) =>
  addUntrackedFile(join(copySite, '..', LEDGER_PATH), asJson(build()));

const planWorkflowEdit = (editFile, from, to) => (copySite) =>
  editFile(join(copySite, WORKFLOW_PATH), (text) => text.replace(from, to));

export const autowriterSpecimens = ({ addUntrackedFile, editFile, removeFile }) => ({
  autowriterLedgerOffSchema: {
    gate: GATE,
    token: `ledger-schema ${LEDGER_PATH}`,
    plant: planLedger(addUntrackedFile, () => ledger({ attempts: [attempt(1, { judgedCommit: 'abc1234' })] })),
  },
  autowriterAttemptsOverCap: {
    gate: GATE,
    token: `attempt-cap ${LEDGER_PATH}`,
    plant: planLedger(addUntrackedFile, () =>
      ledger({ attempts: Array.from({ length: ATTEMPT_CAP + 1 }, (_, index) => attempt(index + 1)) })
    ),
  },
  autowriterClaimTitleCollides: {
    gate: GATE,
    token: `title-collision ${CLAIM_PATH}`,
    plant: async (copySite) =>
      addUntrackedFile(join(copySite, '..', CLAIM_PATH), asJson(claimOn(await heldTitle(copySite)))),
  },
  autowriterClaimOriginMismatch: {
    gate: GATE,
    token: `claim-schema ${CLAIM_PATH}: prompt must be absent when origin is category`,
    plant: (copySite) => addUntrackedFile(join(copySite, '..', CLAIM_PATH), asJson(categoryClaimWithPrompt())),
  },
  autowriterOrderedClaimOffItsRules: {
    gate: GATE,
    token: `claim-schema ${CLAIM_PATH}: weakness must be absent when origin is ordered`,
    plant: (copySite) => addUntrackedFile(join(copySite, '..', CLAIM_PATH), asJson(orderedClaimWithWeakness())),
  },
  autowriterEscalationFailed: {
    gate: GATE,
    token: `escalation-undelivered ${LEDGER_PATH}: escalations[0] esc-1 (no-convergence) was not delivered to slack`,
    plant: planLedger(addUntrackedFile, () =>
      escalated([
        receipt('issue'),
        receipt('slack', {
          delivered: false,
          status: null,
          issue: null,
          error: 'SLACK_WEBHOOK_URL is not set; create the repository secret of that name',
        }),
      ])
    ),
  },
  autowriterEscalationUnreceipted: {
    gate: GATE,
    token: `escalation-undelivered ${LEDGER_PATH}: escalations[0] esc-1 (no-convergence) has no delivery receipt for issue`,
    plant: planLedger(addUntrackedFile, () => escalated([])),
  },
  autowriterMeasurementDebtMissing: {
    gate: GATE,
    token: `ledger-schema ${LEDGER_PATH}: measurementDebt is required once the verdict is merged, so the tree no Lighthouse run measured is on record`,
    plant: planLedger(addUntrackedFile, () =>
      ledger({ attempts: [attempt(1)], verdict: { state: 'merged', reason: null, decidedAt: INSTANT } })
    ),
  },
  autowriterRecordMisfiled: {
    gate: GATE,
    token: `record-layout ${STRAY_LEDGER_PATH}`,
    plant: (copySite) =>
      addUntrackedFile(join(copySite, '..', STRAY_LEDGER_PATH), asJson(ledger({ attempts: [attempt(1)] }))),
  },
  autowriterJobOutsideAggregate: {
    gate: GATE,
    token: 'aggregate-uncovered .github/workflows/ci.yml',
    plant: planWorkflowEdit(editFile, AGGREGATE_NEEDS, AGGREGATE_NEEDS.replace('visual-and-axe, ', '')),
  },
  autowriterAggregateSkippable: {
    gate: GATE,
    token: 'aggregate-not-always .github/workflows/ci.yml',
    plant: planWorkflowEdit(editFile, AGGREGATE_IF, AGGREGATE_IF.replace('always() && ', '')),
  },
  autowriterAggregateNameShadowed: {
    gate: GATE,
    token: 'aggregate-name .github/workflows/ci.yml',
    plant: planWorkflowEdit(editFile, AGGREGATE_NAME, 'name: all required jobs passed'),
  },
  autowriterPushWithDefaultToken: {
    gate: GATE,
    token: 'bot-push-token .github/workflows/ci.yml',
    plant: planWorkflowEdit(editFile, BASELINES_PAT_ENV, BASELINES_DEFAULT_ENV),
  },
  autowriterClassifierJudgesLastPush: {
    gate: GATE,
    token: 'classifier-judges-last-push .github/workflows/ci.yml',
    plant: planWorkflowEdit(editFile, CLASSIFIER_BEFORE, CLASSIFIER_LAST_PUSH),
  },
  ...recordSpecimens({ addUntrackedFile, editFile }),
  ...spendSpecimens({ addUntrackedFile, editFile, removeFile }),
  ...historySpecimens(),
});
