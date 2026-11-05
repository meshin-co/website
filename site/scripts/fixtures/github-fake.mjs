import { createApi, readSnapshot } from '../pr-github.mjs';
import { newLedger } from '../autowriter-ledger.mjs';
import { autowriterBranch } from './pr-watch.mjs';
import { filedAt } from './record-depths.mjs';

export const REPO = 'meshin-co/website';
export const ROOT = `https://api.github.com/repos/${REPO}/`;
export const HEAD = 'f'.repeat(40);
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

export function apiAnswering(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    const call = { url, path: url.slice(ROOT.length), ...init };
    calls.push(call);
    return respond(call);
  };
  return { calls, api: createApi({ repo: REPO, token: 'secret', fetch }) };
}

export const ledgerBody = (ledger, sha = 'blob-1') =>
  json({
    content: Buffer.from(JSON.stringify(ledger)).toString('base64').replace(/.{60}/g, '$&\n'),
    sha,
    encoding: 'base64',
  });

export const notFound = () => json({ message: 'Not Found' }, 404);

const filed = filedAt('2026-11-01T00:00:00.000Z');
export const LEDGER_PATH = filed.month('ledger', 'a-slug');
export const LEDGER_FILINGS = {
  'in its month': LEDGER_PATH,
  flat: filed.flat('ledger', 'a-slug'),
  'below its month': filed.deeper('ledger', 'a-slug'),
};
export const NOT_THE_LEDGER = [
  filed.month('ledger', 'another-slug'),
  filed.month('claim', 'a-slug'),
  filed.month('generation', 'a-slug'),
  'site/src/data/post/a-slug.md',
];

export const ledgerAt = (found, ledger, sha = 'blob-9') => {
  const asked = `contents/${found}?`;
  return (requested) => (requested.startsWith(asked) ? ledgerBody(ledger, sha) : notFound());
};

const blobEntry = (path) => ({ path, mode: '100644', type: 'blob', sha: 'b'.repeat(40) });

export const treeListing = (paths, patch = {}) =>
  json({ sha: 'c'.repeat(40), tree: paths.map(blobEntry), truncated: false, ...patch });

export const withTree =
  (paths, contents = notFound) =>
  (call) =>
    call.path.startsWith('git/trees/') ? treeListing(paths) : contents(call.path);

const NO_DRIFT = { ahead_by: 0, behind_by: 0, files: [] };

export function serving(
  bundle,
  { second = bundle.pullRequest, ledger = notFound, tree = [], compare = NO_DRIFT } = {}
) {
  let pullReads = 0;
  return ({ path }) => {
    if (path === `pulls/${bundle.pullRequest.number}`) {
      pullReads += 1;
      return json(pullReads === 1 ? bundle.pullRequest : second);
    }
    if (path.includes('/commits?')) return json(bundle.commits);
    if (path.includes('/check-runs?')) return json(bundle.checkRuns);
    if (path.startsWith('actions/runs?')) return json(bundle.runs);
    if (/^actions\/runs\/\d+\/jobs\?/.test(path)) return json(bundle.jobs);
    if (path.startsWith('git/trees/')) return typeof tree === 'function' ? tree(path) : treeListing(tree);
    if (path.startsWith('compare/')) return json(compare);
    if (path.startsWith('contents/')) return ledger(path);
    throw new Error(`unexpected request ${path}`);
  };
}

export async function snapshotOf(bundle, options) {
  const { api, calls } = apiAnswering(serving(bundle, options));
  const snapshot = await readSnapshot(api, bundle.pullRequest.number);
  return { snapshot, calls, paths: calls.map(({ path }) => path) };
}

export const own = (bundle) => autowriterBranch(bundle, 'a-slug');
export const aLedger = (slug = 'a-slug') => newLedger({ slug, runId: '41360101540', pullRequest: 72 });
