import { LedgerError, fileStemProblem, ledgerFile, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { pickPullRequestRun } from './pr-checks.mjs';
import { slugOfBranch } from './pr-classify.mjs';

const API_ORIGIN = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const REQUEST_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const PAGE_SIZE = 100;
const MERGE_HEAD_MOVED = 409;
const MERGE_REFUSED = 405;

export class GitHubError extends Error {
  constructor({ method, path, status, body }) {
    const text = typeof body === 'string' ? body : (body?.message ?? JSON.stringify(body));
    super(`GitHub ${method} ${path} answered ${status}: ${body?.message ?? text}`);
    this.method = method;
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

const parseBody = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export function createApi({ repo, token, fetch = globalThis.fetch }) {
  if (typeof token !== 'string' || token.trim() === '') throw new Error('github: no token');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'meshin-autowriter',
  };

  async function request(method, path, body) {
    const sending = body !== undefined;
    const response = await fetch(`${API_ORIGIN}/repos/${repo}/${path}`, {
      method,
      headers: sending ? { ...headers, 'Content-Type': 'application/json' } : headers,
      ...(sending ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok) throw new GitHubError({ method, path, status: response.status, body: parseBody(text) });
    return text === '' ? null : JSON.parse(text);
  }

  async function bytes(path) {
    const response = await fetch(`${API_ORIGIN}/repos/${repo}/${path}`, {
      headers,
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok)
      throw new GitHubError({ method: 'GET', path, status: response.status, body: parseBody(await response.text()) });
    return Buffer.from(await response.arrayBuffer());
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    bytes,
    repo,
  };
}

const isNotFound = (error) => error instanceof GitHubError && error.status === 404;

function parseLedger(path, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new LedgerError(path, [`is not JSON: ${error.message}`]);
  }
}

async function readLedgerFile(api, { slug, head }) {
  const path = ledgerFile(slug);
  let body;
  try {
    body = await api.get(`contents/${path}?ref=${head}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  const value = parseLedger(path, Buffer.from(body.content, 'base64').toString('utf8'));
  const problems = validateLedger(value).map(describeProblem);
  if (problems.length === 0) {
    const stem = fileStemProblem(path, value);
    if (stem !== null) problems.push(stem);
  }
  if (problems.length > 0) throw new LedgerError(path, problems);
  return { value, blobSha: body.sha, path };
}

const TRUNCATIONS = [
  ['commits', ({ commits }) => commits.length >= PAGE_SIZE],
  ['check runs', ({ checkRuns }) => checkRuns.total_count > checkRuns.check_runs.length],
  ['workflow runs', ({ runs }) => runs.total_count > runs.workflow_runs.length],
  ['jobs', ({ jobs }) => jobs.total_count > jobs.jobs.length],
];

function refuseTruncated(lists) {
  const cut = TRUNCATIONS.find(([, isCut]) => isCut(lists));
  if (cut) throw new Error(`the ${cut[0]} list is incomplete: reading more than one page is not supported`);
}

export async function readSnapshot(api, number) {
  const first = await api.get(`pulls/${number}`);
  const head = first.head.sha;
  const [commits, checkRuns, runs] = await Promise.all([
    api.get(`pulls/${number}/commits?per_page=${PAGE_SIZE}`),
    api.get(`commits/${head}/check-runs?per_page=${PAGE_SIZE}`),
    api.get(`actions/runs?head_sha=${head}&per_page=${PAGE_SIZE}`),
  ]);
  const run = pickPullRequestRun(runs);
  const jobs = run
    ? await api.get(`actions/runs/${run.id}/jobs?filter=latest&per_page=${PAGE_SIZE}`)
    : { total_count: 0, jobs: [] };
  refuseTruncated({ commits, checkRuns, runs, jobs });
  const slug = slugOfBranch(first.head.ref);
  const ledger = slug === null ? null : await readLedgerFile(api, { slug, head });
  const pullRequest = await api.get(`pulls/${number}`);
  return { pullRequest, commits, checkRuns, runs, jobs, ledger };
}

export async function mergePullRequest(api, { number, head }) {
  try {
    const body = await api.put(`pulls/${number}/merge`, { merge_method: 'squash', sha: head });
    return { merged: true, sha: body.sha };
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error;
    const message = error.body?.message ?? String(error.body);
    if (error.status === MERGE_HEAD_MOVED) return { merged: false, reason: 'head-moved', message };
    if (error.status === MERGE_REFUSED) return { merged: false, reason: 'refused', message };
    throw error;
  }
}

export async function dispatchSuccessor(api, { workflow, ref, inputs }) {
  await api.post(`actions/workflows/${workflow}/dispatches`, { ref, inputs });
}

export async function putLedger(api, { path, text, blobSha, branch, message, identity }) {
  const body = await api.put(`contents/${path}`, {
    message,
    content: Buffer.from(text).toString('base64'),
    branch,
    author: identity,
    committer: identity,
    ...(blobSha ? { sha: blobSha } : {}),
  });
  return { commit: body.commit.sha };
}

const WAIT_TIMER = 'wait_timer';

export async function tickProblem(api, { environment, minutes }) {
  const fix = `gh api -X PUT repos/${api.repo}/environments/${environment} -F wait_timer=${minutes}`;
  let found;
  try {
    found = await api.get(`environments/${encodeURIComponent(environment)}`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return `The environment ${environment} does not exist yet, so the tick has no wait timer; fix it with: ${fix}`;
  }
  const rule = found.protection_rules?.find(({ type }) => type === WAIT_TIMER);
  if (!rule) return `The environment ${environment} has no wait timer rule; fix it with: ${fix}`;
  if (rule.wait_timer < minutes) {
    return `The environment ${environment} waits ${rule.wait_timer} minutes, less than the ${minutes} the tick needs; fix it with: ${fix}`;
  }
  return null;
}

export const readLedgerAt = (api, { slug, ref }) => readLedgerFile(api, { slug, head: ref });

export async function readTree(api, sha) {
  const listing = await api.get(`git/trees/${sha}?recursive=1`);
  if (listing.truncated) throw new Error(`the tree of ${sha} is incomplete: GitHub cut the recursive listing short`);
  return listing.tree;
}
