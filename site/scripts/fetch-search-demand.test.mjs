import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RUNNER = fileURLToPath(new URL('./fetch-search-demand.mjs', import.meta.url));
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const QUERY_URL =
  'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query';
const PROPERTY = 'sc-domain:example.com';
const CLIENT_EMAIL = 'reader@example-project.iam.gserviceaccount.com';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const KEY = JSON.stringify({ type: 'service_account', client_email: CLIENT_EMAIL, private_key: privateKey });
const ENV = { GSC_SERVICE_ACCOUNT_JSON: KEY, GSC_PROPERTY: PROPERTY };

const CORE = [
  '### The 30 buyer prompts (PRD §17.3)',
  '',
  '**1. EU AI Act obligations for deployers**',
  'Must win: `/glossary/eu-ai-act`.',
  'Why: the regulation',
  '',
  '**2. fractional CAIO pricing**',
  'Must win: `/pricing`.',
  'Why: the objection',
  '',
  '### GAP register',
].join('\n');

const reads = (keys, impressions, position) => ({
  rows: [{ keys, clicks: 0, impressions, ctr: 0, position }],
});
const HAPPY = {
  tokenUrl: TOKEN_URL,
  queryUrl: QUERY_URL,
  token: { status: 200, body: { access_token: 'stub-token' } },
  query: {
    status: 200,
    rows: {
      '': { rows: [{ clicks: 0, impressions: 5, ctr: 0, position: 4 }] },
      query: reads(['eu ai act'], 5, 4),
      page: reads(['https://example.com/glossary/eu-ai-act'], 5, 4),
      date: reads(['2026-10-20'], 5, 4),
      'query+page': reads(['eu ai act', 'https://example.com/glossary/eu-ai-act'], 5, 4),
    },
  },
};
const refused = (part, status, body) => ({ ...HAPPY, [part]: { status, body } });

const FETCH_STUB = [
  "import { appendFileSync } from 'node:fs';",
  "import net from 'node:net';",
  "net.Socket.prototype.connect = () => { throw new Error('the runner test allows no network connection'); };",
  'const script = JSON.parse(process.env.STUB_SCRIPT);',
  'globalThis.fetch = async (url, init = {}) => {',
  '  const { method, headers, body } = init;',
  "  appendFileSync(process.env.STUB_LOG, JSON.stringify({ url: String(url), method, headers, body }) + '\\n');",
  "  const reply = (status, json) => new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });",
  '  if (String(url) === script.tokenUrl) return reply(script.token.status, script.token.body);',
  '  if (String(url) !== script.queryUrl) throw new Error(`unexpected request to ${url}`);',
  '  if (script.query.status !== 200) return reply(script.query.status, script.query.body);',
  "  return reply(200, script.query.rows[JSON.parse(body).dimensions.join('+')] ?? {});",
  '};',
].join('\n');

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const sandboxes = [];
after(() => {
  for (const sandbox of sandboxes) rmSync(sandbox, { recursive: true, force: true });
});

function run({ env = ENV, script = HAPPY, previous, args = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'demand-'));
  sandboxes.push(root);
  const site = join(root, 'site');
  for (const dir of [join(site, 'src'), join(root, 'docs'), join(root, 'audits')]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(site, 'src', 'config.yaml'), 'site:\n  name: example.test\n');
  writeFileSync(join(root, 'docs', 'SEMANTIC-CORE.md'), CORE);
  const out = join(root, 'audits', 'search-demand.md');
  if (previous !== undefined) writeFileSync(out, previous);
  const stub = join(root, 'fetch-stub.mjs');
  writeFileSync(stub, FETCH_STUB);
  const log = join(root, 'requests.jsonl');
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 'test');
  git(root, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'init');

  const result = spawnSync(process.execPath, ['--import', pathToFileURL(stub).href, RUNNER, ...args], {
    cwd: site,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, STUB_LOG: log, STUB_SCRIPT: JSON.stringify(script), ...env },
  });
  const requests = existsSync(log)
    ? readFileSync(log, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  return { result, requests, out, head: git(root, 'rev-parse', '--short', 'HEAD') };
}

const reportOf = ({ out }) => readFileSync(out, 'utf8');

function assertRefused(outcome, ...patterns) {
  assertRefusedWith(1, outcome, ...patterns);
}

function assertRefusedWith(status, outcome, ...patterns) {
  assert.equal(outcome.result.status, status, outcome.result.stderr);
  for (const pattern of patterns) assert.match(outcome.result.stderr, pattern);
  assert.doesNotMatch(outcome.result.stderr + outcome.result.stdout, /PRIVATE KEY|reader@example-project/);
  assert.equal(existsSync(outcome.out), false, 'a refused run must write no report');
}

test('a run asks for a token, then reads totals, query, page, date and query by page, as the account', () => {
  const outcome = run();
  const [token, ...queries] = outcome.requests;

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.equal(token.url, TOKEN_URL);
  assert.equal(token.method, 'POST');
  assert.equal(token.headers['content-type'], 'application/x-www-form-urlencoded');
  assert.match(token.body, /^grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=[\w.-]+$/);
  assert.deepEqual(
    queries.map((request) => JSON.parse(request.body).dimensions),
    [[], ['query'], ['page'], ['date'], ['query', 'page']]
  );
  assert.ok(queries.every((request) => request.url === QUERY_URL && request.method === 'POST'));
  assert.ok(queries.every((request) => request.headers.authorization === 'Bearer stub-token'));
});

test('a run writes the report, stamped with the commit it was generated from, and says what it measured', () => {
  const outcome = run();
  const report = reportOf(outcome);

  assert.match(report, new RegExp(`^Generated-from: ${outcome.head}$`, 'm'));
  assert.match(report, /^Measured: \d{4}-\d{2}-\d{2} \(window \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}\)$/m);
  assert.match(report, /^Property: sc-domain:example\.com$/m);
  assert.match(report, /^Totals: 5 impressions, 0 clicks, CTR 0\.0%, average position 4\.0$/m);
  assert.match(
    outcome.result.stdout,
    /audit:demand: wrote .*search-demand\.md \(5 impressions; queries: 1; prompts proven: 1 of 2\)/
  );
});

test('the report holds the prompt that was proven and the one that was not', () => {
  const rows = reportOf(run())
    .split('\n')
    .filter((line) => /^\| (1|2) /.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()));

  assert.equal(rows[0][4], '5');
  assert.equal(rows[1][4], 'unproven');
});

test('the key reaches no file the run wrote and no line it printed', () => {
  const outcome = run();

  for (const text of [reportOf(outcome), outcome.result.stdout, outcome.result.stderr]) {
    assert.doesNotMatch(text, /PRIVATE KEY|reader@example-project/);
  }
});

test('a window with no impressions writes a report that says so, with zero totals', () => {
  const quiet = { ...HAPPY, query: { status: 200, rows: {} } };
  const outcome = run({ script: quiet });
  const report = reportOf(outcome);

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.match(report, /^Totals: 0 impressions, 0 clicks, CTR 0\.0%, average position n\/a$/m);
  assert.match(report, /The window holds no impressions/);
});

test('an absent key is refused before any request, naming the variable and the file, and writes no report', () => {
  const outcome = run({ env: { ...ENV, GSC_SERVICE_ACCOUNT_JSON: '' }, previous: 'PREVIOUS REPORT' });

  assert.equal(outcome.result.status, 3);
  assert.match(outcome.result.stderr, /GSC_SERVICE_ACCOUNT_JSON/);
  assert.match(outcome.result.stderr, /site\/\.env/);
  assert.match(outcome.result.stderr, /npm run audit:demand/);
  assert.deepEqual(outcome.requests, []);
  assert.equal(reportOf(outcome), 'PREVIOUS REPORT');
});

test('a key that is not JSON is refused before any request, and none of it is echoed', () => {
  const outcome = run({ env: { ...ENV, GSC_SERVICE_ACCOUNT_JSON: '{"private_key": "TOPSECRET-MARKER", broken' } });

  assertRefusedWith(3, outcome, /GSC_SERVICE_ACCOUNT_JSON/, /site\/\.env/);
  assert.doesNotMatch(outcome.result.stderr, /TOPSECRET-MARKER/);
  assert.deepEqual(outcome.requests, []);
});

test('no run stops for an absent property, because the engine configuration names it and a request is still made', () => {
  const outcome = run({ env: { GSC_SERVICE_ACCOUNT_JSON: KEY } });

  assert.ok(outcome.requests.length > 0, 'the run reached Search Console instead of refusing');
});

test('a key Google rejects stops at the token request, naming the variable and the file', () => {
  const outcome = run({
    script: refused('token', 400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }),
  });

  assertRefusedWith(3, outcome, /GSC_SERVICE_ACCOUNT_JSON/, /site\/\.env/, /Invalid JWT Signature/);
  assert.equal(outcome.requests.length, 1);
});

test('a property the account may not read is refused, naming the property, the key and the file, and keeps the old report', () => {
  const forbidden = {
    error: { message: "User does not have sufficient permission for site 'sc-domain:example.com'." },
  };
  const outcome = run({ script: refused('query', 403, forbidden), previous: 'PREVIOUS REPORT' });

  assert.equal(outcome.result.status, 3);
  assert.match(outcome.result.stderr, /the property sc-domain:example\.com/);
  assert.match(outcome.result.stderr, /GSC_SERVICE_ACCOUNT_JSON/);
  assert.match(outcome.result.stderr, /demand\.property in site\/engine\.config\.json/);
  assert.equal(reportOf(outcome), 'PREVIOUS REPORT');
});

test('a server error writes no report, and reports the status Search Console gave', () => {
  const outcome = run({ script: refused('query', 503, { error: { message: 'Backend Error' } }) });

  assertRefused(outcome, /503/, /Backend Error/);
});

test('the exit code is 3 for a missing key, 3 for a token refusal, 1 for a server error on the query and 0 on success', () => {
  const statuses = {
    missing: run({ env: { ...ENV, GSC_SERVICE_ACCOUNT_JSON: '' } }),
    refusedToken: run({ script: refused('token', 401, { error: 'invalid_client' }) }),
    serverError: run({ script: refused('query', 503, { error: { message: 'Backend Error' } }) }),
    success: run(),
  };

  assert.deepEqual(
    Object.values(statuses).map(({ result }) => result.status),
    [3, 3, 1, 0]
  );
});

test('--key-source secret names the repository secret and the workflow, never the file', () => {
  const outcome = run({ env: { ...ENV, GSC_SERVICE_ACCOUNT_JSON: '' }, args: ['--key-source', 'secret'] });

  assertRefusedWith(3, outcome, /the repository secret GSC_SERVICE_ACCOUNT_JSON/, /Write daily workflow/);
  assert.doesNotMatch(outcome.result.stderr, /site\/\.env|npm run audit:demand/);
});

test('--key-source with any other value is a usage error: exit 2, no request, no report', () => {
  for (const args of [['--key-source', 'bogus'], ['--key-source']]) {
    const outcome = run({ args });

    assertRefusedWith(2, outcome, /audit:demand: --key-source must be file or secret/);
    assert.deepEqual(outcome.requests, []);
  }
});

test('a network failure exits 1, not the credential code', () => {
  const outcome = run({ script: { ...HAPPY, queryUrl: 'https://elsewhere.example/query' } });

  assertRefusedWith(1, outcome, /unexpected request/);
});
