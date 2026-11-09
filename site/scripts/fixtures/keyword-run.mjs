import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { engineScene } from './engine-scene.mjs';

const COMMAND = 'site/scripts/fetch-keyword-demand.mjs';
const STUB = pathToFileURL(join(import.meta.dirname, 'bing-stub.mjs')).href;
const SUFFIX = ' — example.test';

export const ENDPOINT = 'https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats';
export const KEY = 'a b/c+d-0123456789';
export const KEY_FORMS = [KEY, encodeURIComponent(KEY), new URLSearchParams({ q: KEY }).toString().slice(2)];
export const PREVIOUS = 'PREVIOUS REPORT';

export const KEYWORDS = {
  country: 'gb',
  language: 'en-GB',
  requestGapMs: 321,
  maxAgeDays: 35,
  templates: ['{title}', '{concept} policy', 'what is {concept}'],
};
export const PHRASES = ['what is shadow ai', 'what is a dpia', 'shadow ai policy', 'dpia policy', 'what is dpia'];
export const SERVED = PHRASES[0];
export const UNSERVED = PHRASES[2];

const familyTable = (rows) =>
  [
    '| Route | Query | Title | Description | H1 |',
    '| ----- | ----- | ----- | ----------- | -- |',
    ...rows.map(([route, query, title]) => `| \`${route}\` | ${query} | ${title}${SUFFIX} | d | h |`),
    '',
  ].join('\n');

export const CORE = [
  '# Core',
  '',
  '### static (1)',
  familyTable([['/', 'example query', 'Example page']]),
  '### term (2)',
  familyTable([
    ['/glossary/shadow-ai', 'shadow ai', 'What is shadow AI?'],
    ['/glossary/dpia', 'dpia', 'What is a DPIA?'],
  ]),
  '### Concept register',
  '',
  '| Concept | Defined by | Definition |',
  '| ------- | ---------- | ---------- |',
  '| Shadow AI | `/glossary/shadow-ai` | d |',
  '| DPIA | `/glossary/dpia` | d |',
  '',
].join('\n');

const stamp = (day) => `/Date(${Date.parse(`${day}T00:00:00Z`)})/`;

export const week = (day, exact, broad) => ({
  Query: 'q',
  Date: stamp(day),
  Impressions: exact,
  BroadImpressions: broad,
});

export const answer = (...weeks) => ({ status: 200, body: { d: weeks } });

export function refusal(status, body) {
  return { status, body };
}

export const THROTTLE = refusal(400, { ErrorCode: 4, Message: 'ERROR!!! ThrottleUser' });

const scenes = [];

export const discardScenes = () => scenes.splice(0).forEach((scene) => scene.remove());

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const today = () => new Date().toISOString().slice(0, 10);

function initCheckout(root) {
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 'test');
  git(root, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'init');
}

const eventsIn = (log) =>
  existsSync(log)
    ? readFileSync(log, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];

export function keywordRun({
  env = { BING_WEBMASTER_API_KEY: KEY },
  replies = {},
  core = CORE,
  previous,
  args = [],
  keywords = KEYWORDS,
  checkout = true,
} = {}) {
  const scene = engineScene({ entries: [COMMAND], mutate: (config) => ({ ...config, keywords }) });
  scenes.push(scene);
  const { root } = scene;
  const site = join(root, 'site');
  rmSync(join(site, 'node_modules'), { force: true });
  writeFileSync(join(site, 'src', 'config.yaml'), 'site:\n  name: example.test\n');
  for (const directory of ['docs', 'audits']) mkdirSync(join(root, directory), { recursive: true });
  if (core !== null) writeFileSync(join(root, 'docs', 'SEMANTIC-CORE.md'), core);
  const out = join(root, 'audits', 'keyword-demand.md');
  if (previous !== undefined) writeFileSync(out, previous);
  if (checkout) initCheckout(root);

  const log = join(root, 'events.jsonl');
  const startedOn = today();
  const result = spawnSync(process.execPath, ['--import', STUB, join(root, COMMAND), ...args], {
    cwd: site,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, STUB_LOG: log, STUB_SCRIPT: JSON.stringify({ replies }), ...env },
  });
  const events = eventsIn(log);
  return {
    result,
    root,
    out,
    events,
    requests: events.filter((event) => 'url' in event),
    waits: events.filter((event) => 'waited' in event).map(({ waited }) => waited),
    days: [startedOn, today()],
    head: checkout ? git(root, 'rev-parse', '--short', 'HEAD') : null,
  };
}

export const reportOf = ({ out }) => readFileSync(out, 'utf8');

export function assertKeyAbsent(texts) {
  for (const text of texts) {
    for (const form of KEY_FORMS) assert.equal(text.includes(form), false, `the key reached: ${text}`);
  }
}
