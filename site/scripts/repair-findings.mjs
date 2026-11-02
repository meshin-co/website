import { FindingsError, findingsFileName, parseGateFindings } from './gate-findings.mjs';
import { GitHubError } from './pr-github.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { ZipError, readZip } from './repair-zip.mjs';

const PER_PAGE = 100;
const GATE_FILE = /^gate-[a-z0-9-]+\.json$/;
const NOT_JSON = 'the text is not JSON';

export const findingsArtifactName = (attempt) => `gate-findings-${attempt}`;

const baseName = (name) => name.slice(name.lastIndexOf('/') + 1);
const failed = (message) => new RepairStop('failed', message);

function reasonOf(error) {
  if (error instanceof FindingsError) {
    const problems = error.problems.filter((problem) => !problem.startsWith(NOT_JSON));
    return problems.length < error.problems.length ? 'is not JSON' : problems.join('; ');
  }
  return error.message;
}

async function findArtifact(api, { id, attempt }) {
  const name = findingsArtifactName(attempt);
  let listing;
  try {
    listing = await api.get(`actions/runs/${id}/artifacts?per_page=${PER_PAGE}`);
  } catch (error) {
    if (error instanceof GitHubError)
      throw failed(`the artifact list of run ${id} cannot be read, so ${name} is not known: ${error.message}`);
    throw error;
  }
  if (listing.total_count > listing.artifacts.length)
    throw failed(`the artifact list of run ${id} is incomplete: reading more than one page is not supported`);
  const named = listing.artifacts.filter((artifact) => artifact.name === name);
  const usable = named.find((artifact) => !artifact.expired);
  if (usable) return usable;
  const why = named.length > 0 ? 'it has expired' : 'the run has none';
  throw new RepairStop('unrepairable', `run ${id} has no usable artifact ${name}: ${why}`);
}

async function download(api, artifact) {
  try {
    return readZip(await api.bytes(`actions/artifacts/${artifact.id}/zip`));
  } catch (error) {
    if (error instanceof GitHubError || error instanceof ZipError)
      throw failed(`the artifact ${artifact.name} cannot be read: ${error.message}`);
    throw error;
  }
}

function documentOf(artifact, { name, data }) {
  const label = `${artifact.name} file ${name}`;
  let document;
  try {
    document = parseGateFindings(data.toString('utf8'));
  } catch (error) {
    if (error instanceof FindingsError) throw failed(`${label} is not a findings document: ${reasonOf(error)}`);
    throw error;
  }
  const expected = findingsFileName(document.gate);
  if (baseName(name) !== expected)
    throw failed(`${label} holds the findings of ${document.gate}, which belong in ${expected}`);
  return document;
}

export async function readFindings({ api, run }) {
  const artifact = await findArtifact(api, run);
  const documents = new Map();
  for (const file of await download(api, artifact)) {
    if (!GATE_FILE.test(baseName(file.name))) continue;
    const document = documentOf(artifact, file);
    if (documents.has(document.gate)) throw failed(`${artifact.name} holds two files for ${document.gate}`);
    documents.set(document.gate, document);
  }
  const found = [...documents.values()].filter(({ findings }) => findings.length > 0);
  if (found.length === 0)
    throw new RepairStop('unrepairable', `the artifact ${artifact.name} holds no findings to repair`);
  return found.sort((left, right) => (left.gate < right.gate ? -1 : 1));
}

const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function normalised(failures) {
  const unique = new Map(failures.map(({ rule, path }) => [JSON.stringify([rule, path]), { rule, path }]));
  return [...unique.values()].sort((a, b) => compare(a.rule, b.rule) || compare(a.path, b.path));
}

export const failuresOf = (documents) =>
  normalised(
    documents.flatMap(({ findings }) =>
      findings.flatMap(({ rule, subjects }) => subjects.map((path) => ({ rule, path })))
    )
  );

export const failureKey = (failures) => JSON.stringify(normalised(failures).map(({ rule, path }) => [rule, path]));

function recordedFailure({ failures, failingRule, failingPath }) {
  if (failures !== undefined) return failures;
  return failingRule !== null && failingPath !== null ? [{ rule: failingRule, path: failingPath }] : [];
}

export function earlierAttemptWithSameFailure({ attempts, failures }) {
  if (failures.length === 0) return null;
  const key = failureKey(failures);
  return attempts.find((attempt) => failureKey(recordedFailure(attempt)) === key) ?? null;
}

export function attemptFailure(failures) {
  if (failures.length === 0) return { failingRule: null, failingPath: null };
  return { failingRule: failures[0].rule, failingPath: failures[0].path, failures };
}
