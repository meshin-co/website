import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, test } from 'node:test';

import {
  FindingsError,
  GATE_FINDINGS_VARIABLE,
  findingsFileName,
  parseGateFindings,
  recordGateFindings,
} from './gate-findings.mjs';

const MODULE = pathToFileURL(join(import.meta.dirname, 'gate-findings.mjs')).href;

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const scratch = () => {
  const root = mkdtempSync(join(tmpdir(), 'gate-findings-'));
  roots.push(root);
  return root;
};

const finding = (overrides = {}) => ({
  rule: 'banned-phrase',
  subjects: ['/blog/x'],
  detail: 'leverage',
  excerpt: 'we leverage it',
  ...overrides,
});

const record = (gate, findings, directory) =>
  recordGateFindings({ gate, findings, env: { [GATE_FINDINGS_VARIABLE]: directory } });

const listing = (directory) => {
  assert.ok(existsSync(directory), `${directory} exists`);
  return readdirSync(directory).sort();
};

const written = (directory, name) => {
  assert.ok(existsSync(join(directory, name)), `${name} was written`);
  return readFileSync(join(directory, name), 'utf8');
};

const inChild = (body, { cwd, env = {} }) => {
  const inherited = { ...process.env };
  delete inherited[GATE_FINDINGS_VARIABLE];
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', 'import * as findings from ' + JSON.stringify(MODULE) + ';\n' + body],
    { cwd, env: { ...inherited, ...env }, encoding: 'utf8' }
  );
};

const VALID = {
  schema: 1,
  gate: 'gate:content',
  findings: [
    { rule: 'banned-phrase', subjects: ['/blog/x'], detail: 'leverage', excerpt: 'we leverage it' },
    { rule: 'duplicate-sentence', subjects: ['/blog/x', '/about'], detail: '2 routes', excerpt: '' },
  ],
};

const mutated = (change) => {
  const copy = structuredClone(VALID);
  change(copy);
  return JSON.stringify(copy);
};

const problemsOf = (text) => {
  try {
    parseGateFindings(text);
  } catch (error) {
    assert.ok(error instanceof FindingsError, String(error));
    return error.problems;
  }
  return null;
};

test('the variable that switches recording on is GATE_FINDINGS_DIR', () => {
  assert.equal(GATE_FINDINGS_VARIABLE, 'GATE_FINDINGS_DIR');
});

test('the file of a gate is its npm script name with the colon turned into a hyphen', () => {
  assert.equal(findingsFileName('gate:content'), 'gate-content.json');
  assert.equal(findingsFileName('gate:human'), 'gate-human.json');
  assert.equal(findingsFileName('gate:editorial'), 'gate-editorial.json');
  assert.equal(findingsFileName('gate:machine'), 'gate-machine.json');
  assert.equal(findingsFileName('gate:registers'), 'gate-registers.json');
  assert.equal(findingsFileName('gate:lh-one2'), 'gate-lh-one2.json');
});

test('a gate name that is not gate: and lower case letters, digits and hyphens is refused', () => {
  for (const name of [
    'content',
    'gate:',
    'gate:Content',
    'gate:a_b',
    'gate:a/b',
    'gate:..',
    ' gate:content',
    'gate:content\n',
    'gate:content:more',
    'test:smoke',
    '',
    undefined,
    null,
    42,
  ]) {
    assert.throws(() => findingsFileName(name), FindingsError, String(name));
  }
});

test('a local run writes nothing: the variable unset or blank leaves the working directory empty', () => {
  const code =
    'findings.recordGateFindings({ gate: "gate:content", findings: [{ rule: "x", subjects: [], detail: "", excerpt: "" }] });';
  for (const env of [{}, { [GATE_FINDINGS_VARIABLE]: '' }, { [GATE_FINDINGS_VARIABLE]: '   ' }]) {
    const cwd = scratch();
    const run = inChild(code, { cwd, env });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(readdirSync(cwd), []);
  }
});

test('unset or blank, it does not even look at the findings it was given', () => {
  for (const env of [{}, { [GATE_FINDINGS_VARIABLE]: ' ' }]) {
    assert.doesNotThrow(() => recordGateFindings({ gate: 'not a gate', findings: 'not a list', env }));
  }
});

test('a directory that is not absolute is refused, and nothing is written from the working directory', () => {
  for (const value of ['findings', './findings', '../findings', 'a/b', '~/findings']) {
    const cwd = scratch();
    const run = inChild(
      'findings.recordGateFindings({ gate: "gate:content", findings: [{ rule: "x", subjects: ["/a"], detail: "", excerpt: "" }] });',
      { cwd, env: { [GATE_FINDINGS_VARIABLE]: value } }
    );
    assert.notEqual(run.status, 0, value);
    assert.match(run.stderr, /FindingsError/);
    assert.match(run.stderr, /GATE_FINDINGS_DIR/);
    assert.match(run.stderr, /absolute/);
    assert.deepEqual(readdirSync(cwd), [], value);
  }
});

test('it reads the variable from the process environment when no env is passed', () => {
  const cwd = scratch();
  const directory = join(scratch(), 'out');
  const run = inChild(
    'findings.recordGateFindings({ gate: "gate:human", findings: [{ rule: "x", subjects: ["/a"], detail: "d", excerpt: "e" }] });',
    { cwd, env: { [GATE_FINDINGS_VARIABLE]: directory } }
  );
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(listing(directory), ['gate-human.json']);
  assert.deepEqual(readdirSync(cwd), []);
});

test('the file is two-space JSON with the schema, the gate and four keys per finding, and a final newline', () => {
  const directory = scratch();
  record('gate:content', [finding()], directory);

  assert.equal(
    written(directory, 'gate-content.json'),
    [
      '{',
      '  "schema": 1,',
      '  "gate": "gate:content",',
      '  "findings": [',
      '    {',
      '      "rule": "banned-phrase",',
      '      "subjects": [',
      '        "/blog/x"',
      '      ],',
      '      "detail": "leverage",',
      '      "excerpt": "we leverage it"',
      '    }',
      '  ]',
      '}',
      '',
    ].join('\n')
  );
});

test('a missing directory is created, however deep', () => {
  const directory = join(scratch(), 'a', 'b', 'c');
  record('gate:machine', [finding()], directory);
  assert.deepEqual(listing(directory), ['gate-machine.json']);
});

test('a second run replaces the first whole and leaves no temporary file beside it', () => {
  const directory = scratch();
  record('gate:content', [finding(), finding({ rule: 'h1-count' })], directory);
  record('gate:content', [finding({ rule: 'takeaways' })], directory);

  assert.deepEqual(listing(directory), ['gate-content.json']);
  const { gate, findings } = parseGateFindings(written(directory, 'gate-content.json'));
  assert.equal(gate, 'gate:content');
  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ['takeaways']
  );
});

test('a write that cannot be completed leaves the directory as it was, with no temporary file', () => {
  const directory = scratch();
  mkdirSync(join(directory, 'gate-content.json'));

  assert.throws(() => record('gate:content', [finding()], directory));
  assert.deepEqual(listing(directory), ['gate-content.json']);
});

test('a malformed finding is refused before the file of an earlier run is touched', () => {
  const directory = scratch();
  record('gate:content', [finding()], directory);
  const before = written(directory, 'gate-content.json');

  assert.throws(() => record('gate:content', [{ rule: '', subjects: [] }], directory), FindingsError);
  assert.equal(written(directory, 'gate-content.json'), before);
  assert.deepEqual(listing(directory), ['gate-content.json']);
});

test('every problem of a malformed finding list is named, not only the first', () => {
  const directory = scratch();
  let caught;
  try {
    record('gate:content', [{ rule: '', subjects: 'x' }, finding({ subjects: [1] }), 'text'], directory);
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof FindingsError);
  assert.equal(caught.problems.length, 4, caught.message);
  assert.match(caught.problems[0], /finding 0.*rule/);
  assert.match(caught.problems[1], /finding 0.*subjects/);
  assert.match(caught.problems[2], /finding 1.*subject 0/);
  assert.match(caught.problems[3], /finding 2/);
  for (const problem of caught.problems) assert.ok(caught.message.includes(problem), problem);
});

test('findings that are not a list are refused', () => {
  assert.throws(() => record('gate:content', 'x', scratch()), FindingsError);
  assert.throws(() => record('gate:content', undefined, scratch()), FindingsError);
});

test('a finding with no subject is kept: an empty list says the gate could not name a culprit', () => {
  const directory = scratch();
  record('gate:human', [finding({ subjects: [] })], directory);
  const { findings } = parseGateFindings(written(directory, 'gate-human.json'));
  assert.deepEqual(findings[0].subjects, []);
});

test('detail and excerpt are cut to 400 characters and never split a surrogate pair', () => {
  const directory = scratch();
  record(
    'gate:content',
    [
      finding({ detail: 'd'.repeat(500), excerpt: 'e'.repeat(401) }),
      finding({ detail: 'k'.repeat(400), excerpt: 'a'.repeat(399) + '\u{1F600}tail' }),
    ],
    directory
  );
  const { findings } = parseGateFindings(written(directory, 'gate-content.json'));

  assert.equal(findings[0].detail, 'd'.repeat(400));
  assert.equal(findings[0].excerpt, 'e'.repeat(400));
  assert.equal(findings[1].detail, 'k'.repeat(400));
  assert.equal(findings[1].excerpt, 'a'.repeat(399));
});

test('a finding without detail or excerpt gets empty strings, and keys the schema does not name are dropped', () => {
  const directory = scratch();
  record('gate:human', [{ rule: 'controlled-word', subjects: ['/a'], route: '/a', extra: 1 }], directory);
  const { findings } = parseGateFindings(written(directory, 'gate-human.json'));

  assert.deepEqual(findings, [{ rule: 'controlled-word', subjects: ['/a'], detail: '', excerpt: '' }]);
});

test('two gates keep two files in one directory', () => {
  const directory = scratch();
  record('gate:content', [finding()], directory);
  record('gate:human', [finding({ rule: 'reading-grade' })], directory);
  assert.deepEqual(listing(directory), ['gate-content.json', 'gate-human.json']);
});

test('no findings removes the stale file of that gate and only that file', () => {
  const directory = scratch();
  record('gate:content', [finding()], directory);
  record('gate:human', [finding()], directory);

  record('gate:content', [], directory);

  assert.deepEqual(listing(directory), ['gate-human.json']);
});

test('no findings and nothing stale writes nothing, and does not create the directory', () => {
  const root = scratch();
  const missing = join(root, 'never');
  record('gate:content', [], missing);
  assert.equal(existsSync(missing), false);

  const existing = join(root, 'there');
  mkdirSync(existing);
  record('gate:content', [], existing);
  assert.deepEqual(listing(existing), []);
});

test('what was written parses back to the same gate and findings', () => {
  const directory = scratch();
  const sent = [finding(), finding({ rule: 'duplicate-sentence', subjects: ['/blog/x', '/about'], excerpt: '' })];
  record('gate:content', sent, directory);

  assert.deepEqual(parseGateFindings(written(directory, 'gate-content.json')), {
    gate: 'gate:content',
    findings: sent,
  });
});

test('a valid document with no findings parses', () => {
  assert.deepEqual(parseGateFindings(JSON.stringify({ schema: 1, gate: 'gate:human', findings: [] })), {
    gate: 'gate:human',
    findings: [],
  });
  assert.deepEqual(problemsOf(JSON.stringify(VALID)), null);
});

test('text that is not JSON, or JSON that is not an object, is refused', () => {
  for (const text of ['nope', '', '[]', 'null', '42', '"x"']) {
    assert.ok(problemsOf(text)?.length > 0, text);
  }
});

test('the schema must be the number 1, the gate a gate name, and no key may be added', () => {
  const refused = [
    mutated((doc) => (doc.schema = 2)),
    mutated((doc) => (doc.schema = '1')),
    mutated((doc) => delete doc.schema),
    mutated((doc) => (doc.gate = 'content')),
    mutated((doc) => (doc.gate = 'gate:Content')),
    mutated((doc) => delete doc.gate),
    mutated((doc) => (doc.extra = true)),
    mutated((doc) => delete doc.findings),
    mutated((doc) => (doc.findings = {})),
  ];
  for (const text of refused) assert.ok(problemsOf(text)?.length > 0, text);
});

test('a finding must hold exactly rule, subjects, detail and excerpt', () => {
  const refused = [
    mutated((doc) => delete doc.findings[0].rule),
    mutated((doc) => delete doc.findings[0].subjects),
    mutated((doc) => delete doc.findings[0].detail),
    mutated((doc) => delete doc.findings[0].excerpt),
    mutated((doc) => (doc.findings[0].route = '/x')),
    mutated((doc) => (doc.findings[0] = null)),
    mutated((doc) => (doc.findings[0] = 'text')),
    mutated((doc) => (doc.findings[0] = [])),
  ];
  for (const text of refused) assert.ok(problemsOf(text)?.length > 0, text);
});

test('a rule is a non-empty string, detail and excerpt are strings of at most 400 characters', () => {
  const refused = [
    mutated((doc) => (doc.findings[0].rule = '')),
    mutated((doc) => (doc.findings[0].rule = 5)),
    mutated((doc) => (doc.findings[0].detail = 5)),
    mutated((doc) => (doc.findings[0].excerpt = null)),
    mutated((doc) => (doc.findings[0].detail = 'x'.repeat(401))),
    mutated((doc) => (doc.findings[0].excerpt = 'x'.repeat(401))),
  ];
  for (const text of refused) assert.ok(problemsOf(text)?.length > 0, text);
  assert.equal(problemsOf(mutated((doc) => (doc.findings[0].detail = 'x'.repeat(400)))), null);
});

test('a subject is a route or a repo-relative path: no empty string, no backslash, no .. segment, no ./ prefix', () => {
  const refused = [
    mutated((doc) => (doc.findings[0].subjects = '/blog/x')),
    mutated((doc) => (doc.findings[0].subjects = [1])),
    mutated((doc) => (doc.findings[0].subjects = [''])),
    mutated((doc) => (doc.findings[0].subjects = [' /blog/x'])),
    mutated((doc) => (doc.findings[0].subjects = ['docs\\SEMANTIC-CORE.md'])),
    mutated((doc) => (doc.findings[0].subjects = ['../audits/x.json'])),
    mutated((doc) => (doc.findings[0].subjects = ['docs/../x.md'])),
    mutated((doc) => (doc.findings[0].subjects = ['./docs/x.md'])),
  ];
  for (const text of refused) assert.ok(problemsOf(text)?.length > 0, text);
  for (const good of ['/', '/blog/x', 'docs/SEMANTIC-CORE.md', '.github/workflows/ci.yml']) {
    assert.equal(problemsOf(mutated((doc) => (doc.findings[0].subjects = [good]))), null, good);
  }
});

test('every problem in a document is listed, not only the first', () => {
  const text = mutated((doc) => {
    doc.schema = 2;
    doc.findings[0].rule = '';
    doc.findings[1].subjects = [3];
  });
  const problems = problemsOf(text);

  assert.ok(problems, 'a document with three problems is refused');
  assert.equal(problems.length, 3, problems.join(' | '));
  assert.match(problems[0], /schema/);
  assert.match(problems[1], /finding 0.*rule/);
  assert.match(problems[2], /finding 1.*subject 0/);
});

test('the error is an Error named FindingsError whose message carries every problem', () => {
  let caught;
  try {
    parseGateFindings('nope');
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error);
  assert.equal(caught.name, 'FindingsError');
  assert.ok(caught.problems.length > 0);
  for (const problem of caught.problems) assert.ok(caught.message.includes(problem));
});
