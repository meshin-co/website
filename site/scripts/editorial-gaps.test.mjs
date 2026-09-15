import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupByConcept, orphanEntities, indexableOnly, authoredRoutesOnly, renderGaps } from './editorial-gaps.mjs';

test('noindex utility routes are excluded, because nothing there competes for a query', () => {
  assert.deepEqual(
    indexableOnly([{ route: '/styleguide' }, { route: '/404' }, { route: '/about' }], ['/styleguide', '/404']),
    [{ route: '/about' }]
  );
});

test('unlinked uses group by concept, worst first, naming the routes', () => {
  const grouped = groupByConcept([
    { concept: 'Evals', route: '/a', definedBy: '/glossary/evals' },
    { concept: 'Evals', route: '/b', definedBy: '/glossary/evals' },
    { concept: 'AI register', route: '/c', definedBy: '/glossary/ai-register' },
  ]);
  assert.deepEqual(grouped, [
    { concept: 'Evals', definedBy: '/glossary/evals', routes: ['/a', '/b'] },
    { concept: 'AI register', definedBy: '/glossary/ai-register', routes: ['/c'] },
  ]);
});

test('an entity nothing links to is an orphan, and one with inbound mentions is not', () => {
  assert.deepEqual(
    orphanEntities([
      { entity: 'Evals', ownedBy: '/glossary/evals', mentionedBy: ['/a'] },
      { entity: 'Shadow AI', ownedBy: '/glossary/shadow-ai', mentionedBy: [] },
    ]),
    [{ entity: 'Shadow AI', ownedBy: '/glossary/shadow-ai', mentionedBy: [] }]
  );
});

test('the report states every count it claims and names the source of each', () => {
  const report = renderGaps({
    ledger: { rows: 10, unreviewed: 10, untraceable: 2, dead: 3 },
    concepts: [{ concept: 'Evals', definedBy: '/glossary/evals', routes: ['/a'] }],
    orphans: [{ entity: 'Shadow AI', ownedBy: '/glossary/shadow-ai', mentionedBy: [] }],
    promptGaps: ['how much does a fractional caio cost'],
  });
  assert.match(report, /10 rows/);
  assert.match(report, /Evals/);
  assert.match(report, /Shadow AI/);
  assert.match(report, /fractional caio cost/);
});

test('taxonomy hub leads are excluded, because the term is injected by the template not written by hand', () => {
  assert.deepEqual(
    authoredRoutesOnly([
      { route: '/blog/tag/ai-register' },
      { route: '/blog/category/governance' },
      { route: '/services' },
      { route: '/blog/a-real-post' },
    ]),
    [{ route: '/services' }, { route: '/blog/a-real-post' }]
  );
});
