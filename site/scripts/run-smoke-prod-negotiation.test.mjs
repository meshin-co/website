import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { pagesPlatform } from './fixtures/edge-platform.mjs';
import { localServer } from './fixtures/local-server.mjs';
import { workspace } from './fixtures/smoke-workspace.mjs';
import worker from './markdown-negotiation.mjs';
import { ACCEPT_PROBES, PATH_SHAPES } from './smoke-prod.mjs';

const RUNNER = fileURLToPath(new URL('./run-smoke-prod.mjs', import.meta.url));
const run = promisify(execFile);
const ABOUT_THE_NEGOTIATION = /^(markdown negotiation|accept |vary \/|markdown agrees)/;
const ACCEPT_ROWS_THAT_MUST_ANSWER_THE_PAGE = ACCEPT_PROBES.filter(({ answers }) => answers === 'text/html').map(
  ({ accept }) => `accept ${accept}`
);

const edge = (request) => worker.fetch(request, { ASSETS: pagesPlatform() });

const withAccept = (request, change) =>
  new Request(request, { headers: { accept: change(request.headers.get('accept') ?? '') } });

const labelled = async (request, label) => {
  const answer = await edge(request);
  const own = answer.headers.get('content-location');
  if (own === null) return answer;
  const forged = new Response(answer.body, answer);
  forged.headers.set('content-location', label(own));
  return forged;
};

const PLANTED = [
  {
    violation: 'a quality value is read as a request',
    edge: (request) =>
      edge(withAccept(request, (accept) => (accept.includes('text/markdown') ? 'text/markdown' : accept))),
    fails: ACCEPT_ROWS_THAT_MUST_ANSWER_THE_PAGE,
  },
  {
    violation: 'no answer names Accept in Vary',
    edge: async (request) => {
      const answer = await edge(request);
      const bare = new Response(answer.body, answer);
      bare.headers.delete('vary');
      return bare;
    },
    fails: ['vary / html', 'vary / markdown'],
  },
  {
    violation: 'a markdown label names a host',
    edge: (request) => labelled(request, (label) => `/${label}`),
    fails: ['markdown agrees with html //about'],
  },
  {
    violation: 'the slash form of a page is answered with markdown',
    edge: (request) => {
      const asksMarkdown = request.headers.get('accept') === 'text/markdown';
      const bare = asksMarkdown ? request.url.replace(/(?<=[^/])\/+(\?|$)/, '$1') : request.url;
      return edge(new Request(bare, request));
    },
    fails: ['markdown agrees with html /about/'],
  },
  {
    violation: 'a route the platform redirects is answered with its markdown',
    edge: (request) => {
      const asksMarkdown = request.headers.get('accept') === 'text/markdown';
      const redirected = asksMarkdown && new URL(request.url).pathname === '/index';
      return edge(redirected ? new Request(new URL('/', request.url), request) : request);
    },
    fails: ['markdown agrees with html /index'],
  },
];

async function negotiationRows(handler) {
  const { root, site } = workspace();
  const report = join(root, 'audits/phase-9/smoke-prod.md');
  const host = await localServer(async ({ request, response }) => {
    const incoming = new Request(`http://${request.headers.host}${request.url}`, {
      headers: { accept: request.headers.accept ?? '*/*' },
    });
    const answer = await handler(incoming);
    response.writeHead(answer.status, Object.fromEntries(answer.headers));
    response.end(Buffer.from(await answer.arrayBuffer()));
  });
  try {
    await run(process.execPath, [RUNNER, host.origin, report], { cwd: site }).catch(() => undefined);
  } finally {
    await host.close();
  }
  return readFileSync(report, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| Check') && !line.startsWith('|---'))
    .map((line) => line.slice(2).split(' | '))
    .map(([check, status]) => ({ check, status }))
    .filter(({ check }) => ABOUT_THE_NEGOTIATION.test(check));
}

test('against the worker itself every negotiation row is asked and every one passes', async () => {
  const rows = await negotiationRows(edge);

  assert.equal(rows.length, 3 + ACCEPT_PROBES.length + PATH_SHAPES.length, 'one row per question the runner owes');
  assert.deepEqual(
    rows.filter(({ status }) => status !== 'pass'),
    []
  );
});

for (const { violation, edge: planted, fails } of PLANTED) {
  test(`planted: ${violation}, and exactly the rows that name it fail`, async () => {
    const rows = await negotiationRows(planted);

    const failing = rows.filter(({ status }) => status === 'fail').map(({ check }) => check);
    assert.deepEqual(failing.sort(), [...fails].sort());
  });
}
