import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const gate = new URL('run-paid-gate.mjs', import.meta.url).pathname;
const site = new URL('..', import.meta.url).pathname;

async function distWith(pages) {
  const root = await mkdtemp(join(tmpdir(), 'paid-gate-'));
  const dist = join(root, 'dist');
  for (const [route, html] of Object.entries(pages)) {
    const file = join(dist, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, `<!doctype html><html><body>${html}</body></html>`);
  }
  return dist;
}

async function gateOn(dist) {
  try {
    const { stdout } = await run('node', [gate, dist], { cwd: site });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.code, out: `${error.stdout}${error.stderr}` };
  }
}

test('a build loading nothing third party passes', async () => {
  const dist = await distWith({ '/': '<p>plain</p>', '/privacy': '<p>no analytics runs at all</p>' });

  const { code, out } = await gateOn(dist);

  assert.equal(code, 0);
  assert.match(out, /2 routes/);
  assert.match(out, /0 findings/);
});

test('an undeclared origin fails the gate', async () => {
  const dist = await distWith({ '/': '<script src="https://widget.unknown-vendor.example/w.js"></script>' });

  const { code, out } = await gateOn(dist);

  assert.equal(code, 1);
  assert.match(out, /PAID \/ loads https:\/\/widget\.unknown-vendor\.example/);
});

test('copy claiming analytics the build does not ship fails the gate', async () => {
  const dist = await distWith({ '/privacy': '<p>Page views are counted by Cloudflare Web Analytics.</p>' });

  const { code, out } = await gateOn(dist);

  assert.equal(code, 1);
  assert.match(out, /PAID \/privacy .*loads no beacon/);
});

test('copy denying analytics while the beacon ships fails the gate', async () => {
  const dist = await distWith({
    '/': '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>',
    '/privacy': '<p>no analytics runs at all</p>',
  });

  const { code, out } = await gateOn(dist);

  assert.equal(code, 1);
  assert.match(out, /PAID \/privacy denies analytics/);
});
