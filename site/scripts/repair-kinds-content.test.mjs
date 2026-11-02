import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { CONTENT_KINDS } from './repair-kinds-content.mjs';

const DECIDED = {
  'h1-count': ['rewrite'],
  'h1-query': ['rewrite'],
  'query-opening': ['rewrite'],
  'paragraph-words': ['rewrite'],
  'sentence-length': ['rewrite'],
  'median-sentence': ['rewrite', 'words-down'],
  'banned-phrase': ['rewrite'],
  'unsourced-number': ['rewrite'],
  takeaways: ['rewrite', 'takeaways'],
  'table-or-figure': ['rewrite'],
  'inbound-links': ['refuse'],
  'outbound-links': ['refuse'],
  'question-headings': ['rewrite'],
  'updated-date': ['refuse'],
  'formulaic-transition': ['rewrite'],
  'not-only-but-also': ['rewrite'],
  'guide-preamble': ['rewrite'],
  'hollow-credential': ['rewrite'],
  'semicolon-density': ['rewrite'],
  'em-dash-density': ['rewrite'],
  'rhetorical-question-run': ['rewrite'],
  'duplicate-sentence': ['shared'],
  'query-without-route': ['refuse'],
  'route-without-query': ['refuse'],
  'duplicate-query': ['refuse'],
  'title-missing': ['refuse'],
  'title-suffix': ['refuse'],
  'title-stem': ['rewrite'],
  'doc-drift': ['refuse'],
  'doc-drift-structure': ['refuse'],
  'buyer-prompt-must-win-missing': ['refuse'],
  'buyer-prompt-passage-missing': ['refuse'],
  'published-against-a-decision': ['rewrite'],
  'booking-cta-missing': ['refuse'],
};

const oneSentence = (why) => {
  assert.equal(typeof why, 'string');
  assert.match(why, /^[A-Z0-9][^\n]*[.]$/);
  assert.ok(why.length <= 240, `${why.length} characters`);
  assert.doesNotMatch(why, /[.!?]\s+[A-Z]/);
};

for (const [rule, [kind, ...may]] of Object.entries(DECIDED)) {
  test(`gate:content ${rule} is ${kind}${may.length > 0 ? `, may ${may.join(' and ')}` : ''}`, () => {
    const row = CONTENT_KINDS[rule];
    assert.ok(row, `the content table has no row for ${rule}`);
    assert.equal(row.repairable, kind !== 'refuse');
    assert.equal(row.how, kind === 'refuse' ? null : 'rewrite');
    assert.equal(row.shared === true, kind === 'shared');
    assert.equal(row.needs, undefined);
    assert.deepEqual([...row.may], may);
    oneSentence(row.why);
  });
}

test('the content table holds exactly the 34 rules of the content gate', () => {
  assert.deepEqual(Object.keys(CONTENT_KINDS).sort(), Object.keys(DECIDED).sort());
  assert.equal(Object.keys(CONTENT_KINDS).length, 34);
});

test('21 content rules are rewrites and 13 are refused', () => {
  const rows = Object.values(CONTENT_KINDS);
  assert.equal(rows.filter((row) => row.how === 'rewrite').length, 21);
  assert.equal(rows.filter((row) => !row.repairable).length, 13);
});

test('only duplicate-sentence is shared with other routes', () => {
  const shared = Object.entries(CONTENT_KINDS).filter(([, row]) => row.shared === true);
  assert.deepEqual(
    shared.map(([rule]) => rule),
    ['duplicate-sentence']
  );
});
