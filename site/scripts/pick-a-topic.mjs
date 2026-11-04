import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { readBrand, titleSuffix } from '../src/utils/brand.mjs';
import { readClaims, writeClaim } from './autowriter-claim-store.mjs';
import { generatedTitles } from './autowriter-claims.mjs';
import { writeLedger } from './autowriter-ledger.mjs';
import { readDemandReport } from './demand-report.mjs';
import { callTotals } from './generation-record.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { recordDirectory, recordFiles } from './record-layout.mjs';
import { BAND_FILE } from './sentence-band.mjs';
import { CATEGORY_ROTATION, readPublishedPosts } from './topic-categories.mjs';
import { casedForms, casingTexts } from './topic-casing.mjs';
import { readPromptSources } from './topic-core.mjs';
import { buildRun } from './topic-entries.mjs';
import { readConceptRegister, routeOf } from './topic-owners.mjs';
import { proposalLines, proposeTopic, wantsProposal } from './topic-proposal.mjs';
import { selectTopic } from './topic-selection.mjs';
import { SettingsError, readTopicSettings } from './topic-settings.mjs';
import { createAdapter } from './writer-adapter.mjs';
import { explain, failureOf, keysInEnvironment } from './writer-cli.mjs';
import { readWriterConfig } from './writer-config.mjs';
import { WriterError } from './writer-error.mjs';
import { redact } from './writer-redact.mjs';

const REPORT_PATH = 'audits/search-demand.md';
const CORE_PATH = 'docs/SEMANTIC-CORE.md';
const CONFIG_PATH = 'site/src/config.yaml';
const USAGE =
  'usage: node scripts/pick-a-topic.mjs [--write --output <decision.json>] [--run-id <id>] [--now <ISO>] [--summary <path>]';
const VALUE_FLAGS = { '--output': 'output', '--run-id': 'runId', '--now': 'now', '--summary': 'summary' };
const NO_PROPOSAL = { calls: [], preview: false };

class UsageError extends Error {}
class InputError extends Error {}

export function parseArguments(argv) {
  const options = { write: false, output: null, runId: null, now: null, summary: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--write') {
      options.write = true;
    } else if (flag in VALUE_FLAGS) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} needs a value. ${USAGE}`);
      options[VALUE_FLAGS[flag]] = value;
      index += 1;
    } else {
      throw new UsageError(`unknown argument ${flag}. ${USAGE}`);
    }
  }
  if (options.write && options.output === null)
    throw new UsageError(`--write needs --output <decision.json>. ${USAGE}`);
  if (options.now !== null && Number.isNaN(Date.parse(options.now)))
    throw new UsageError(`--now must be an ISO instant, got ${options.now}. ${USAGE}`);
  return options;
}

export function runIdFor({ runId, env, now }) {
  if (runId !== null) return runId;
  if (env.GITHUB_RUN_ID && env.GITHUB_RUN_ATTEMPT) return `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
  return `local-${now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')}`;
}

function readInput(repoRoot, path, parse) {
  let text;
  try {
    text = readFileSync(join(repoRoot, path), 'utf8');
  } catch (error) {
    throw new InputError(`${path} is not readable: ${error.message}`);
  }
  try {
    return parse(text);
  } catch (error) {
    throw new InputError(`${path} could not be parsed: ${error.message}`);
  }
}

function ledgerPaths(repoRoot) {
  try {
    return recordFiles(repoRoot, 'ledger').filter((path) => basename(path) !== basename(BAND_FILE));
  } catch (error) {
    throw new InputError(`${recordDirectory('ledger')} is not readable: ${error.message}`);
  }
}

function claimsOf(repoRoot) {
  try {
    return readClaims(repoRoot);
  } catch (error) {
    throw new InputError(error.message);
  }
}

function gatherInputs({ repoRoot, settings, now, rotation }) {
  const report = readInput(repoRoot, REPORT_PATH, readDemandReport);
  const core = readInput(repoRoot, CORE_PATH, (text) => text);
  const suffix = readInput(repoRoot, CONFIG_PATH, (text) => titleSuffix(readBrand(text)));
  return {
    report,
    concepts: readConceptRegister(core),
    generated: generatedTitles(core),
    promptSources: readPromptSources(core),
    forms: casedForms(casingTexts(core)),
    claims: claimsOf(repoRoot),
    ledgerPaths: ledgerPaths(repoRoot),
    posts: readPublishedPosts(repoRoot),
    rotation,
    suffix,
    now,
    settings,
  };
}

const counted = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const advisoriesOf = (decision) => [decision.strengthen, ...decision.advisories].filter(Boolean);

function originNote({ origin, category, weakness }) {
  if (origin === 'category') return `category ${category}`;
  if (origin === 'weak-demand') return `weak-demand: ${weakness.join(', ')}`;
  return origin ?? 'no prompt';
}

function entryLine(entry) {
  const { format, topic, prompt } = entry;
  const basis = prompt ? `prompt ${prompt.number}` : originNote(entry);
  return `${format}: ${topic.title}, ${routeOf(format, topic.slug)}, ${basis}`;
}

function reportSections(decision, proposal) {
  const setAside = decision.trail.filter(({ outcome }) => outcome !== 'chosen').length;
  return {
    primary: decision.decision === 'none' ? decision.reason : decision.choice,
    entries: decision.entries.map(entryLine),
    advisories: advisoriesOf(decision).map(
      ({ route, query, impressions, position, reason }) =>
        `Strengthen: ${route}, "${query}", ${impressions} impressions at position ${position ?? 'n/a'}: ${reason}`
    ),
    named: decision.concepts.named.map(({ title, why }) => `Missing concept left unwritten (${why}): ${title}`),
    proposals: decision.proposals.map(({ query }) => `Proposal for the owner to adopt as a buyer prompt: "${query}"`),
    categories: proposalLines({ decision, ...proposal }),
    tally: `Examined ${counted(decision.trail.length, 'candidate')}, set aside ${setAside}.`,
  };
}

export function printedLines(decision, proposal = NO_PROPOSAL) {
  const { primary, entries, advisories, named, proposals, categories, tally } = reportSections(decision, proposal);
  return [primary, ...entries, ...advisories, ...named, ...proposals, ...categories, tally];
}

export function summaryMarkdown(decision, proposal = NO_PROPOSAL) {
  const { primary, entries, advisories, named, proposals, categories, tally } = reportSections(decision, proposal);
  const list = (heading, lines) =>
    lines.length === 0 ? [] : [`### ${heading}`, '', ...lines.map((line) => `- ${line}`), ''];
  return [
    '## Topic selection',
    '',
    primary,
    '',
    ...list('Claimed for writing', entries),
    ...list('Strengthen reports', advisories),
    ...list('Missing concepts left unwritten', named),
    ...list('Proposals for the owner', proposals),
    ...list('Category proposals', categories),
    tally,
    '',
  ].join('\n');
}

function decisionFile({ decision, run }) {
  if (decision.decision === 'write') return run.file;
  const outcome = decision.decision === 'none' ? { reason: decision.reason } : { choice: decision.choice };
  return { schema: 1, decision: decision.decision, ...outcome, advisories: advisoriesOf(decision) };
}

function writeDecisionFile(path, value) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  } catch (error) {
    throw new InputError(`${path} could not be written: ${error.message}`);
  }
}

function persist({ decision, run, output, repoRoot }) {
  if (decision.decision === 'write') {
    for (const { claimPath, claim } of run.claims) writeClaim(join(repoRoot, claimPath), claim);
    writeLedger(join(repoRoot, run.ledgerPath), run.ledger);
  }
  writeDecisionFile(resolve(output), decisionFile({ decision, run }));
}

function appendSummary(path, decision, proposal) {
  try {
    mkdirSync(dirname(resolve(path)), { recursive: true });
    appendFileSync(path, summaryMarkdown(decision, proposal));
  } catch (error) {
    throw new InputError(`${path} could not be appended to: ${error.message}`);
  }
}

function proposeWith({ decision, inputs, env, fetch }) {
  const { vendor } = readWriterConfig(env);
  return proposeTopic({ decision, inputs, adapter: createAdapter({ vendor, fetch }) });
}

export async function runCli(argv, io = {}) {
  const {
    repoRoot = resolve(import.meta.dirname, '..', '..'),
    env = process.env,
    stdout = console.log,
    stderr = console.error,
    fetch = globalThis.fetch,
    now = () => new Date(),
    rotation = CATEGORY_ROTATION,
    select = selectTopic,
    build = buildRun,
  } = io;
  const secrets = keysInEnvironment(env);
  const say = (write, line) => write(redact(line, secrets));
  try {
    const options = parseArguments(argv);
    const instant = options.now === null ? now() : new Date(options.now);
    const settings = readTopicSettings(env);
    const inputs = gatherInputs({ repoRoot, settings, now: instant, rotation });
    const selected = select(inputs);
    const proposed =
      options.write && wantsProposal(selected) ? await proposeWith({ decision: selected, inputs, env, fetch }) : null;
    const decision = proposed?.decision ?? selected;
    const proposal = { calls: proposed?.calls ?? [], preview: !options.write };
    for (const line of printedLines(decision, proposal)) say(stdout, line);
    if (options.write) {
      const runId = runIdFor({ runId: options.runId, env, now: instant });
      const request = { decision, report: inputs.report, runId, now: instant, reportPath: REPORT_PATH };
      const run = decision.decision === 'write' ? build(request) : null;
      persist({ decision, run, output: options.output, repoRoot });
    }
    if (options.summary !== null) appendSummary(options.summary, decision, proposal);
    return 0;
  } catch (error) {
    if (error instanceof WriterError) {
      const failure = failureOf(error, secrets);
      failure.spend ??= callTotals([]);
      for (const line of explain('pick:topic', failure, error)) say(stderr, line);
      say(stdout, JSON.stringify(failure));
      return 1;
    }
    say(stderr, `pick-a-topic: ${error.message}`);
    return error instanceof UsageError || error instanceof SettingsError ? 2 : 1;
  }
}

if (invokedDirectly(import.meta.filename, process.argv[1])) process.exitCode = await runCli(process.argv.slice(2));
