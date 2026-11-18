import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { builtProbes, routesTheBuildLacks, waitForPreview } from './preview-wait.mjs';
import { CANONICAL, MACHINE } from './smoke-prod.mjs';

const RUN_WAIT = fileURLToPath(new URL('./run-wait-for-preview.mjs', import.meta.url));
const FAST = ['--interval-ms', '20', '--deadline-ms', '700'];

const fileOf = (route) =>
  route === '/' ? 'index.html' : MACHINE.includes(route) ? route.slice(1) : `${route.slice(1)}.html`;

function buildDist(omit = []) {
  const dist = mkdtempSync(join(tmpdir(), 'preview-wait-dist-'));
  const files = [...CANONICAL, ...MACHINE, '/terms', '/blog/a-post'].map(fileOf);
  files.push('about.md', '404.html', '_headers', '_worker.js', '_astro/site.css', 'blog/a-post.md');
  for (const file of files.filter((name) => !omit.includes(name))) {
    mkdirSync(dirname(join(dist, file)), { recursive: true });
    writeFileSync(join(dist, file), 'x');
  }
  return dist;
}

async function startPreview(answers) {
  const seen = [];
  const hits = new Map();
  const server = createServer((request, response) => {
    const path = request.url;
    const accept = request.headers.accept ?? '';
    const hit = (hits.get(path) ?? 0) + 1;
    hits.set(path, hit);
    seen.push(path);
    const status = answers({ path, hit, total: seen.length }) ? 200 : 404;
    const markdown = path === '/' && accept.includes('text/markdown') && status === 200;
    response.writeHead(status, { 'content-type': markdown ? 'text/markdown' : 'text/html' });
    response.end('x');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, seen, close: () => new Promise((resolve) => server.close(resolve)) };
}

function runWait(origin, dist, extra = FAST) {
  return new Promise((resolve) => {
    const child = spawn('node', [RUN_WAIT, origin, '--dist', dist, ...extra]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function against(t, answers, { omit, extra } = {}) {
  const preview = await startPreview(answers);
  const dist = buildDist(omit);
  t.after(async () => {
    await preview.close();
    rmSync(dist, { recursive: true, force: true });
  });
  const result = await runWait(preview.origin, dist, extra);
  return { ...result, seen: preview.seen };
}

test('a preview serving nothing fails the wait and names how much it never served', async (t) => {
  const { status, stderr } = await against(t, () => false);
  assert.equal(status, 1);
  assert.match(stderr, /DEPLOY .* still not serving \d+ of \d+ files/);
});

test('a preview serving some routes and not others fails the wait, naming the ones it does not serve', async (t) => {
  const missing = new Set(['/pricing', '/about']);
  const { status, stderr } = await against(t, ({ path }) => !missing.has(path));
  assert.equal(status, 1);
  assert.match(stderr, /\/pricing/);
  assert.match(stderr, /\/about/);
  assert.doesNotMatch(stderr, /\/terms/);
});

test('the three paths the wait once sampled serving is not enough to pass it', async (t) => {
  const sampled = new Set(['/', '/terms', '/terms.md']);
  const { status } = await against(t, ({ path }) => sampled.has(path));
  assert.equal(status, 1);
});

test('a route the smoke checks that the build never made fails at once, with no request and no retry', async (t) => {
  const { status, stderr, seen } = await against(t, () => true, { omit: ['pricing.html'] });
  assert.equal(status, 1);
  assert.match(stderr, /DEPLOY the smoke checks \/pricing, which the build does not hold/);
  assert.deepEqual(seen, []);
});

test('a file the build holds that the preview never serves fails after the deadline, rather than passing', async (t) => {
  const { status, stderr, seen } = await against(t, ({ path }) => path !== '/blog/a-post');
  assert.equal(status, 1);
  assert.match(stderr, /\/blog\/a-post/);
  assert.ok(seen.filter((path) => path === '/blog/a-post').length > 1, 'it was retried until the deadline');
});

test('a front that closes passes only once every file answers, and the wait does not pass on a partial sweep', async (t) => {
  const { status, stdout, seen } = await against(t, ({ total }) => total > 40);
  assert.equal(status, 0);
  assert.match(stdout, /served after [3-9]\d* sweeps?/);
  assert.ok(seen.length > 40);
});

test('a route that answered once and then stopped does not pass on the one clean sweep', async (t) => {
  const { status } = await against(t, ({ path, hit }) => path !== '/about' || hit === 1);
  assert.equal(status, 1);
});

test('a preview whose worker is not up fails, because the smoke asks for markdown at /', async (t) => {
  const preview = await startPreview(() => true);
  const dist = buildDist();
  t.after(async () => {
    await preview.close();
    rmSync(dist, { recursive: true, force: true });
  });
  const probes = builtProbes(dist).filter((probe) => probe.accept === undefined);
  const result = await waitForPreview({
    origin: preview.origin,
    probes: [...probes, { path: '/', accept: 'text/markdown', contentType: 'text/plain' }],
    deadlineMs: 200,
    intervalMs: 20,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.unserved.map(({ path }) => path),
    ['/']
  );
});

test('a fully served preview passes after two clean sweeps', async (t) => {
  const { status, stdout } = await against(t, () => true);
  assert.equal(status, 0);
  assert.match(stdout, /served after 2 sweeps/);
});

test('every file the build holds is probed, and the files Pages answers for itself are not', () => {
  const dist = buildDist();
  try {
    const paths = builtProbes(dist).map(({ path }) => path);
    for (const route of [
      ...CANONICAL,
      ...MACHINE,
      '/about.md',
      '/blog/a-post',
      '/blog/a-post.md',
      '/_astro/site.css',
    ]) {
      assert.ok(paths.includes(route), `${route} is probed`);
    }
    for (const control of ['/_headers', '/_worker.js', '/404', '/404.html', '/index', '/index.html']) {
      assert.ok(!paths.includes(control), `${control} is not probed`);
    }
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('the markdown negotiation the smoke asserts at / is probed with the same header', () => {
  const dist = buildDist();
  try {
    const negotiation = builtProbes(dist).filter((probe) => probe.accept === 'text/markdown');
    assert.deepEqual(negotiation, [{ path: '/', accept: 'text/markdown', contentType: 'text/markdown' }]);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('the routes the build lacks are the smoke routes absent from it, in the smoke order', () => {
  const probes = [{ path: '/' }, { path: '/about' }];
  assert.deepEqual(routesTheBuildLacks(probes, ['/', '/pricing', '/about', '/faq']), ['/pricing', '/faq']);
  assert.deepEqual(routesTheBuildLacks(probes, ['/', '/about']), []);
});

test('a preview that cannot be reached fails instead of hanging past the deadline', async () => {
  const dist = buildDist();
  try {
    const started = Date.now();
    const result = await runWait('http://127.0.0.1:1', dist, ['--interval-ms', '20', '--deadline-ms', '300']);
    assert.equal(result.status, 1);
    assert.ok(Date.now() - started < 5000);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
