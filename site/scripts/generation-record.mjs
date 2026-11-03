import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { fileStemProblem } from './autowriter-ledger.mjs';
import { describeProblem, instantProblems, isCalendarInstant, readSchema } from './autowriter-records.mjs';
import { validateJsonSchema } from './json-schema.mjs';
import { costUsd as costOf } from './writer-cost.mjs';

const RECORD_SCHEMA = readSchema('generation-record.schema.json');
const CALL_SHAPE = { $ref: '#/$defs/call' };
const REF_PREFIX = '#/$defs/';
const TOLERANCE = 1e-6;
const MICRO = 1e6;
const MAX_SHOWN = 5;

const problem = (path, message) => ({ path, problem: message });
const shown = (value) => JSON.stringify(value);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const roundUsd = (value) => Math.round(value * MICRO) / MICRO;
const differs = (left, right) => Math.abs(left - right) > TOLERANCE;
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function conform(schema, value) {
  const shape = Object.hasOwn(schema, '$ref') ? RECORD_SCHEMA.$defs[schema.$ref.slice(REF_PREFIX.length)] : schema;
  if (Array.isArray(value) && shape.items) return value.map((item) => conform(shape.items, item));
  if (isObject(value) && shape.properties) {
    return Object.fromEntries(
      Object.entries(shape.properties)
        .filter(([key]) => Object.hasOwn(value, key))
        .map(([key, child]) => [key, conform(child, value[key])])
    );
  }
  return structuredClone(value);
}

export const callRecord = ({ role, adapter, result }) =>
  conform(CALL_SHAPE, {
    role,
    vendor: adapter.id,
    modelVariable: adapter.modelVariable,
    configuredModel: adapter.model,
    resolvedModel: result.resolvedModel,
    responseId: result.responseId,
    requestDigest: result.requestDigest,
    tokens: result.usage,
    costUsd: result.costUsd,
    price: result.price,
    stopReason: result.stopReason,
  });

const totalOf = (parts) => ({
  tokens: {
    input: sum(parts.map((part) => part.tokens.input)),
    output: sum(parts.map((part) => part.tokens.output)),
  },
  costUsd: roundUsd(sum(parts.map((part) => part.costUsd))),
});

export const callTotals = (calls) => totalOf(calls);

export const entryCost = ({ calls }) => callTotals(calls);

export function ledgerWithGeneration(ledger, { tokens, costUsd }) {
  const generation = { tokens: { input: tokens.input, output: tokens.output }, costUsd };
  return { ...ledger, generation, spend: totalOf([generation, ...ledger.attempts]) };
}

export function buildRecord(input) {
  const { claim, decision, calls, published } = input;
  const call = calls[published.callIndex];
  return conform(RECORD_SCHEMA, {
    schema: 1,
    slug: claim.slug,
    runId: claim.runId,
    generatedAt: input.generatedAt,
    claim,
    demand: { ...claim.demand, report: decision.report, row: decision.row },
    entry: { format: input.format, route: input.route, path: input.entryPath },
    provider: call?.vendor,
    model: call?.resolvedModel,
    responseId: call?.responseId,
    published,
    calls,
    totals: callTotals(calls),
    ledger: input.ledger,
    modelChecks: input.modelChecks,
    prompt: input.prompt,
    tree: input.tree,
    claimTable: input.claimTable,
    band: input.band,
    files: [...input.files].sort(),
    gates: input.gates,
  });
}

const dateEntries = ({ band, demand, modelChecks }) => [
  ['$.band.measuredOn', band.measuredOn],
  ['$.demand.report.measured', demand.report.measured],
  ['$.demand.report.windowStart', demand.report.windowStart],
  ['$.demand.report.windowEnd', demand.report.windowEnd],
  ...modelChecks.map((check, index) => [`$.modelChecks[${index}].shutdownDate`, check.shutdownDate]),
];

const dateProblems = (entries) =>
  entries
    .filter(([, value]) => value !== null && !isCalendarInstant(`${value}T00:00:00Z`))
    .map(([path, value]) => problem(path, `must be a real calendar date, got ${shown(value)}`));

function totalsProblems({ calls, totals }) {
  const added = callTotals(calls);
  return [
    ['$.totals.tokens.input', totals.tokens.input, added.tokens.input],
    ['$.totals.tokens.output', totals.tokens.output, added.tokens.output],
    ['$.totals.costUsd', totals.costUsd, added.costUsd],
  ]
    .filter(([, recorded, summed]) => differs(recorded, summed))
    .map(([path, recorded, summed]) => problem(path, `is ${recorded} but its calls add up to ${summed}`));
}

function costProblems({ calls }) {
  return calls.flatMap(({ tokens, price, costUsd }, index) => {
    const owed = costOf(price, tokens);
    const text = `is ${costUsd} but its ${tokens.input} input and ${tokens.output} output tokens at its price come to ${owed}`;
    return differs(costUsd, owed) ? [problem(`$.calls[${index}].costUsd`, text)] : [];
  });
}

function publishedProblems({ published, calls, provider, model, responseId }) {
  const { callIndex } = published;
  const call = calls[callIndex];
  if (call === undefined)
    return [problem('$.published.callIndex', `points at call ${callIndex} but the record has ${calls.length} calls`)];
  return [
    ['provider', provider, call.vendor],
    ['model', model, call.resolvedModel],
    ['responseId', responseId, call.responseId],
  ]
    .filter(([, recorded, expected]) => recorded !== expected)
    .map(([key, recorded, expected]) =>
      problem(`$.${key}`, `is ${shown(recorded)} but call ${callIndex} says ${shown(expected)}`)
    );
}

function noteProblems({ modelChecks }) {
  return modelChecks.flatMap(({ modelVariable, model, shutdownDate, note }, index) => {
    const at = `$.modelChecks[${index}].note`;
    if (shutdownDate === null) return [];
    if (note === null)
      return [problem(at, `must be the digest sentence naming ${modelVariable}, ${model} and ${shutdownDate}`)];
    return [modelVariable, model, shutdownDate]
      .filter((part) => !note.includes(part))
      .map((part) => problem(at, `must name ${part}`));
  });
}

const listedProblems = ({ entry, files }) =>
  files.includes(entry.path) ? [] : [problem('$.files', `must list the entry ${entry.path}`)];

const bandProblems = ({ entry, band: { limits, measured } }) =>
  [
    ['$.band.limits.format', limits.format, entry.format, 'the entry format'],
    ['$.band.measured.format', measured.format, entry.format, 'the entry format'],
    ['$.band.measured.threshold', measured.threshold, limits.threshold, 'band.limits.threshold'],
  ]
    .filter(([, found, wanted]) => found !== wanted)
    .map(([path, found, wanted, name]) => problem(path, `is ${shown(found)} but ${name} is ${shown(wanted)}`));

export function validateRecord(record) {
  const shape = validateJsonSchema(RECORD_SCHEMA, record);
  if (shape.length > 0) return shape;
  const calendar = [...instantProblems([['$.generatedAt', record.generatedAt]]), ...dateProblems(dateEntries(record))];
  if (calendar.length > 0) return calendar;
  return [
    ...totalsProblems(record),
    ...costProblems(record),
    ...publishedProblems(record),
    ...noteProblems(record),
    ...listedProblems(record),
    ...bandProblems(record),
  ];
}

export class RecordError extends Error {
  constructor(path, problems) {
    const listed = problems.slice(0, MAX_SHOWN).join('; ');
    const more = problems.length > MAX_SHOWN ? ` (and ${problems.length - MAX_SHOWN} more)` : '';
    super(`${path} does not match the generation record schema: ${listed}${more}`);
    this.problems = problems;
  }
}

function refusals(path, record) {
  const shape = validateRecord(record).map(describeProblem);
  if (shape.length > 0) return shape;
  return [fileStemProblem(path, record)].filter(Boolean);
}

export function readRecord(path) {
  let record;
  try {
    record = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path} is not readable JSON: ${error.message}`, { cause: error });
  }
  const problems = refusals(path, record);
  if (problems.length > 0) throw new RecordError(path, problems);
  return record;
}

export function writeRecord(path, record) {
  const problems = refusals(path, record);
  if (problems.length > 0) throw new RecordError(path, problems);
  mkdirSync(dirname(path), { recursive: true });
  const staged = `${path}.${process.pid}.tmp`;
  writeFileSync(staged, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(staged, path);
}

export const WRITING_ROLES = ['draft', 'correction'];

export const REPAIR_ROLES = ['repair', 'repair-correction'];

export const writingTotals = ({ calls }) => callTotals(calls.filter(({ role }) => WRITING_ROLES.includes(role)));

export function recordAfterRepair({ record, calls, modelChecks, claimTable, measured, measuredOn, gates }) {
  if (calls.length === 0) throw new Error('a repair of a record needs at least one call');
  const wrong = calls.find(({ role }) => !REPAIR_ROLES.includes(role));
  if (wrong) throw new Error(`a repair call has one of the repair roles ${REPAIR_ROLES.join(', ')}, not ${wrong.role}`);
  const all = [...record.calls, ...calls];
  const published = calls[calls.length - 1];
  return conform(RECORD_SCHEMA, {
    ...record,
    provider: published.vendor,
    model: published.resolvedModel,
    responseId: published.responseId,
    published: { callIndex: all.length - 1 },
    calls: all,
    totals: callTotals(all),
    modelChecks: [...record.modelChecks, ...modelChecks],
    claimTable,
    band: { ...record.band, measuredOn, measured },
    gates,
  });
}
