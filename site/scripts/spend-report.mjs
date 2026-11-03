import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { postSlackText } from './escalate-channels.mjs';
import { describeDelivery, receiptOf, redactorFor } from './escalate.mjs';
import { provenanceOf } from './evidence-gate.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { familyOf, recordFiles } from './record-layout.mjs';
import { generatorRevision } from './report.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { REPORT_PATH, countText, reportText, slackMessage } from './spend-report-text.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const FLAGS = { write: ['repo-root'], notify: ['repo-root', 'result'] };
const USAGE = [
  'Usage: node scripts/spend-report.mjs [write] [--repo-root <dir>]',
  '       node scripts/spend-report.mjs notify --result <file the write step wrote> [--repo-root <dir>]',
].join('\n');

class UsageError extends Error {}

const readIfPresent = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

const textFiles = (repoRoot, family) =>
  recordFiles(repoRoot, family).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));

export const corpusFiles = (repoRoot) => ({
  ledgers: textFiles(repoRoot, 'ledger'),
  records: textFiles(repoRoot, 'generation'),
});

const FOLDERS = { ledger: 'ledgers', generation: 'records' };

function overlaid(corpus, written) {
  const files = { ledgers: [...corpus.ledgers], records: [...corpus.records] };
  for (const file of written) {
    const folder = FOLDERS[familyOf(file.path)];
    if (folder !== undefined) files[folder] = [...files[folder].filter(({ path }) => path !== file.path), file];
  }
  return files;
}

export function spendReportFile({ repoRoot, written = [], revision }) {
  const files = overlaid(corpusFiles(repoRoot), written);
  const current = readIfPresent(join(repoRoot, REPORT_PATH));
  const kept = current === null ? undefined : provenanceOf(current);
  const unchanged = kept !== undefined && reportText(files, kept) === current;
  return {
    path: REPORT_PATH,
    text: unchanged ? current : reportText(files, revision),
    model: reportModel(corpusOf(files)),
  };
}

function summaryOf({ empty, rows, warnings, notes }) {
  const counted = countText(warnings.length, 'warning', 'warnings');
  const settled = notes.length === 0 ? '' : `, ${countText(notes.length, 'note', 'notes')}`;
  if (!empty) return `${countText(rows.length, 'entry', 'entries')}, ${counted}${settled}`;
  return warnings.length === 0 && notes.length === 0
    ? 'no entry generated yet'
    : `no entry counted, ${counted}${settled}`;
}

function writeReport({ repoRoot, revisionOf, stdout, stderr }) {
  const { path, text, model } = spendReportFile({ repoRoot, revision: revisionOf({ repoRoot }) });
  const target = join(repoRoot, path);
  const unchanged = readIfPresent(target) === text;
  if (!unchanged) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  model.warnings.forEach((warning) => stderr(`spend report: warning: ${warning}`));
  const summary = summaryOf(model);
  stdout(
    unchanged ? `spend report: ${path} is already current (${summary})` : `spend report: wrote ${path} (${summary})`
  );
  return 0;
}

const readResult = (resultFile) => {
  try {
    return JSON.parse(readFileSync(resultFile, 'utf8'));
  } catch {
    return null;
  }
};

function slugsWritten(resultFile) {
  const result = readResult(resultFile);
  const slugs = Array.isArray(result?.entries) ? result.entries.map((entry) => entry?.slug) : null;
  if (result?.ok !== true || slugs === null || !slugs.every((slug) => typeof slug === 'string'))
    throw new UsageError(
      `${resultFile} is not the result of a successful write: it must be JSON with "ok": true and an "entries" list`
    );
  return slugs;
}

async function notify({ repoRoot, resultFile, env, fetch, now, stdout, stderr }) {
  const slugs = slugsWritten(resultFile);
  if (slugs.length === 0) {
    stdout('spend report: the write produced no entry, so no message was posted');
    return 0;
  }
  const model = reportModel(corpusOf(corpusFiles(repoRoot)));
  const rows = slugs.map((slug) => model.rows.find((row) => row.slug === slug));
  const missing = slugs.filter((_, at) => rows[at] === undefined);
  if (missing.length > 0) {
    stderr(`spend report: no generation record holds ${missing.join(', ')}, so no message was posted`);
    return 1;
  }
  const clean = redactorFor(env);
  const outcome = await postSlackText({ env, fetch, clean, text: slackMessage(model, rows) });
  const receipt = receiptOf('slack', now().toISOString(), outcome, clean);
  const line = describeDelivery('spend report: slack', receipt);
  if (!receipt.delivered) {
    stderr(line);
    return 1;
  }
  stdout(line);
  return 0;
}

function parseArguments(argv) {
  const [first, ...rest] = argv;
  const named = first !== undefined && !first.startsWith('--');
  const command = named ? first : 'write';
  if (!Object.hasOwn(FLAGS, command)) throw new UsageError(`unknown command ${command}`);
  const pairs = named ? rest : argv;
  const options = {};
  for (let at = 0; at < pairs.length; at += 2) {
    const name = pairs[at].startsWith('--') ? pairs[at].slice(2) : null;
    if (!FLAGS[command].includes(name)) throw new UsageError(`unknown argument ${pairs[at]}`);
    if (pairs[at + 1] === undefined) throw new UsageError(`${pairs[at]} needs a value`);
    options[name] = pairs[at + 1];
  }
  if (command === 'notify' && options.result === undefined)
    throw new UsageError('notify needs --result <file the write step wrote>');
  return { command, options };
}

const defaultRevision = ({ repoRoot }) => generatorRevision(REPORT_PATH, { cwd: repoRoot });

export async function runCli(argv, io = {}) {
  const { env = process.env, fetch = globalThis.fetch, now = () => new Date() } = io;
  const { stdout = console.log, stderr = console.error, revisionOf = defaultRevision } = io;
  try {
    const { command, options } = parseArguments(argv);
    const repoRoot = options['repo-root'] === undefined ? REPOSITORY_ROOT : resolve(options['repo-root']);
    if (command === 'write') return writeReport({ repoRoot, revisionOf, stdout, stderr });
    return await notify({ repoRoot, resultFile: resolve(options.result), env, fetch, now, stdout, stderr });
  } catch (error) {
    if (!(error instanceof UsageError)) {
      stderr(`spend report: ${error.message}`);
      return 1;
    }
    stderr(`spend report: ${error.message}\n${USAGE}`);
    return 2;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
