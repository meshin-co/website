import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ESCALATION_KINDS, newLedger, readLedger, requiredChannels, writeLedger } from './autowriter-ledger.mjs';
import { variable } from './escalate-channels.mjs';
import { EscalationError, describeReceipt, escalate, wasPlainText } from './escalate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

const LOCAL_RUN_ID = 'local';
const SETTLED_VERDICTS = ['escalated', 'merged'];
const FLAGS = ['ledger-dir', 'slug', 'kind', 'title', 'detail'];

const USAGE = `Usage:
  node scripts/escalate-run.mjs --ledger-dir <dir> --slug <slug> --kind <kind> --title <text> --detail <text>
Kinds: ${ESCALATION_KINDS.join(', ')}`;

class UsageError extends Error {}

function openLedger({ ledgerPath, slug, env }) {
  if (existsSync(ledgerPath)) return;
  const runId = variable(env, 'GITHUB_RUN_ID') || LOCAL_RUN_ID;
  writeLedger(ledgerPath, newLedger({ slug, runId, pullRequest: null }));
}

function recordEscalatedVerdict({ ledgerPath, title, now }) {
  const ledger = readLedger(ledgerPath);
  if (SETTLED_VERDICTS.includes(ledger.verdict.state)) return;
  ledger.verdict = { state: 'escalated', reason: title, decidedAt: now().toISOString() };
  writeLedger(ledgerPath, ledger);
}

export async function raiseOnRun({
  ledgerDir,
  slug,
  kind,
  title,
  detail,
  env = process.env,
  fetch = globalThis.fetch,
  now = () => new Date(),
}) {
  const ledgerPath = join(ledgerDir, `${slug}.json`);
  openLedger({ ledgerPath, slug, env });
  let outcome;
  try {
    outcome = await escalate({ ledgerPath, kind, title, detail, env, fetch, now });
  } catch (error) {
    if (error instanceof EscalationError) recordEscalatedVerdict({ ledgerPath, title, now });
    throw error;
  }
  recordEscalatedVerdict({ ledgerPath, title, now });
  return outcome;
}

function parseArguments(argv) {
  const options = {};
  for (let at = 0; at < argv.length; at += 2) {
    const name = argv[at].startsWith('--') ? argv[at].slice(2) : null;
    if (!FLAGS.includes(name)) throw new UsageError(`unknown flag ${argv[at]}`);
    if (argv[at + 1] === undefined) throw new UsageError(`${argv[at]} needs a value`);
    options[name] = argv[at + 1];
  }
  const blank = FLAGS.filter((name) => (options[name] ?? '').trim() === '');
  if (blank.length > 0) throw new UsageError(`missing or blank: ${blank.map((name) => `--${name}`).join(', ')}`);
  if (!ESCALATION_KINDS.includes(options.kind)) throw new UsageError(`unknown kind ${options.kind}`);
  return options;
}

const latestReceipts = (escalation) =>
  requiredChannels(escalation.kind).map((channel) =>
    escalation.receipts.findLast((receipt) => receipt.channel === channel)
  );

export async function runCli(argv, io = {}) {
  const { env = process.env, fetch = globalThis.fetch, now = () => new Date() } = io;
  const { stdout = console.log, stderr = console.error } = io;
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    stderr(`escalate-run: ${error.message}\n${USAGE}`);
    return 2;
  }
  const show = (escalation) =>
    latestReceipts(escalation).forEach((receipt) => {
      const line = describeReceipt(escalation, receipt);
      if (wasPlainText(receipt)) stderr(`::warning::${line}`);
      else stdout(line);
    });
  try {
    const { 'ledger-dir': ledgerDir, slug, kind, title, detail } = options;
    show(await raiseOnRun({ ledgerDir, slug, kind, title, detail, env, fetch, now }));
    return 0;
  } catch (error) {
    if (error instanceof EscalationError) show(error.escalation);
    else stderr(`escalate-run: ${error.message}`);
    return 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
