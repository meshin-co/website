import { ESCALATION_KINDS, readLedger, requiredChannels, writeLedger } from './autowriter-ledger.mjs';
import { SENDERS, variable } from './escalate-channels.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const MAX_ERROR_LENGTH = 300;

const USAGE = `Usage:
  node scripts/escalate.mjs raise --ledger <path> --kind <kind> --title <text> --detail <text>
  node scripts/escalate.mjs redeliver --ledger <path> --id <esc-n>
Kinds: ${ESCALATION_KINDS.join(', ')}`;

const oneLine = (text) => text.replace(/\s+/g, ' ').trim();

const webhookPathOf = (url) => {
  try {
    const { pathname } = new URL(url);
    return pathname.length > 1 ? pathname : '';
  } catch {
    return '';
  }
};

export function redactorFor(env) {
  const webhook = variable(env, 'SLACK_WEBHOOK_URL');
  const secrets = [
    [webhook, 'SLACK_WEBHOOK_URL'],
    [webhookPathOf(webhook), 'SLACK_WEBHOOK_URL'],
    [variable(env, 'GITHUB_TOKEN'), 'GITHUB_TOKEN'],
  ].filter(([value]) => value !== '');
  return (text) =>
    oneLine(secrets.reduce((clean, [value, name]) => clean.replaceAll(value, `[${name}]`), String(text)));
}

const wasDelivered = (escalation, channel) =>
  escalation.receipts.some((receipt) => receipt.channel === channel && receipt.delivered);
const undelivered = (escalation) =>
  requiredChannels(escalation.kind).filter((channel) => !wasDelivered(escalation, channel));
const latestReceipt = (escalation, channel) => escalation.receipts.findLast((receipt) => receipt.channel === channel);

export class EscalationError extends Error {
  constructor(escalation, missing) {
    const reasons = missing.map((channel) => `${channel}: ${latestReceipt(escalation, channel)?.error}`);
    super(`escalation ${escalation.id} (${escalation.kind}) was not delivered: ${reasons.join(' | ')}`);
    this.name = 'EscalationError';
    this.escalation = escalation;
    this.missing = missing;
  }
}

export function receiptOf(channel, attemptedAt, outcome, clean) {
  if (outcome.error !== undefined) {
    const error = clean(outcome.error).slice(0, MAX_ERROR_LENGTH);
    return { channel, attemptedAt, delivered: false, status: outcome.status ?? null, issue: null, error };
  }
  const issue = outcome.issue?.number ?? null;
  const error = outcome.rejected === undefined ? null : `the formatted message was refused: ${clean(outcome.rejected)}`;
  return { channel, attemptedAt, delivered: true, status: outcome.status, issue, error };
}

async function attempt(channels, context) {
  const receipts = [];
  for (const channel of channels) {
    const attemptedAt = context.now().toISOString();
    const outcome = await SENDERS[channel](context);
    if (outcome.issue) context.issue = outcome.issue;
    receipts.push(receiptOf(channel, attemptedAt, outcome, context.clean));
  }
  return receipts;
}

function readWritableLedger(ledgerPath) {
  const ledger = readLedger(ledgerPath);
  writeLedger(ledgerPath, ledger);
  return ledger;
}

function conclude(escalation) {
  const missing = undelivered(escalation);
  if (missing.length > 0) throw new EscalationError(escalation, missing);
  return escalation;
}

function earlierIssue(escalation) {
  const receipt = escalation.receipts.find(({ channel, delivered }) => channel === 'issue' && delivered);
  return receipt ? { number: receipt.issue, url: null } : null;
}

const contextFor = ({ ledger, ledgerPath, escalation, env, fetch, now, pullRequest = null }) => ({
  ledger,
  ledgerPath,
  escalation,
  env,
  fetch,
  now,
  pullRequest,
  clean: redactorFor(env),
  issue: earlierIssue(escalation),
});

const requireText = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} must not be blank`);
};

export async function escalate({
  ledgerPath,
  kind,
  title,
  detail,
  pullRequest = null,
  env = process.env,
  fetch = globalThis.fetch,
  now = () => new Date(),
}) {
  const channels = requiredChannels(kind);
  requireText(title, 'title');
  requireText(detail, 'detail');
  const ledger = readWritableLedger(ledgerPath);
  const escalation = {
    id: `esc-${ledger.escalations.length + 1}`,
    kind,
    title,
    detail,
    raisedAt: now().toISOString(),
    receipts: [],
  };
  escalation.receipts = await attempt(
    channels,
    contextFor({ ledger, ledgerPath, escalation, env, fetch, now, pullRequest })
  );
  ledger.escalations.push(escalation);
  writeLedger(ledgerPath, ledger);
  return conclude(escalation);
}

export async function redeliver({
  ledgerPath,
  id,
  env = process.env,
  fetch = globalThis.fetch,
  now = () => new Date(),
}) {
  const ledger = readWritableLedger(ledgerPath);
  const escalation = ledger.escalations.find((candidate) => candidate.id === id);
  if (!escalation) throw new Error(`no escalation ${id} in ${ledgerPath}`);
  const retries = undelivered(escalation);
  if (retries.length === 0) return escalation;
  const receipts = await attempt(retries, contextFor({ ledger, ledgerPath, escalation, env, fetch, now }));
  escalation.receipts.push(...receipts);
  writeLedger(ledgerPath, ledger);
  return conclude(escalation);
}

const OPTIONS = { raise: ['ledger', 'kind', 'title', 'detail'], redeliver: ['ledger', 'id'] };

class UsageError extends Error {}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const allowed = OPTIONS[command];
  if (!allowed) throw new UsageError(command ? `unknown command ${command}` : 'a command is required');
  const options = {};
  for (let at = 0; at < rest.length; at += 2) {
    const name = rest[at].startsWith('--') ? rest[at].slice(2) : null;
    if (!allowed.includes(name)) throw new UsageError(`unknown flag ${rest[at]}`);
    if (rest[at + 1] === undefined) throw new UsageError(`${rest[at]} needs a value`);
    options[name] = rest[at + 1];
  }
  const blank = allowed.filter((name) => (options[name] ?? '').trim() === '');
  if (blank.length > 0) throw new UsageError(`missing or blank: ${blank.map((name) => `--${name}`).join(', ')}`);
  if (command === 'raise' && !ESCALATION_KINDS.includes(options.kind))
    throw new UsageError(`unknown kind ${options.kind}`);
  return { command, options };
}

export const wasPlainText = (receipt) => receipt.delivered && receipt.error !== null;

export function describeDelivery(label, receipt) {
  if (!receipt.delivered) return `${label} NOT delivered: ${receipt.error}`;
  if (wasPlainText(receipt)) return `${label} delivered as plain text (HTTP ${receipt.status}): ${receipt.error}`;
  const issue = receipt.issue === null ? '' : `, issue #${receipt.issue}`;
  return `${label} delivered (HTTP ${receipt.status}${issue})`;
}

export const describeReceipt = (escalation, receipt) =>
  describeDelivery(`escalate: ${escalation.id} ${receipt.channel}`, receipt);

const latestReceipts = (escalation) =>
  requiredChannels(escalation.kind).map((channel) => latestReceipt(escalation, channel));

export async function runCli(argv, io = {}) {
  const { env = process.env, fetch = globalThis.fetch, now = () => new Date() } = io;
  const { stdout = console.log, stderr = console.error } = io;
  let parsed;
  try {
    parsed = parseArguments(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    stderr(`escalate: ${error.message}\n${USAGE}`);
    return 2;
  }
  const { command, options } = parsed;
  const show = (escalation) =>
    latestReceipts(escalation).forEach((receipt) => {
      const line = describeReceipt(escalation, receipt);
      if (wasPlainText(receipt)) stderr(`::warning::${line}`);
      else stdout(line);
    });
  try {
    const request = { ledgerPath: options.ledger, env, fetch, now };
    show(
      command === 'raise'
        ? await escalate({ ...request, kind: options.kind, title: options.title, detail: options.detail })
        : await redeliver({ ...request, id: options.id })
    );
    return 0;
  } catch (error) {
    if (error instanceof EscalationError) show(error.escalation);
    else stderr(`escalate: ${error.message}`);
    return 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
