import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import yaml from 'js-yaml';

import { RULES } from './repair-kinds.mjs';

const SITE = resolve(import.meta.dirname, '..');
const WORKFLOW = readFileSync(join(SITE, '..', '.github/workflows/ci.yml'), 'utf8');
const SCRIPTS = JSON.parse(readFileSync(join(SITE, 'package.json'), 'utf8')).scripts;
const readScript = (file) => readFileSync(join(SITE, file), 'utf8');

const PRINT_ONLY = [
  'gate:html',
  'gate:links',
  'gate:parity',
  'gate:agents',
  'gate:jsonld',
  'gate:external',
  'gate:search',
  'gate:routes',
  'gate:paid',
];

const gatesOf = (workflow) =>
  yaml
    .load(workflow)
    .jobs['cheap-gates'].steps.flatMap(({ run = '' }) =>
      [...run.matchAll(/npm run (gate:[a-z0-9-]+)/g)].map(([, gate]) => gate)
    );

const sourceOf = ({ gate, scripts, read }) => {
  const file = /node (scripts\/[a-z0-9.-]+\.mjs)/.exec(scripts[gate] ?? '')?.[1];
  return file === undefined ? '' : read(file);
};

const recordsFindings = (request) =>
  new RegExp(`recordGateFindings\\(\\{\\s*gate:\\s*'${request.gate}'`).test(sourceOf(request));

const printOnlyGates = ({ workflow, scripts, read }) =>
  gatesOf(workflow).filter((gate) => !recordsFindings({ gate, scripts, read }));

const job = (...gates) =>
  `jobs:\n  cheap-gates:\n    steps:\n${gates.map((gate) => `      - run: npm run ${gate}\n`).join('')}`;

test('the cheap-gates job runs fifteen gates, and exactly these nine print their failures and record none', () => {
  assert.equal(gatesOf(WORKFLOW).length, 15);
  assert.deepEqual(printOnlyGates({ workflow: WORKFLOW, scripts: SCRIPTS, read: readScript }), PRINT_ONLY);
});

test('every gate the repair table reads is a gate of the job that records its findings', () => {
  const gates = gatesOf(WORKFLOW);

  for (const gate of Object.keys(RULES)) {
    assert.ok(gates.includes(gate), `${gate} has a table in the repair but is not a step of cheap-gates`);
    assert.equal(recordsFindings({ gate, scripts: SCRIPTS, read: readScript }), true, `${gate} records no findings`);
  }
});

test('a gate that prints and records nothing is reported, and one that records is not', () => {
  const scripts = { 'gate:silent': 'node scripts/silent.mjs', 'gate:loud': 'node scripts/loud.mjs' };
  const files = {
    'scripts/silent.mjs': "console.log('failed');",
    'scripts/loud.mjs': "recordGateFindings({ gate: 'gate:loud', findings: [] });",
  };
  const found = printOnlyGates({
    workflow: job('gate:silent', 'gate:loud', 'gate:binary'),
    scripts: { ...scripts, 'gate:binary': 'html-validate dist' },
    read: (file) => files[file],
  });

  assert.deepEqual(found, ['gate:silent', 'gate:binary']);
});

test('a recorder that names another gate does not count for this one', () => {
  const found = printOnlyGates({
    workflow: job('gate:a'),
    scripts: { 'gate:a': 'node scripts/a.mjs' },
    read: () => "recordGateFindings({ gate: 'gate:b', findings: [] });",
  });

  assert.deepEqual(found, ['gate:a']);
});
