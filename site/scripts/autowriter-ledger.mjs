import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

import { describeProblem, instantProblems, readSchema } from './autowriter-records.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { validateJsonSchema } from './json-schema.mjs';

const { loop } = readEngineConfig();

export const ATTEMPT_CAP = loop.attemptCap;
export const QUARANTINE_HOURS = loop.quarantineHours;
export const MONTHLY_SPEND_CEILING_USD = loop.monthlySpendCeilingUsd;

export const IMMEDIATE_KINDS = ['spend-ceiling', 'credential', 'no-convergence'];
export const DIGEST_KINDS = ['hard-stop', 'unrepairable'];
export const ESCALATION_KINDS = [...IMMEDIATE_KINDS, ...DIGEST_KINDS];
export const CHANNELS = ['issue', 'slack', 'digest'];

const LEDGER_SCHEMA = readSchema('autowriter-ledger.schema.json');
export const REFUSAL_REASONS = LEDGER_SCHEMA.$defs.refusal.properties.reason.enum;
const DECIDED_WITH_REASON = ['escalated', 'stopped'];
const SPEND_TOLERANCE = 1e-6;
const MAX_SHOWN = 5;

export function requiredChannels(kind) {
  if (!ESCALATION_KINDS.includes(kind)) throw new Error(`unknown escalation kind ${kind}`);
  return IMMEDIATE_KINDS.includes(kind) ? ['issue', 'slack'] : ['issue'];
}

export const newLedger = ({ slug, runId, pullRequest }) => ({
  schema: 1,
  slug,
  runId,
  pullRequest,
  attempts: [],
  spend: { tokens: { input: 0, output: 0 }, costUsd: 0 },
  verdict: { state: 'open', reason: null, decidedAt: null },
  escalations: [],
});

const problem = (path, message) => ({ path, problem: message });
const sum = (values) => values.reduce((total, value) => total + value, 0);

const instantEntries = ({ attempts, verdict, escalations, measurementDebt }) => [
  ...attempts.map((attempt, index) => [`$.attempts[${index}].recordedAt`, attempt.recordedAt]),
  ['$.verdict.decidedAt', verdict.decidedAt],
  ...(measurementDebt === undefined ? [] : [['$.measurementDebt.recordedAt', measurementDebt.recordedAt]]),
  ...escalations.flatMap(({ raisedAt, receipts }, index) => [
    [`$.escalations[${index}].raisedAt`, raisedAt],
    ...receipts.map((receipt, at) => [`$.escalations[${index}].receipts[${at}].attemptedAt`, receipt.attemptedAt]),
  ]),
];

const attemptProblems = ({ attempts }) =>
  attempts.flatMap(({ number }, index) =>
    number === index + 1 ? [] : [problem(`$.attempts[${index}].number`, `must be ${index + 1}, got ${number}`)]
  );

function failureProblems({ attempts }) {
  return attempts.flatMap(({ failures, failingRule, failingPath }, index) => {
    if (failures === undefined) return [];
    const at = `$.attempts[${index}]`;
    const [head] = failures;
    return [
      ['failingRule', failingRule, 'rule', head.rule],
      ['failingPath', failingPath, 'path', head.path],
    ]
      .filter(([, recorded, , listed]) => recorded !== listed)
      .map(([name, recorded, member, listed]) =>
        problem(
          `${at}.${name}`,
          `is ${JSON.stringify(recorded)} but attempts[${index}].failures[0].${member} is ${JSON.stringify(listed)}`
        )
      );
  });
}

function debtProblems({ verdict, measurementDebt }) {
  const owed = verdict.state === 'merged';
  if (owed && measurementDebt === undefined)
    return [
      problem(
        '$.measurementDebt',
        'is required once the verdict is merged, so the tree no Lighthouse run measured is on record'
      ),
    ];
  if (!owed && measurementDebt !== undefined)
    return [problem('$.measurementDebt', `belongs to a merged verdict only, and this verdict is ${verdict.state}`)];
  return [];
}

function spendProblems({ attempts, generation, spend }) {
  const parts = generation === undefined ? attempts : [generation, ...attempts];
  const made = generation === undefined ? 'attempts' : 'generation and attempts';
  const totals = [
    ['$.spend.tokens.input', spend.tokens.input, sum(parts.map((entry) => entry.tokens.input))],
    ['$.spend.tokens.output', spend.tokens.output, sum(parts.map((entry) => entry.tokens.output))],
    ['$.spend.costUsd', spend.costUsd, sum(parts.map((entry) => entry.costUsd))],
  ];
  return totals
    .filter(([, recorded, added]) => Math.abs(recorded - added) > SPEND_TOLERANCE)
    .map(([path, recorded, added]) => problem(path, `is ${recorded} but its ${made} add up to ${added}`));
}

function verdictProblems({ verdict, escalations }) {
  const { state, reason, decidedAt } = verdict;
  if (state === 'open') {
    return [
      ...(decidedAt === null ? [] : [problem('$.verdict.decidedAt', 'must be null while the verdict is open')]),
      ...(reason === null ? [] : [problem('$.verdict.reason', 'must be null while the verdict is open')]),
    ];
  }
  return [
    ...(decidedAt === null ? [problem('$.verdict.decidedAt', `must be an instant once the verdict is ${state}`)] : []),
    ...(DECIDED_WITH_REASON.includes(state) && reason === null
      ? [problem('$.verdict.reason', `must say why the run is ${state}`)]
      : []),
    ...(state === 'escalated' && escalations.length === 0
      ? [problem('$.verdict.state', 'is escalated but escalations is empty, so nothing was ever delivered')]
      : []),
  ];
}

function receiptProblems({ channel, delivered, status, issue, error }, at) {
  const found = [];
  if (delivered && !(status >= 200 && status <= 299))
    found.push(problem(`${at}.status`, `must be a 2xx status when delivered is true, got ${status}`));
  if (!delivered && error === null) found.push(problem(`${at}.error`, 'must say why delivery failed'));
  if (delivered && channel === 'issue' && issue === null)
    found.push(problem(`${at}.issue`, 'must be the issue number once the issue channel is delivered'));
  if (channel !== 'issue' && issue !== null)
    found.push(problem(`${at}.issue`, `must be null on the ${channel} channel`));
  return found;
}

function escalationProblems({ escalations }) {
  const seen = new Set();
  return escalations.flatMap(({ id, receipts }, index) => {
    const repeated = seen.has(id) ? [problem(`$.escalations[${index}].id`, `${id} repeats an earlier escalation`)] : [];
    seen.add(id);
    const delivery = receipts.flatMap((receipt, at) =>
      receiptProblems(receipt, `$.escalations[${index}].receipts[${at}]`)
    );
    return [...repeated, ...delivery];
  });
}

export function validateLedger(ledger) {
  const shape = validateJsonSchema(LEDGER_SCHEMA, ledger);
  if (shape.length > 0) return shape;
  const calendar = instantProblems(instantEntries(ledger));
  if (calendar.length > 0) return calendar;
  return [
    ...attemptProblems(ledger),
    ...failureProblems(ledger),
    ...spendProblems(ledger),
    ...verdictProblems(ledger),
    ...debtProblems(ledger),
    ...escalationProblems(ledger),
  ];
}

export function deliveryProblems({ escalations }) {
  return escalations.flatMap(({ id, kind, receipts }, index) =>
    requiredChannels(kind).flatMap((channel) => {
      const tried = receipts.filter((receipt) => receipt.channel === channel);
      if (tried.some((receipt) => receipt.delivered)) return [];
      const at = `$.escalations[${index}]`;
      return tried.length === 0
        ? [problem(at, `${id} (${kind}) has no delivery receipt for ${channel}`)]
        : [problem(at, `${id} (${kind}) was not delivered to ${channel}: ${tried.at(-1).error}`)];
    })
  );
}

export const attemptCapProblem = ({ attempts }) =>
  attempts.length > ATTEMPT_CAP ? `${attempts.length} attempts recorded, the cap is ${ATTEMPT_CAP}` : null;

export function fileStemProblem(path, ledger) {
  const file = basename(path);
  return file === `${ledger.slug}.json` ? null : `slug ${ledger.slug} does not match the file name ${file}`;
}

export class LedgerError extends Error {
  constructor(path, problems) {
    const shown = problems.slice(0, MAX_SHOWN).join('; ');
    const more = problems.length > MAX_SHOWN ? ` (and ${problems.length - MAX_SHOWN} more)` : '';
    super(`${path} does not match the ledger schema: ${shown}${more}`);
    this.problems = problems;
  }
}

const refusals = (path, ledger) => {
  const shape = validateLedger(ledger).map(describeProblem);
  if (shape.length > 0) return shape;
  return [attemptCapProblem(ledger), fileStemProblem(path, ledger)].filter(Boolean);
};

export function readLedger(path) {
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path} is not readable JSON: ${error.message}`, { cause: error });
  }
  const shape = validateLedger(ledger).map(describeProblem);
  if (shape.length > 0) throw new LedgerError(path, shape);
  return ledger;
}

export function writeLedger(path, ledger) {
  const problems = refusals(path, ledger);
  if (problems.length > 0) throw new LedgerError(path, problems);
  mkdirSync(dirname(path), { recursive: true });
  const staged = `${path}.${process.pid}.tmp`;
  writeFileSync(staged, `${JSON.stringify(ledger, null, 2)}\n`);
  renameSync(staged, path);
}

const MICRO = 1e6;

const spendOf = (parts) => ({
  tokens: {
    input: sum(parts.map(({ tokens }) => tokens.input)),
    output: sum(parts.map(({ tokens }) => tokens.output)),
  },
  costUsd: Math.round(sum(parts.map(({ costUsd }) => costUsd)) * MICRO) / MICRO,
});

export function ledgerWithAttempt(ledger, attempt) {
  if (ledger.attempts.length >= ATTEMPT_CAP)
    throw new Error(`${ledger.slug} already has ${ledger.attempts.length} attempts and the cap is ${ATTEMPT_CAP}`);
  const attempts = [...ledger.attempts, { number: ledger.attempts.length + 1, ...attempt }];
  const generation = ledger.generation === undefined ? [] : [ledger.generation];
  return { ...ledger, attempts, spend: spendOf([...generation, ...attempts]) };
}
