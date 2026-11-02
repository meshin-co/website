import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';

import { BOOKING_URL } from '../src/utils/booking.mjs';
import { parseGateFindings } from './gate-findings.mjs';
import { knownRule } from './repair-kinds.mjs';
import { GENERATED_BEGIN, GENERATED_END } from './semantic-core.mjs';

const GATE = 'gate:content';
const FILE = 'gate-content.json';
const DOC = 'docs/SEMANTIC-CORE.md';
const BRAND = 'scene.test';
const SHARED = 'An AI register is the list of every AI system your company runs today.';
const HEADING = '<h1>Fractional Chief AI Officer</h1>';
const HOME_FLAWED = [
  HEADING,
  `<p>${SHARED} We leverage it.</p>`,
  '<p>Moreover, we cut cost by 87%.</p>',
  '<p>Based in Israel.</p>',
].join('');
const HOME_CLEAN = [
  HEADING,
  '<p>A fractional chief AI officer runs the AI programme part time.</p>',
  '<p>The work starts with a register of systems.</p>',
  `<a href="${BOOKING_URL}">Book a call</a>`,
].join('');
const EXPECTED_RULES = [
  'banned-phrase',
  'booking-cta-missing',
  'buyer-prompt-must-win-missing',
  'buyer-prompt-passage-missing',
  'doc-drift',
  'doc-drift-structure',
  'duplicate-sentence',
  'formulaic-transition',
  'published-against-a-decision',
  'query-opening',
  'query-without-route',
  'route-without-query',
  'title-missing',
  'title-suffix',
  'unsourced-number',
];

const NAVIGATION = '<header><nav><a href="/about">About</a></nav></header>';
const page = (head, main) =>
  `<!doctype html><html><head>${head}</head><body>${NAVIGATION}<main>${main}</main></body></html>`;
const title = (text) => `<title>${text} — ${BRAND}</title>`;
const config = `site:\n  name: ${BRAND}\n`;

const FLAWED = {
  [DOC]: [
    '# Semantic core',
    '',
    GENERATED_BEGIN,
    'stale',
    GENERATED_END,
    '',
    '### The 30 buyer prompts (PRD §17.3)',
    '',
    '**1. first prompt**',
    'Must win: `/blog/missing`, support `/`.',
    'Passage: "Not on any page." (`/`)',
    'Why: because.',
    '',
    '### GAP register',
    '',
  ].join('\n'),
  'site/src/config.yaml': config,
  'site/banned-phrases.json': JSON.stringify(['leverage']),
  'site/content-facts.json': JSON.stringify({
    targetQuery: { '/': 'fractional chief ai officer', '/ghost': 'ghost' },
    numbers: [],
  }),
  'site/dist/index.html': page(title('Fractional Chief AI Officer'), HOME_FLAWED),
  'site/dist/about.html': page(`<title>About | ${BRAND}</title>`, `<h1>About</h1><p>${SHARED}</p>`),
  'site/dist/pricing.html': page('', '<h1>Pricing</h1><p>Pricing is simple.</p>'),
};

const CLEAN = {
  [DOC]: `# Semantic core\n\n${GENERATED_BEGIN}\n${GENERATED_END}\n`,
  'site/src/config.yaml': config,
  'site/banned-phrases.json': '[]',
  'site/content-facts.json': JSON.stringify({ targetQuery: { '/': 'fractional chief ai officer' }, numbers: [] }),
  'site/dist/index.html': page(title('Fractional Chief AI Officer'), HOME_CLEAN),
};

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const scene = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'content-findings-'));
  roots.push(root);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return { root, site: join(root, 'site'), findingsDir: join(root, 'findings') };
};

const run = (script, { cwd, args = [], findingsDir }) => {
  const env = { ...process.env };
  delete env.GATE_FINDINGS_DIR;
  if (findingsDir !== undefined) env.GATE_FINDINGS_DIR = findingsDir;
  return spawnSync(process.execPath, [join(import.meta.dirname, script), ...args], { cwd, env, encoding: 'utf8' });
};

const gate = ({ site }, findingsDir) => run('content-gate.mjs', { cwd: site, args: ['dist'], findingsDir });

const cleanScene = () => {
  const found = scene(CLEAN);
  const written = run('semantic-core.mjs', { cwd: found.site });
  assert.equal(written.status, 0, written.stderr);
  return found;
};

const recorded = (findingsDir) => {
  const file = join(findingsDir, FILE);
  assert.ok(existsSync(file), `the gate wrote no ${FILE}`);
  return parseGateFindings(readFileSync(file, 'utf8'));
};

const listing = (root) => readdirSync(root, { recursive: true }).sort();

const countsOf = (rules) => {
  const counts = {};
  for (const rule of rules) counts[rule] = (counts[rule] ?? 0) + 1;
  return counts;
};

const PRINTED_COUNT = /^ {2}([a-z0-9-]+): (\d+)$/gm;
const printedCounts = (stdout) =>
  Object.fromEntries([...stdout.matchAll(PRINTED_COUNT)].map(([, rule, count]) => [rule, Number(count)]));

test('the gate records every finding it prints, once, and every rule it records is known', () => {
  const found = scene(FLAWED);

  const result = gate(found, found.findingsDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^content: 3 pages gated, 3 indexable routes checked for a booking call to action$/m);
  const { gate: name, findings } = recorded(found.findingsDir);
  const rules = findings.map((finding) => finding.rule);
  assert.equal(name, GATE);
  assert.deepEqual(countsOf(rules), printedCounts(result.stdout));
  assert.deepEqual([...new Set(rules)].sort(), EXPECTED_RULES);
  for (const rule of new Set(rules)) assert.equal(knownRule({ gate: GATE, rule }), true, rule);
});

test('a record names its route, the document for drift, and every route that shares a sentence', () => {
  const found = scene(FLAWED);

  gate(found, found.findingsDir);

  const { findings } = recorded(found.findingsDir);
  const subjectsOf = (rule) => findings.filter((finding) => finding.rule === rule).map((finding) => finding.subjects);
  const excerptsOf = (rule) => findings.filter((finding) => finding.rule === rule).map((finding) => finding.excerpt);
  assert.deepEqual(subjectsOf('duplicate-sentence'), [['/', '/about']]);
  assert.deepEqual(subjectsOf('doc-drift'), [[DOC], [DOC], [DOC]]);
  assert.deepEqual(excerptsOf('doc-drift'), ['/', '/about', '/pricing']);
  assert.deepEqual(subjectsOf('doc-drift-structure'), [[DOC]]);
  assert.deepEqual(subjectsOf('booking-cta-missing'), [['/'], ['/about'], ['/pricing']]);
  assert.deepEqual(subjectsOf('query-without-route'), [['/ghost']]);
  assert.deepEqual(subjectsOf('buyer-prompt-must-win-missing'), [['/blog/missing']]);
  assert.deepEqual(subjectsOf('banned-phrase'), [['/']]);
});

test('a clean tree removes the stale file of this gate, and leaves the file of another gate alone', () => {
  const found = cleanScene();
  mkdirSync(found.findingsDir);
  writeFileSync(join(found.findingsDir, FILE), 'stale');
  writeFileSync(join(found.findingsDir, 'gate-human.json'), 'another gate');

  const result = gate(found, found.findingsDir);

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /^content: 1 pages gated, 1 indexable routes checked for a booking call to action$/m);
  assert.deepEqual(readdirSync(found.findingsDir), ['gate-human.json']);
});

test('an unset GATE_FINDINGS_DIR writes nothing, in the working directory or anywhere beside the tree', () => {
  const found = scene(FLAWED);
  const before = listing(found.root);

  const result = gate(found);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^ {2}doc-drift: 3$/m);
  assert.deepEqual(listing(found.root), before);
});

test('a relative GATE_FINDINGS_DIR stops the gate with the reason, and writes nothing', () => {
  const found = scene(FLAWED);
  const before = listing(found.root);

  const result = gate(found, 'findings');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FindingsError: GATE_FINDINGS_DIR must be an absolute path/);
  assert.match(result.stdout, /^ {2}doc-drift: 3$/m);
  assert.deepEqual(listing(found.root), before);
});
