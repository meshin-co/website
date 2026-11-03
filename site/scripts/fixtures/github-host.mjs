import { startHost } from './http-host.mjs';

export const REPOSITORY = 'meshin-co/website';

const PAGE_SIZE_LIMIT = 100;

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const answer = (res, status, body) => {
  const text = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
};

const pullOf = ({ number, head, base, title, body, repository, origin }) => ({
  number,
  state: 'open',
  title,
  body,
  html_url: `https://github.com/${repository}/pull/${number}`,
  url: `${origin}/repos/${repository}/pulls/${number}`,
  head: { ref: head, repo: { full_name: repository } },
  base: { ref: base, repo: { full_name: repository } },
  labels: [],
  draft: false,
  merged: false,
});

export async function startGitHub({ repository = REPOSITORY, openBranches = [], refuse = {} } = {}) {
  const calls = [];
  const pulls = [];
  const issues = [];
  let origin = '';

  const open = (head, extra = {}) => {
    const number = 40 + pulls.length + 1;
    const pull = pullOf({
      number,
      head,
      base: 'main',
      title: `pull for ${head}`,
      body: '',
      repository,
      origin,
      ...extra,
    });
    pulls.push(pull);
    return pull;
  };

  const respond = async (req, res) => {
    const url = new URL(req.url, 'http://fake.invalid');
    const prefix = `/repos/${repository}/`;
    const path = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : null;
    const body = await readBody(req);
    const call = {
      method: req.method,
      path,
      query: Object.fromEntries(url.searchParams),
      body,
      authorization: req.headers.authorization ?? null,
    };
    calls.push(call);
    const key = `${req.method} ${path}`;
    if (refuse[key] !== undefined) return answer(res, refuse[key], { message: `the fake refuses ${key}` });
    if (path === null) return answer(res, 404, { message: 'Not Found' });
    if (key === 'GET pulls') {
      const page = Number(call.query.page ?? 1);
      const size = Math.min(Number(call.query.per_page ?? 30), PAGE_SIZE_LIMIT);
      const listed = pulls.filter(({ state }) => state === (call.query.state ?? 'open'));
      return answer(res, 200, listed.slice((page - 1) * size, page * size));
    }
    if (key === 'POST pulls') {
      const { head, base, title, body: text } = body ?? {};
      if (typeof head !== 'string' || typeof base !== 'string' || typeof title !== 'string')
        return answer(res, 422, { message: 'Validation Failed' });
      return answer(res, 201, open(head, { base, title, body: text ?? '' }));
    }
    if (/^actions\/workflows\/[^/]+\/dispatches$/.test(path) && req.method === 'POST') return answer(res, 204);
    if (key === 'POST issues') {
      issues.push(body);
      const number = 900 + issues.length;
      return answer(res, 201, { number, html_url: `https://github.com/${repository}/issues/${number}` });
    }
    return answer(res, 404, { message: 'Not Found' });
  };

  const host = await startHost((req, res) => {
    respond(req, res).catch((error) => answer(res, 500, { message: error.message }));
  });
  origin = host.origin;
  for (const head of openBranches) open(head);

  return {
    origin,
    repository,
    calls,
    pulls,
    issues,
    created: () => calls.filter(({ method, path }) => method === 'POST' && path === 'pulls'),
    dispatched: () =>
      calls.filter(
        ({ method, path }) => method === 'POST' && /^actions\/workflows\/[^/]+\/dispatches$/.test(path ?? '')
      ),
    close: host.close,
  };
}
