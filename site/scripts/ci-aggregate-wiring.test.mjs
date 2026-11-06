import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregateWiringFindings, WORKFLOW_PATH } from './ci-aggregate-wiring.mjs';

const realText = readFileSync(new URL(`../../${WORKFLOW_PATH}`, import.meta.url), 'utf8');

const plant = (from, to) => {
  assert.ok(realText.includes(from), `workflow no longer contains: ${from}`);
  const planted = realText.replace(from, to);
  assert.notEqual(planted, realText);
  return planted;
};

const NEEDS_LINE = '    needs: [changes, build, types-and-units, cheap-gates, visual-and-axe, deploy-preview]';
const STEP_IF = '        if: always()\n        env:\n          NEEDS:';

test('the workflow path is the one CI runs', () => {
  assert.equal(WORKFLOW_PATH, '.github/workflows/ci.yml');
});

test('the real workflow has zero findings', () => {
  assert.deepEqual(aggregateWiringFindings(realText), []);
});

const planted = [
  {
    label: 'a required job dropped from needs',
    text: () => plant(NEEDS_LINE, NEEDS_LINE.replace(' visual-and-axe,', '')),
    rules: ['aggregate-table-drift', 'aggregate-uncovered'],
    detail: /visual-and-axe/,
  },
  {
    label: 'the job if loses always()',
    text: () =>
      plant(
        "if: always() && (github.event_name != 'workflow_dispatch' || inputs.full)",
        "if: (github.event_name != 'workflow_dispatch' || inputs.full)"
      ),
    rules: ['aggregate-not-always'],
    detail: /all-required-jobs-passed/,
  },
  {
    label: 'the decision step loses its if',
    text: () => plant(STEP_IF, '        env:\n          NEEDS:'),
    rules: ['aggregate-step-not-always'],
    detail: /ci-aggregate\.mjs/,
  },
  {
    label: 'the job key renamed',
    text: () => plant('  all-required-jobs-passed:\n', '  everything-passed:\n'),
    rules: ['aggregate-job-missing'],
    detail: /all-required-jobs-passed/,
  },
  {
    label: 'an uncovered job added',
    text: () =>
      plant(
        '  regen-baselines:\n',
        '  stray-gate:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n\n  regen-baselines:\n'
      ),
    rules: ['aggregate-uncovered'],
    detail: /job "stray-gate" is not in the needs of all-required-jobs-passed, so its failure would not block a merge/,
  },
  {
    label: 'a dangling need added',
    text: () => plant(NEEDS_LINE, NEEDS_LINE.replace('deploy-preview]', 'deploy-preview, ghost-job]')),
    rules: ['aggregate-dangling', 'aggregate-table-drift'],
    detail: /ghost-job/,
  },
  {
    label: 'the name becomes a literal without the pull_request expression',
    text: () =>
      plant(
        "name: ${{ github.event_name == 'pull_request' && 'all required jobs passed' || format('all required jobs passed ({0})', github.event_name) }}",
        'name: all required jobs passed'
      ),
    rules: ['aggregate-name'],
    detail: /all-required-jobs-passed/,
  },
];

for (const { label, text, rules, detail } of planted) {
  test(`planted defect: ${label}`, () => {
    const findings = aggregateWiringFindings(text());
    assert.deepEqual(findings.map((finding) => finding.rule).sort(), [...rules].sort());
    assert.ok(
      findings.some((finding) => detail.test(finding.detail)),
      JSON.stringify(findings)
    );
    for (const finding of findings) assert.ok(finding.detail.length > 30);
  });
}

test('needs given as a string is read as a one-entry list', () => {
  const text = plant(NEEDS_LINE, '    needs: changes');
  const rules = aggregateWiringFindings(text).map((finding) => finding.rule);
  assert.ok(rules.includes('aggregate-table-drift'), rules.join(','));
  assert.ok(rules.includes('aggregate-uncovered'), rules.join(','));
});

test('the missing-job finding is the only finding', () => {
  const findings = aggregateWiringFindings(plant('  all-required-jobs-passed:\n', '  everything-passed:\n'));
  assert.equal(findings.length, 1);
});

test('no step running the script is reported as such', () => {
  const text = plant('run: node scripts/ci-aggregate.mjs', 'run: echo decided');
  const findings = aggregateWiringFindings(text);
  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['aggregate-step-not-always']
  );
  assert.match(findings[0].detail, /No step of all-required-jobs-passed runs/);
});
