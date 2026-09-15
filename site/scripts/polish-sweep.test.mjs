import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyFindings, renderSweep, MIN_TARGET, WIDTHS } from './polish-sweep.mjs';

test('the target floor is the WCAG 2.5.8 AA minimum of 24 px, not the 44 px AAA figure', () => {
  assert.equal(MIN_TARGET, 24);
  assert.deepEqual(
    classifyFindings({
      route: '/x',
      width: 320,
      scrollWidth: 320,
      clientWidth: 320,
      smallTargets: [{ label: 'icon', w: 36, h: 36 }],
      clipped: [],
      duplicateIds: [],
    }),
    []
  );
});

test('the six audit widths from the polish loop are used, smallest first', () => {
  assert.deepEqual(WIDTHS, [320, 375, 768, 1024, 1280, 1920]);
});

test('horizontal overflow, small targets, clipped text and duplicate ids are each named', () => {
  const findings = classifyFindings({
    route: '/x',
    width: 320,
    scrollWidth: 340,
    clientWidth: 320,
    smallTargets: [{ label: 'Book a call', w: 40, h: 20 }],
    clipped: [{ tag: 'H1', text: 'A long heading' }],
    duplicateIds: ['main'],
  });
  const rules = findings.map((finding) => finding.rule).sort();
  assert.deepEqual(rules, ['clipped-text', 'duplicate-id', 'horizontal-overflow', 'small-tap-target']);
  assert.match(findings.find((finding) => finding.rule === 'horizontal-overflow').detail, /340.*320/);
});

test('a clean viewport yields nothing', () => {
  assert.deepEqual(
    classifyFindings({
      route: '/x',
      width: 768,
      scrollWidth: 768,
      clientWidth: 768,
      smallTargets: [],
      clipped: [],
      duplicateIds: [],
    }),
    []
  );
});

test('a one-pixel scroll difference is not overflow, because rounding is not a defect', () => {
  assert.deepEqual(
    classifyFindings({
      route: '/x',
      width: 375,
      scrollWidth: 376,
      clientWidth: 375,
      smallTargets: [],
      clipped: [],
      duplicateIds: [],
    }),
    []
  );
});

test('the report counts routes swept and lists every finding with its width', () => {
  const md = renderSweep({
    routes: 105,
    widths: WIDTHS,
    findings: [{ route: '/x', width: 320, rule: 'horizontal-overflow', detail: '340 > 320' }],
  });
  assert.match(md, /105 routes/);
  assert.match(md, /320/);
  assert.match(md, /horizontal-overflow/);
});

test('a visually hidden element is never a finding, and a real control still is', () => {
  const hidden = classifyFindings({
    route: '/x',
    width: 320,
    scrollWidth: 320,
    clientWidth: 320,
    smallTargets: [],
    clipped: [],
    duplicateIds: [],
  });
  assert.deepEqual(hidden, []);
  assert.equal(
    classifyFindings({
      route: '/x',
      width: 320,
      scrollWidth: 320,
      clientWidth: 320,
      smallTargets: [{ label: 'Book a call', w: 176, h: 21 }],
      clipped: [],
      duplicateIds: [],
    }).length,
    1
  );
});
