import { randomBytes } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';

export const GATE_FINDINGS_VARIABLE = 'GATE_FINDINGS_DIR';
export const FINDINGS_SCHEMA = 1;
export const TEXT_LIMIT = 400;

const GATE_NAME = /^gate:[a-z0-9-]+$/;
const DOCUMENT_KEYS = ['schema', 'gate', 'findings'];
const FINDING_KEYS = ['rule', 'subjects', 'detail', 'excerpt'];

export class FindingsError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.name = 'FindingsError';
    this.problems = problems;
  }
}

export function findingsFileName(gate) {
  if (typeof gate !== 'string' || !GATE_NAME.test(gate))
    throw new FindingsError([`gate name ${JSON.stringify(gate)} is not gate:[a-z0-9-]+`]);
  return `${gate.replace(':', '-')}.json`;
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function keyProblems(label, object, keys) {
  return [
    ...keys.filter((key) => !(key in object)).map((key) => `${label} has no ${key}`),
    ...Object.keys(object)
      .filter((key) => !keys.includes(key))
      .map((key) => `${label} has the key ${key}, which the schema does not name`),
  ];
}

function subjectProblem(subject) {
  if (typeof subject !== 'string') return 'must be a string';
  if (subject === '') return 'must not be empty';
  if (subject !== subject.trim()) return 'must not start or end with a space';
  if (subject.includes('\\') || subject.includes('\0')) return 'must not hold a backslash or a NUL';
  if (subject.startsWith('./') || subject.split('/').includes('..'))
    return 'must be a route or a normalised repo-relative path';
  return null;
}

const textProblem = (label, name, value) =>
  typeof value === 'string' && value.length <= TEXT_LIMIT
    ? []
    : [`${label} ${name} must be a string of at most ${TEXT_LIMIT} characters`];

function findingProblems(finding, index, { exact }) {
  const label = `finding ${index}`;
  if (!isObject(finding)) return [`${label} is not an object`];

  const problems = exact ? keyProblems(label, finding, FINDING_KEYS) : [];
  if ('rule' in finding && !(typeof finding.rule === 'string' && finding.rule !== ''))
    problems.push(`${label} rule must be a non-empty string`);
  if ('subjects' in finding) {
    if (!Array.isArray(finding.subjects)) problems.push(`${label} subjects must be an array of strings`);
    else
      finding.subjects.forEach((subject, position) => {
        const problem = subjectProblem(subject);
        if (problem) problems.push(`${label} subject ${position} ${problem}`);
      });
  }
  if ('detail' in finding) problems.push(...textProblem(label, 'detail', finding.detail));
  if ('excerpt' in finding) problems.push(...textProblem(label, 'excerpt', finding.excerpt));
  return problems;
}

function truncated(value) {
  if (typeof value !== 'string' || value.length <= TEXT_LIMIT) return value;
  const cut = value.slice(0, TEXT_LIMIT);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

const optionalText = (value) => truncated(value ?? '');

function recordsFrom(findings) {
  if (!Array.isArray(findings)) throw new FindingsError(['findings must be an array']);

  const records = findings.map((finding) =>
    isObject(finding)
      ? {
          rule: finding.rule,
          subjects: finding.subjects,
          detail: optionalText(finding.detail),
          excerpt: optionalText(finding.excerpt),
        }
      : finding
  );
  const problems = records.flatMap((record, index) => findingProblems(record, index, { exact: false }));
  if (problems.length > 0) throw new FindingsError(problems);
  return records;
}

function writeAtomically(file, text) {
  const temporary = join(dirname(file), `.${basename(file)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
  try {
    writeFileSync(temporary, text, { flag: 'wx' });
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export function recordGateFindings({ gate, findings, env = process.env }) {
  const configured = env[GATE_FINDINGS_VARIABLE];
  const directory = typeof configured === 'string' ? configured.trim() : '';
  if (directory === '') return;
  if (!isAbsolute(directory))
    throw new FindingsError([`${GATE_FINDINGS_VARIABLE} must be an absolute path, not "${directory}"`]);

  const file = join(directory, findingsFileName(gate));
  const records = recordsFrom(findings);
  if (records.length === 0) {
    rmSync(file, { force: true });
    return;
  }

  mkdirSync(directory, { recursive: true });
  writeAtomically(file, `${JSON.stringify({ schema: FINDINGS_SCHEMA, gate, findings: records }, null, 2)}\n`);
}

export function parseGateFindings(text) {
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new FindingsError([`the text is not JSON: ${error.message}`]);
  }
  if (!isObject(document)) throw new FindingsError(['the document is not an object']);

  const problems = keyProblems('the document', document, DOCUMENT_KEYS);
  if ('schema' in document && document.schema !== FINDINGS_SCHEMA) problems.push(`schema must be ${FINDINGS_SCHEMA}`);
  if ('gate' in document && !(typeof document.gate === 'string' && GATE_NAME.test(document.gate)))
    problems.push('gate must match gate:[a-z0-9-]+');
  if ('findings' in document) {
    if (Array.isArray(document.findings))
      document.findings.forEach((finding, index) => problems.push(...findingProblems(finding, index, { exact: true })));
    else problems.push('findings must be an array');
  }

  if (problems.length > 0) throw new FindingsError(problems);
  return { gate: document.gate, findings: document.findings };
}
