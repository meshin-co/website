import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { judgeFindings, listRows } from './repair-kinds.mjs';

const ENTRY = {
  slug: 'the-entry',
  format: 'article',
  route: '/blog/the-entry',
  paths: ['site/src/data/post/the-entry.md', 'docs/SEMANTIC-CORE.md'],
};
const FOREIGN = '/blog/another-post';

const finding = (rule, subjects) => ({ rule, subjects, detail: 'the detail', excerpt: 'the excerpt' });
const only = (gate, ...findings) => judgeFindings({ documents: [{ gate, findings }], entry: ENTRY });
const refusedFor = (result, rule) => {
  const item = result.refused.find((entry) => entry.rule === rule);
  assert.ok(item, `${rule} was not refused`);
  return item;
};
const accepted = (gate, found) => ({
  gate,
  rule: found.rule,
  subjects: found.subjects,
  detail: found.detail,
  excerpt: found.excerpt,
});

for (const row of listRows()) {
  const { gate, rule } = row;
  const partner = (subjects) => (row.needs === undefined ? [] : [finding(row.needs, subjects)]);
  const verdict = row.how ?? 'refused';

  test(`${gate} ${rule} is ${verdict}, judged for the entry, for another route and for no subject`, () => {
    const mine = finding(rule, [ENTRY.route]);
    const inside = only(gate, mine, ...partner([ENTRY.route]));
    if (row.how === null) {
      assert.deepEqual(inside.rewrite, []);
      assert.deepEqual(inside.restate, []);
      assert.equal(refusedFor(inside, rule).reason, 'not-prose');
      assert.equal(refusedFor(inside, rule).why, row.why);
    } else {
      assert.deepEqual(inside.refused, []);
      assert.deepEqual(
        inside[row.how].find((item) => item.rule === rule),
        accepted(gate, mine)
      );
      assert.equal(
        inside[row.how === 'rewrite' ? 'restate' : 'rewrite'].some((item) => item.rule === rule),
        false
      );
    }

    const elsewhere = only(gate, finding(rule, [FOREIGN]), ...partner([FOREIGN]));
    assert.deepEqual(elsewhere.rewrite, []);
    assert.deepEqual(elsewhere.restate, []);
    assert.equal(refusedFor(elsewhere, rule).reason, row.how === null ? 'not-prose' : 'outside-entry');

    const nowhere = only(gate, finding(rule, []), ...partner([]));
    assert.deepEqual(nowhere.rewrite, []);
    assert.deepEqual(nowhere.restate, []);
    const expected = row.how === null || row.needs !== undefined ? 'not-prose' : 'unattributed';
    assert.equal(refusedFor(nowhere, rule).reason, expected);
  });
}
