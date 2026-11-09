import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { pathToFileURL } from 'node:url';

const STUB = pathToFileURL(join(import.meta.dirname, 'bing-stub.mjs')).href;
const ENDPOINT = 'https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats';

const scenes = [];
after(() => scenes.forEach((scene) => rmSync(scene, { recursive: true, force: true })));

function runProbe(probe, script = {}) {
  const scene = mkdtempSync(join(tmpdir(), 'bing-stub-'));
  scenes.push(scene);
  const log = join(scene, 'log.jsonl');
  writeFileSync(log, '');
  const result = spawnSync(process.execPath, ['--import', STUB, '--input-type=module', '-e', probe], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, STUB_LOG: log, STUB_SCRIPT: JSON.stringify(script) },
  });
  const events = readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { result, events };
}

const asking = (...phrases) =>
  [
    'const answers = [];',
    `for (const phrase of ${JSON.stringify(phrases)}) {`,
    `  const response = await fetch('${ENDPOINT}?q=' + encodeURIComponent(phrase));`,
    '  answers.push([response.status, await response.json()]);',
    '}',
    'console.log(JSON.stringify(answers));',
  ].join('\n');

test('a phrase is answered from its queue in order, the last reply repeats, and an unscripted phrase holds no data', () => {
  const script = {
    replies: {
      'shadow ai': [
        { status: 400, body: { Message: 'ERROR!!! ThrottleUser' } },
        { status: 200, body: { d: [{ Impressions: 4 }] } },
      ],
    },
  };
  const { result } = runProbe(asking('shadow ai', 'shadow ai', 'shadow ai', 'dpia'), script);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    [400, { Message: 'ERROR!!! ThrottleUser' }],
    [200, { d: [{ Impressions: 4 }] }],
    [200, { d: [{ Impressions: 4 }] }],
    [200, { d: [] }],
  ]);
});

test('each request is logged with its address, its decoded phrase and whether it carried a timeout, in the order it was made', () => {
  const probe = [
    `await fetch('${ENDPOINT}?q=what%20is%20a%20dpia');`,
    `await fetch('${ENDPOINT}?q=shadow%20ai', { signal: AbortSignal.timeout(1000) });`,
  ].join('\n');
  const { events } = runProbe(probe);

  assert.deepEqual(events, [
    { url: `${ENDPOINT}?q=what%20is%20a%20dpia`, phrase: 'what is a dpia', signalled: false },
    { url: `${ENDPOINT}?q=shadow%20ai`, phrase: 'shadow ai', signalled: true },
  ]);
});

test('a reply that names a failure makes the request throw a TypeError carrying that text', () => {
  const script = { replies: { dpia: [{ failure: 'getaddrinfo failed for ssl.bing.com' }] } };
  const probe = [
    'try {',
    `  await fetch('${ENDPOINT}?q=dpia');`,
    '} catch (error) {',
    "  console.log(error.name + ': ' + error.message);",
    '}',
  ].join('\n');
  const { result } = runProbe(probe, script);

  assert.equal(result.stdout.trim(), 'TypeError: getaddrinfo failed for ssl.bing.com');
});

test('a timer fires at once and logs the delay it was asked for, so a run that waits minutes takes no time', () => {
  const probe = [
    'const started = Date.now();',
    'await new Promise((resolve) => setTimeout(resolve, 700));',
    'await new Promise((resolve) => setTimeout(resolve, 5000));',
    'console.log(Date.now() - started < 500);',
  ].join('\n');
  const { result, events } = runProbe(probe);

  assert.equal(result.stdout.trim(), 'true');
  assert.deepEqual(events, [{ waited: 700 }, { waited: 5000 }]);
});

test('no socket can connect, so a request that escapes the stub fails instead of reaching a server', () => {
  const probe = [
    "import net from 'node:net';",
    'try {',
    "  net.connect(80, '127.0.0.1');",
    '} catch (error) {',
    '  console.log(error.message);',
    '}',
  ].join('\n');
  const { result } = runProbe(probe);

  assert.equal(result.stdout.trim(), 'the runner test allows no network connection');
});
