import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after as afterAll, test } from 'node:test';

import { INTERVIEW_PATH, interviewFindings, readInterviewInputs } from './interview-coverage.mjs';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const roots = [];
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const WORKFLOW = [
  'jobs:',
  '  write:',
  '    steps:',
  '      - id: secrets',
  '        run: echo "ready=true" >> "$GITHUB_OUTPUT"',
  '      - env:',
  '          AUTOWRITER_PAT: ${{ secrets.AUTOWRITER_PAT }}',
  '          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
  "          WRITING_TERM_CAP: ${{ vars.WRITING_TERM_CAP || '1' }}",
  '          READY: ${{ steps.secrets.outputs.ready }}',
].join('\n');
const ENV_EXAMPLE = '# Local values.\nGSC_PROPERTY=sc-domain:example.org\n';
const NAMES = ['loop.attemptCap', 'demand.property', 'AUTOWRITER_PAT', 'WRITING_TERM_CAP', 'GSC_PROPERTY'];

const bankNaming = (names) => names.map((name) => `Ask for \`${name}\`.`).join('\n');
const tree = (overrides = {}) => ({
  configPaths: ['loop.attemptCap', 'demand.property'],
  workflows: [WORKFLOW],
  envExample: ENV_EXAMPLE,
  bank: bankNaming(NAMES),
  ...overrides,
});
const bankWithout = (name, extra = '') => `${bankNaming(NAMES.filter((other) => other !== name))}\n${extra}`;
const gapsOf = (found) => found.map(({ rule, where, detail }) => [rule, where, detail.split(';')[0]]);
const bare = (overrides) => ({ configPaths: [], workflows: [], envExample: '', bank: '', ...overrides });

test('a tree whose interview names every value, secret and variable has no finding', () => {
  assert.deepEqual(interviewFindings(tree()), []);
});

test('a config path the interview does not name is one finding that names it', () => {
  const found = interviewFindings(tree({ bank: bankWithout('demand.property') }));
  assert.deepEqual(gapsOf(found), [['interview-gap', 'demand.property', 'config value']]);
});

test('a secret a workflow reads and the interview does not name is one finding that names it', () => {
  const found = interviewFindings(tree({ bank: bankWithout('AUTOWRITER_PAT') }));
  assert.deepEqual(gapsOf(found), [['interview-gap', 'AUTOWRITER_PAT', 'workflow secret']]);
});

test('a variable a workflow reads and the interview does not name is one finding that names it', () => {
  const found = interviewFindings(tree({ bank: bankWithout('WRITING_TERM_CAP') }));
  assert.deepEqual(gapsOf(found), [['interview-gap', 'WRITING_TERM_CAP', 'workflow variable']]);
});

test('a variable only the env example names, missing from the interview, is one finding that names it', () => {
  const found = interviewFindings(tree({ bank: bankWithout('GSC_PROPERTY') }));
  assert.deepEqual(gapsOf(found), [['interview-gap', 'GSC_PROPERTY', 'env example variable']]);
});

test('a finding has the shape every engine finding has and says what is missing from which file', () => {
  const [found] = interviewFindings(tree({ bank: bankWithout('AUTOWRITER_PAT') }));
  assert.deepEqual(Object.keys(found), ['rule', 'where', 'detail']);
  assert.equal(
    found.detail,
    `workflow secret; no question in ${INTERVIEW_PATH} names it, so the owner is never asked for it`
  );
});

test('GITHUB_TOKEN read by a workflow never counts, because GitHub issues it and the owner sets nothing', () => {
  assert.deepEqual(interviewFindings(bare({ workflows: ['token: ${{ secrets.GITHUB_TOKEN }}'] })), []);
});

for (const [name, longer] of [
  ['AUTOWRITER_PAT', 'AUTOWRITER_PAT_OLD'],
  ['AUTOWRITER_PAT', 'OLD_AUTOWRITER_PAT'],
  ['AUTOWRITER_PAT', 'AUTOWRITER_PAT2'],
  ['AUTOWRITER_PAT', 'AUTOWRITER_PATH'],
  ['demand.property', 'demand.propertyOwner'],
  ['demand.property', 'demand.properties'],
  ['demand.property', 'demandXproperty'],
]) {
  test(`${name} is not covered by ${longer}, which only contains it`, () => {
    const found = interviewFindings(tree({ bank: bankWithout(name, `\`${longer}\``) }));
    assert.deepEqual(
      found.map(({ where }) => where),
      [name]
    );
  });
}

test('a name beside punctuation, or at either end of the text, is covered', () => {
  const bank = 'loop.attemptCap, (demand.property); "AUTOWRITER_PAT". WRITING_TERM_CAP-GSC_PROPERTY';
  assert.deepEqual(interviewFindings(tree({ bank })), []);
  assert.deepEqual(interviewFindings(tree({ bank: NAMES.join(' ') })), []);
});

test('a step or a job that happens to be called secrets or vars is not a secret read', () => {
  const workflows = ['ready: ${{ steps.secrets.outputs.ready }}\nnext: ${{ needs.vars.outputs.next }}'];
  assert.deepEqual(interviewFindings(bare({ workflows })), []);
});

test('a name read many times across workflows is one finding', () => {
  const found = interviewFindings(
    tree({ bank: bankWithout('AUTOWRITER_PAT'), workflows: [WORKFLOW, WORKFLOW, WORKFLOW] })
  );
  assert.deepEqual(gapsOf(found), [['interview-gap', 'AUTOWRITER_PAT', 'workflow secret']]);
});

test('a name that is a workflow variable and an env example variable is one finding that says both', () => {
  const found = interviewFindings(
    bare({ workflows: ['p: ${{ vars.CLOUDFLARE_PAGES_PROJECT }}'], envExample: 'CLOUDFLARE_PAGES_PROJECT=site\n' })
  );
  assert.deepEqual(gapsOf(found), [
    ['interview-gap', 'CLOUDFLARE_PAGES_PROJECT', 'workflow variable, env example variable'],
  ]);
});

test('the index form of a context reads a secret or a variable too', () => {
  const workflows = ["a: ${{ secrets['SLACK_WEBHOOK_URL'] }}", 'b: ${{ vars["WRITING_PROVIDER"] }}'];
  assert.deepEqual(gapsOf(interviewFindings(bare({ workflows }))), [
    ['interview-gap', 'SLACK_WEBHOOK_URL', 'workflow secret'],
    ['interview-gap', 'WRITING_PROVIDER', 'workflow variable'],
  ]);
});

test('the env example names a variable by an assignment, commented out or not, and never by a sentence', () => {
  const envExample = [
    '# Local values.',
    'FIRST=1',
    'export SECOND=2',
    '# THIRD=',
    '#FOURTH=',
    '  FIFTH=5',
    '# Set SIXTH=1 to enable it.',
    '# Notes: the token is SEVENTH.',
  ].join('\n');
  assert.deepEqual(
    interviewFindings(bare({ envExample })).map(({ where }) => where),
    ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH']
  );
});

test('findings come in a fixed order: config paths first, then each name where it is first read', () => {
  const found = interviewFindings({
    configPaths: ['loop.attemptCap', 'demand.property'],
    workflows: ['a: ${{ vars.ZED }}\nb: ${{ secrets.ALPHA }}', 'c: ${{ secrets.MIDDLE }}'],
    envExample: 'ALPHA=1\nOMEGA=2\n',
    bank: '',
  });
  assert.deepEqual(
    found.map(({ where }) => where),
    ['loop.attemptCap', 'demand.property', 'ZED', 'ALPHA', 'MIDDLE', 'OMEGA']
  );
});

function repository(files) {
  const root = mkdtempSync(join(tmpdir(), 'interview-coverage-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test('the reader gathers every workflow in name order, the env example and the interview from a root', () => {
  const root = repository({
    '.github/workflows/b.yml': 'second',
    '.github/workflows/a.yaml': 'first',
    '.github/workflows/notes.md': 'not a workflow',
    'site/.env.example': 'ONE=1\n',
    [INTERVIEW_PATH]: 'the bank',
  });
  assert.deepEqual(readInterviewInputs(root), {
    workflows: ['first', 'second'],
    envExample: 'ONE=1\n',
    bank: 'the bank',
  });
});

test('a root with none of the three inputs reads as empty, so every name it needs is then uncovered', () => {
  const inputs = readInterviewInputs(repository({}));
  assert.deepEqual(inputs, { workflows: [], envExample: '', bank: '' });
  assert.deepEqual(
    interviewFindings({ ...inputs, configPaths: ['loop.attemptCap'] }).map(({ where }) => where),
    ['loop.attemptCap']
  );
});

test('the reader finds the real inputs of this repository, so a moved file cannot leave it checking nothing', () => {
  const { workflows, envExample, bank } = readInterviewInputs(REPOSITORY);
  assert.ok(workflows.length >= 1 && workflows.every((text) => text.includes('jobs:')));
  assert.ok(workflows.some((text) => /\bsecrets\.[A-Z_]+/.test(text)));
  assert.match(envExample, /^[A-Z_]+=/m);
  assert.match(bank, /^#### S1\. /m);
});

test('two questions sharing one id is a finding that names the id and both titles', () => {
  const bank = ['#### S49. Correction rounds', 'body', '#### S49. Keyword demand', 'body'].join('\n\n');
  const found = interviewFindings({ configPaths: [], workflows: [], envExample: '', bank });
  assert.deepEqual(
    found.map(({ rule, where }) => [rule, where]),
    [['interview-duplicate-id', 'S49']]
  );
  assert.match(found[0].detail, /Correction rounds/);
  assert.match(found[0].detail, /Keyword demand/);
});

test('an id used once is no finding, however many questions the bank holds', () => {
  const bank = ['#### S1. One', '#### S2. Two', '#### S52. Fifty-two'].join('\n\n');
  assert.deepEqual(interviewFindings({ configPaths: [], workflows: [], envExample: '', bank }), []);
});

test('the shipped interview gives every question its own id', () => {
  const { bank } = readInterviewInputs(REPOSITORY);
  const duplicates = interviewFindings({ configPaths: [], workflows: [], envExample: '', bank }).filter(
    ({ rule }) => rule === 'interview-duplicate-id'
  );
  assert.deepEqual(duplicates, []);
});
