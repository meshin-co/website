import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evidenceFindings, fingerprint, staleReason } from './lh-evidence.mjs';

const reportFor = (route, score) => ({
  finalUrl: `http://127.0.0.1:4330${route}`,
  categories: {
    performance: { score },
    accessibility: { score },
    'best-practices': { score },
    seo: { score },
  },
});

test('the fingerprint covers only what can change the built output', () => {
  const withProse = fingerprint([
    ['site/src/pages/index.astro', 'aaa'],
    ['docs/PRD.md', 'bbb'],
    ['audits/phase-5/REPORT.md', 'ccc'],
  ]);
  const withoutProse = fingerprint([['site/src/pages/index.astro', 'aaa']]);

  assert.equal(withProse, withoutProse);
});

test('the order files arrive in does not change the fingerprint', () => {
  const one = fingerprint([
    ['site/src/pages/a.astro', '1'],
    ['site/src/pages/b.astro', '2'],
  ]);
  const other = fingerprint([
    ['site/src/pages/b.astro', '2'],
    ['site/src/pages/a.astro', '1'],
  ]);

  assert.equal(one, other);
});

test('a changed source file changes the fingerprint', () => {
  const before = fingerprint([['site/src/pages/index.astro', 'aaa']]);
  const after = fingerprint([['site/src/pages/index.astro', 'aab']]);

  assert.notEqual(before, after);
});

test('a tree matching the recorded green run needs no second run', () => {
  assert.equal(staleReason({ fingerprint: 'abc' }, 'abc'), undefined);
});

test('a tree that no recorded run measured is refused, and says what to run', () => {
  const reason = staleReason({ fingerprint: 'abc', recordedAt: '2026-10-16T08:00:00Z' }, 'xyz');

  assert.match(reason, /npm run gate:lh/);
  assert.match(reason, /2026-10-16T08:00:00Z/);
});

test('a missing record is refused too, because no run has ever been recorded', () => {
  assert.match(staleReason(undefined, 'xyz'), /no local lighthouse run/i);
});

test('a form factor with no report at all is refused by name', () => {
  const findings = evidenceFindings({ mobile: [], desktop: [reportFor('/', 1)] });

  assert.equal(findings.length, 1);
  assert.match(findings[0], /mobile/);
  assert.match(findings[0], /no lighthouse reports/i);
});

test('a category under 100 is refused, naming route, factor and category', () => {
  const low = reportFor('/pricing', 1);
  low.categories.seo.score = 0.98;

  const findings = evidenceFindings({ mobile: [low], desktop: [reportFor('/pricing', 1)] });

  assert.equal(findings.length, 1);
  assert.match(findings[0], /mobile \/pricing seo 98/);
});

test('four categories at 100 on both factors is evidence', () => {
  const findings = evidenceFindings({
    mobile: [reportFor('/', 1), reportFor('/pricing', 1)],
    desktop: [reportFor('/', 1), reportFor('/pricing', 1)],
  });

  assert.deepEqual(findings, []);
});

test('a report missing a category is refused rather than read as a pass', () => {
  const partial = reportFor('/', 1);
  delete partial.categories.accessibility;

  const findings = evidenceFindings({ mobile: [partial], desktop: [reportFor('/', 1)] });

  assert.equal(findings.length, 1);
  assert.match(findings[0], /accessibility/);
});

test('a route that is noindex by design is scored without is-crawlable, as the report scores it', () => {
  const search = {
    finalUrl: 'http://127.0.0.1:4330/search',
    categories: {
      performance: { score: 1 },
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      seo: {
        score: 0.66,
        auditRefs: [
          { id: 'is-crawlable', weight: 4.2 },
          { id: 'document-title', weight: 1 },
        ],
      },
    },
    audits: { 'is-crawlable': { score: 0 }, 'document-title': { score: 1 } },
  };

  assert.deepEqual(evidenceFindings({ mobile: [search], desktop: [search] }), []);
});
