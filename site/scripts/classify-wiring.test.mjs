import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { WORKFLOW_PATH, classifierStep, classifierWiringFindings, verdictStep } from './classify-wiring.mjs';

const realText = readFileSync(new URL(`../../${WORKFLOW_PATH}`, import.meta.url), 'utf8');

const plant = (from, to) => {
  assert.ok(realText.includes(from), `workflow no longer contains: ${from}`);
  const planted = realText.replace(from, to);
  assert.notEqual(planted, realText);
  return planted;
};

const CALL = 'run: node scripts/run-classify-diff.mjs --before "$BEFORE" --after "$AFTER" >> "$GITHUB_OUTPUT"';
const CHECKOUT =
  '      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n\n      - uses: actions/setup-node@v4';
const SETUP_NODE =
  '      - uses: actions/setup-node@v4\n        with:\n          node-version-file: site/.nvmrc\n\n      - name: classify';
const BEFORE = 'BEFORE: ${{ github.event.pull_request.base.sha || github.event.before }}';

const LEGACY_SHELL = [
  'run: |',
  '          changed="$(git diff --name-only "$BEFORE" "$AFTER" || true)"',
  '          code=false',
  '          while IFS= read -r file; do',
  '            case "$file" in',
  '              docs/*|audits/*) ;;',
  '              *.md) ;;',
  '              *) code=true ;;',
  '            esac',
  '          done <<< "$changed"',
  '          echo "code=$code" >> "$GITHUB_OUTPUT"',
].join('\n');

test('the workflow path is the one CI runs', () => {
  assert.equal(WORKFLOW_PATH, '.github/workflows/ci.yml');
});

test('the real workflow has zero findings', () => {
  assert.deepEqual(classifierWiringFindings(realText), []);
});

test('the classifier step is found by what it runs, with the directory and the variables it runs under', () => {
  const step = classifierStep(realText);
  assert.equal(step.id, 'classify');
  assert.equal(step.workingDirectory, 'site');
  assert.deepEqual(Object.keys(step.env).sort(), ['AFTER', 'BEFORE']);
  assert.equal(step.run, 'node scripts/run-classify-diff.mjs --before "$BEFORE" --after "$AFTER" >> "$GITHUB_OUTPUT"');
});

test('no step that runs the module means no classifier step', () => {
  assert.equal(classifierStep(plant(CALL, 'run: echo hi')), null);
});

const planted = [
  {
    label: 'the whole rule written back in shell',
    text: () => plant(CALL, LEGACY_SHELL),
    rules: ['classifier-not-called', 'classifier-reexpressed'],
    detail: /changes/,
  },
  {
    label: 'the call replaced by a constant',
    text: () => plant(CALL, 'run: echo "code=true" >> "$GITHUB_OUTPUT"'),
    rules: ['classifier-not-called'],
    detail: /scripts\/run-classify-diff\.mjs/,
  },
  {
    label: 'the after commit left off',
    text: () => plant(CALL, 'run: node scripts/run-classify-diff.mjs --before "$BEFORE" >> "$GITHUB_OUTPUT"'),
    rules: ['classifier-arguments'],
    detail: /--after/,
  },
  {
    label: 'the before commit left off',
    text: () => plant(CALL, 'run: node scripts/run-classify-diff.mjs --after "$AFTER" >> "$GITHUB_OUTPUT"'),
    rules: ['classifier-arguments'],
    detail: /--before/,
  },
  {
    label: 'a path filter piped after the call',
    text: () =>
      plant(
        CALL,
        'run: node scripts/run-classify-diff.mjs --before "$BEFORE" --after "$AFTER" | grep -v docs/ >> "$GITHUB_OUTPUT"'
      ),
    rules: ['classifier-reexpressed'],
    detail: /classify the diff/,
  },
  {
    label: 'a second command chained after the call',
    text: () =>
      plant(
        CALL,
        'run: node scripts/run-classify-diff.mjs --before "$BEFORE" --after "$AFTER" >> "$GITHUB_OUTPUT" && echo code=false >> "$GITHUB_OUTPUT"'
      ),
    rules: ['classifier-reexpressed'],
    detail: /classify the diff/,
  },
  {
    label: 'a path rule in a step of its own',
    text: () =>
      plant(
        SETUP_NODE,
        '      - uses: actions/setup-node@v4\n        with:\n          node-version-file: site/.nvmrc\n\n      - name: skip prose early\n        run: case "$X" in docs/*) exit 0 ;; esac\n\n      - name: classify'
      ),
    rules: ['classifier-reexpressed'],
    detail: /skip prose early/,
  },
  {
    label: 'the job output read from another step',
    text: () => plant('code: ${{ steps.classify.outputs.code }}', 'code: ${{ steps.other.outputs.code }}'),
    rules: ['classifier-output-unwired'],
    detail: /steps\.classify\.outputs\.code/,
  },
  {
    label: 'the job output removed',
    text: () => plant('    outputs:\n      code: ${{ steps.classify.outputs.code }}\n    steps:', '    steps:'),
    rules: ['classifier-output-unwired'],
    detail: /steps\.classify\.outputs\.code/,
  },
  {
    label: 'a shallow checkout',
    text: () => plant(CHECKOUT, '      - uses: actions/checkout@v4\n\n      - uses: actions/setup-node@v4'),
    rules: ['classifier-history-shallow'],
    detail: /fetch-depth: 0/,
  },
  {
    label: 'no pinned node before the classifier',
    text: () => plant(SETUP_NODE, '      - name: classify'),
    rules: ['classifier-node-unpinned'],
    detail: /setup-node/,
  },
  {
    label: 'the before commit read from the last push alone',
    text: () => plant(BEFORE, 'BEFORE: ${{ github.event.before }}'),
    rules: ['classifier-judges-last-push'],
    detail: /github\.event\.pull_request\.base\.sha/,
  },
  {
    label: 'the before commit no longer set by the step',
    text: () => plant(`          ${BEFORE}\n`, ''),
    rules: ['classifier-judges-last-push'],
    detail: /BEFORE/,
  },
  {
    label: 'the job key renamed',
    text: () => plant('  changes:\n', '  changed:\n'),
    rules: ['changes-job-missing'],
    detail: /changes/,
  },
];

for (const { label, text, rules, detail } of planted) {
  test(`planted defect: ${label}`, () => {
    const findings = classifierWiringFindings(text());
    assert.deepEqual(findings.map((finding) => finding.rule).sort(), [...rules].sort());
    assert.ok(
      findings.some((finding) => detail.test(finding.detail)),
      JSON.stringify(findings)
    );
    for (const finding of findings) assert.ok(finding.detail.length > 30);
  });
}

test('the missing-job finding is the only finding', () => {
  assert.equal(classifierWiringFindings(plant('  changes:\n', '  changed:\n')).length, 1);
});

test('a before that names the base commit of the pull request passes, whatever it falls back to for a push', () => {
  assert.deepEqual(classifierWiringFindings(plant(BEFORE, 'BEFORE: ${{ github.event.pull_request.base.sha }}')), []);
});

test('a workflow that is not a mapping is reported as having no changes job and never throws', () => {
  assert.deepEqual(
    classifierWiringFindings('- just\n- a list\n').map((finding) => finding.rule),
    ['changes-job-missing']
  );
  assert.deepEqual(
    classifierWiringFindings('').map((finding) => finding.rule),
    ['changes-job-missing']
  );
});

test('the verdict step is the one the job output reads, even when it does not call the module', () => {
  assert.equal(verdictStep(realText).id, 'classify');
  const legacy = verdictStep(plant(CALL, LEGACY_SHELL));
  assert.equal(legacy.id, 'classify');
  assert.match(legacy.run, /case "\$file" in/);
});

test('a job output that names no step leaves no verdict step', () => {
  assert.equal(verdictStep(plant('code: ${{ steps.classify.outputs.code }}', 'code: true')), null);
  assert.equal(
    verdictStep(plant('code: ${{ steps.classify.outputs.code }}', 'code: ${{ steps.gone.outputs.code }}')),
    null
  );
});
