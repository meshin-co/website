import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'node:test';

import { botPushFindings, pushingSteps } from './bot-push-token.mjs';

const WORKFLOWS = join(import.meta.dirname, '..', '..', '.github', 'workflows');
const BOT_SECRET_EXPRESSION = 'secrets.AUTOWRITER_PAT';
const CI_PATH = '.github/workflows/ci.yml';

const realWorkflows = readdirSync(WORKFLOWS)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ path: `.github/workflows/${name}`, text: readFileSync(join(WORKFLOWS, name), 'utf8') }));

const scan = (text, path = 'x.yml') => botPushFindings([{ path, text }]);

const OLD_REGEN_BASELINES = `
jobs:
  regen-baselines:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Commit regenerated linux baselines
        run: |
          git config user.name 'baseline-bot'
          git add tests/__screenshots__/linux
          git commit -m 'test: regenerate linux baselines on the CI runner' || echo 'no changes'
          git pull --rebase origin "\${GITHUB_REF_NAME}"
          git push origin "HEAD:\${GITHUB_REF_NAME}"
`;

const DEFAULT_ENV = 'GITHUB_TOKEN: ${{ github.token }}';
const BOT_ENV = 'AUTOWRITER_PAT: ${{ secrets.AUTOWRITER_PAT }}';

const credentialedPush = ({ persist = 'persist-credentials: false', env = BOT_ENV } = {}) => `
jobs:
  repair:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ${persist}
      - name: push the commit to the pull request branch
        env:
          ${env}
          BRANCH: x
        run: |
          credential="$(printf 'x-access-token:%s' "$AUTOWRITER_PAT" | base64 | tr -d '\\n')"
          git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $credential" push origin "HEAD:refs/heads/$BRANCH"
`;

const PAT_CHECKOUT_PUSH = `
jobs:
  write:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.AUTOWRITER_PAT }}
      - run: git push origin "refs/heads/x:refs/heads/x"
`;

test('the scan reads the workflows: at least two pushing steps are found in the real ones', () => {
  const found = pushingSteps(realWorkflows).map(({ path, job }) => `${basename(path)}:${job}`);
  assert.ok(found.length >= 2, `only ${found.length} pushing steps found: ${found.join(', ')}`);
  assert.ok(found.includes('ci.yml:regen-baselines'), 'the regen-baselines push is not seen by the scan');
  assert.ok(found.includes('watch-pr.yml:repair'), 'the watcher repair push is not seen by the scan');
});

test('no step of any workflow pushes with the default token', () => {
  assert.deepEqual(botPushFindings(realWorkflows), []);
});

test('the old regen-baselines job, which pushed with the default token, is flagged by name', () => {
  const findings = scan(OLD_REGEN_BASELINES, CI_PATH);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].path, CI_PATH);
  assert.match(findings[0].detail, /job regen-baselines/);
  assert.match(findings[0].detail, /persist-credentials is not false/);
});

test('every finding carries the stable token and names the file it was found in', () => {
  const findings = botPushFindings([
    { path: '.github/workflows/a.yml', text: OLD_REGEN_BASELINES },
    { path: '.github/workflows/b.yml', text: credentialedPush() },
    { path: '.github/workflows/c.yml', text: credentialedPush({ env: DEFAULT_ENV }) },
  ]);
  assert.deepEqual(
    findings.map(({ rule, path }) => [rule, path]),
    [
      ['bot-push-token', '.github/workflows/a.yml'],
      ['bot-push-token', '.github/workflows/c.yml'],
    ]
  );
});

test('the watcher repair shape, a checkout without a credential and a push that holds the secret, passes', () => {
  assert.deepEqual(scan(credentialedPush(), '.github/workflows/watch-pr.yml'), []);
});

test('a checkout that persists the default token is flagged even when the push step holds the secret', () => {
  const findings = scan(credentialedPush({ persist: 'persist-credentials: true' }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].detail, /persist-credentials is not false/);
});

test('a checkout that names no persist-credentials at all is flagged', () => {
  assert.equal(scan(credentialedPush({ persist: 'ref: main' })).length, 1);
});

test('a push step that does not hold the secret in its own env is flagged', () => {
  const findings = scan(credentialedPush({ env: DEFAULT_ENV }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].detail, /does not hold AUTOWRITER_PAT/);
});

test('a job that pushes with no checkout at all is flagged', () => {
  const findings = scan('jobs:\n  lone:\n    steps:\n      - run: git push origin HEAD\n');
  assert.equal(findings.length, 1);
  assert.match(findings[0].detail, /no checkout/);
});

test('a checkout whose own token is the secret is a bot push, as the daily writer pushes', () => {
  assert.deepEqual(scan(PAT_CHECKOUT_PUSH, '.github/workflows/write-daily.yml'), []);
});

test('a checkout whose token is the default token is not a bot push', () => {
  const planted = PAT_CHECKOUT_PUSH.replace(BOT_SECRET_EXPRESSION, 'github.token');
  assert.equal(scan(planted).length, 1);
});

test('a step that only mentions pushing in prose is not a pushing step', () => {
  const text = 'jobs:\n  note:\n    steps:\n      - run: echo "we push nothing"\n';
  assert.deepEqual(pushingSteps([{ path: 'x.yml', text }]), []);
});

test('a file with no jobs, an empty file, a list and a job that calls another workflow hold no push and never throw', () => {
  for (const text of [
    '',
    '# nothing\n',
    'jobs:\n',
    '- a\n- b\n',
    'jobs:\n  call:\n    uses: ./.github/workflows/ci.yml\n',
  ]) {
    assert.deepEqual(scan(text), [], JSON.stringify(text));
  }
});

test('a file that is not YAML throws, so the gate can name the file it could not read', () => {
  assert.throws(() => scan('jobs: [\n'));
});
