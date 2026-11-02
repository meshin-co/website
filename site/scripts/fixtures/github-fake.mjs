import { createApi, readSnapshot } from '../pr-github.mjs';
import { newLedger } from '../autowriter-ledger.mjs';
import { autowriterBranch } from './pr-watch.mjs';

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

export function serving(bundle, { second = bundle.pullRequest, ledger = notFound } = {}) {
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
