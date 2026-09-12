import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gateFindings, profileFor } from './content-gate.mjs';

test('route shape decides which profile a page is gated against', () => {
  assert.equal(profileFor('/blog/why-your-ai-pilot-never-reached-production'), 'article');
  assert.equal(profileFor('/blog'), 'page');
  assert.equal(profileFor('/blog/category/governance'), 'page');
  assert.equal(profileFor('/services/90-day-production-sprint'), 'offer');
  assert.equal(profileFor('/resources/ai-governance-starter-kit'), 'offer');
  assert.equal(profileFor('/case-studies/only-help-agentic-support'), 'offer');
  assert.equal(profileFor('/glossary/evals'), 'term');
  assert.equal(profileFor('/glossary'), 'page');
  assert.equal(profileFor('/pricing'), 'page');
});

test('link text and citation chrome outside the prose never counts as a shared sentence', () => {
  const chrome = 'Sources AI Risk Management Framework NIST ISO IEC 42001 Next step';
  const pages = ['/resources/a', '/resources/b'].map((route) => ({
    route,
    profile: 'page',
    text: `${chrome} Each page says its own thing here.`,
    lead: null,
    opening: 'Each page says its own thing here.',
    paragraphs: ['Each page says its own thing here.'],
    headings: { h1: ['Title'], sub: [] },
    links: { internal: ['/x'], external: [] },
    tables: 0,
    figures: 0,
    takeaways: 0,
    updated: null,
  }));

  assert.deepEqual(gateFindings(pages, { targetQuery: {}, numbers: [] }, []), []);
});

test('a sentence shared by two pages is reported once, naming both routes', () => {
  const shared = 'An AI register is the list of every AI system your company runs today.';
  const pages = ['/pricing', '/about'].map((route) => ({
    route,
    profile: 'page',
    text: shared,
    opening: shared,
    paragraphs: [shared],
    headings: { h1: ['Title'], sub: [] },
    links: { internal: ['/x'], external: [] },
    tables: 0,
    figures: 0,
    takeaways: 0,
    updated: null,
  }));

  const findings = gateFindings(pages, { targetQuery: {}, numbers: [] }, []);

  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ['duplicate-sentence']
  );
  assert.equal(findings[0].route, '/pricing + /about');
});
