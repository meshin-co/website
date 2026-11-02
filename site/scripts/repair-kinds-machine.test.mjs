import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { MACHINE_KINDS } from './repair-kinds-machine.mjs';

const DECIDED = [
  'humans-components-missing',
  'humans-component-absent',
  'llms-lists-noindex-page',
  'llms-size',
  'llms-omits-route',
  'llms-lists-inline',
  'llms-file-missing',
  'entry-coverage',
  'sitemap-lists-noindex-route',
  'sitemap-lastmod-missing',
  'sidecar-missing',
  'sidecar-content',
  'canonical-mismatch',
  'date-agreement',
  'empty-collection-surface',
  'hub-feed-link-missing',
  'feed-base-missing',
  'feed-coverage',
  'catalog-route-missing',
  'catalog-description-drift',
  'machine-header',
  'machine-file-unreferenced',
  'llms-corpus',
];

const oneSentence = (why) => {
  assert.equal(typeof why, 'string');
  assert.match(why, /^[A-Z0-9][^\n]*[.]$/);
  assert.ok(why.length <= 240, `${why.length} characters`);
  assert.doesNotMatch(why, /[.!?]\s+[A-Z]/);
};

for (const rule of DECIDED) {
  test(`gate:machine ${rule} is refused, because a generated surface is not prose`, () => {
    const row = MACHINE_KINDS[rule];
    assert.ok(row, `the machine table has no row for ${rule}`);
    assert.equal(row.repairable, false);
    assert.equal(row.how, null);
    assert.deepEqual([...row.may], []);
    assert.equal(row.shared, undefined);
    assert.equal(row.needs, undefined);
    oneSentence(row.why);
  });
}

test('the machine table holds exactly the 23 family ids of the machine gate', () => {
  assert.deepEqual(Object.keys(MACHINE_KINDS).sort(), [...DECIDED].sort());
  assert.equal(DECIDED.length, 23);
});

test('no two machine rows give the same reason', () => {
  const reasons = Object.values(MACHINE_KINDS).map((row) => row.why);
  assert.equal(new Set(reasons).size, reasons.length);
});
