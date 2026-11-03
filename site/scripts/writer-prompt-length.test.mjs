import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { LENGTH_FILE, lengthFor } from './entry-length.mjs';
import { claimFor } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { WriterError } from './writer-error.mjs';
import { buildPrompt } from './writer-prompt.mjs';

const FORMATS = ['term', 'article'];
const roots = [];
const freshRoot = () => {
  const root = makeRepo();
  roots.push(root);
  return root;
};
after(() => roots.forEach(removeRepo));

const build = (root, format) =>
  buildPrompt({ repoRoot: root, claim: claimFor(format), demandRow: undefined, runDate: '2026-11-02' });
const recordOf = (root) => JSON.parse(readFileSync(join(root, LENGTH_FILE), 'utf8'));
const editRecord = (root, change) => {
  const record = recordOf(root);
  change(record);
  writeFileSync(join(root, LENGTH_FILE), JSON.stringify(record, null, 2));
};
const occurrences = (text, part) => text.split(part).length - 1;

const real = freshRoot();

for (const format of FORMATS) {
  test('the ' + format + ' prompt states the measured length of its body once, taken from the record', () => {
    const limits = lengthFor(recordOf(real), format);
    const { system } = build(real, format);
    const range = limits.targetFrom + ' to ' + limits.targetTo + ' words';
    assert.equal(occurrences(system, range), 1, range);
    assert.equal(occurrences(system, 'length of the body'), 1);
    assert.ok(system.includes('A body under ' + limits.wordsFloor + ' words'), 'the floor is not stated');
    assert.ok(system.includes('under ' + limits.sectionsFloor + ' sections'), 'the sections floor is not stated');
    assert.ok(
      system.includes('a section under ' + limits.sectionWordsFloor + ' words'),
      'the section floor is not stated'
    );
    assert.ok(system.includes('recorded in ' + LENGTH_FILE));
  });

  test(
    'the ' +
      format +
      ' prompt names the buyer prompt the entry is written for and says how to reach the length honestly',
    () => {
      const claim = claimFor(format);
      const { system } = build(real, format);
      assert.ok(system.includes('for buyer prompt ' + claim.prompt.number + ', "' + claim.prompt.text + '"'));
      assert.match(system, /Reach the length with more sections/);
      assert.match(
        system,
        /rests on a route from the request, a passage of the block of that buyer prompt or a source you cite/
      );
      assert.match(system, /A longer sentence leaves the sentence band, and a restated takeaway repeats a field/);
    }
  );
}

test('the length stated is the length of the format: the article range is not the term range', () => {
  const article = lengthFor(recordOf(real), 'article');
  const term = lengthFor(recordOf(real), 'term');
  assert.notDeepEqual([article.targetFrom, article.targetTo], [term.targetFrom, term.targetTo]);
  assert.ok(!build(real, 'term').system.includes(article.targetFrom + ' to ' + article.targetTo + ' words'));
  assert.ok(!build(real, 'article').system.includes(term.targetFrom + ' to ' + term.targetTo + ' words'));
});

test('a length edited in the record is the length the prompt states, so no number is typed into the prompt', () => {
  const root = freshRoot();
  const before = build(root, 'article').system;
  editRecord(root, (record) => {
    record.limits.article.targetTo += 777;
  });
  const after = build(root, 'article').system;
  const limits = lengthFor(recordOf(root), 'article');
  assert.notEqual(after, before);
  assert.ok(after.includes(limits.targetFrom + ' to ' + limits.targetTo + ' words'));
});

test('a record that holds no length for the format fails naming the format', () => {
  const root = freshRoot();
  editRecord(root, (record) => {
    delete record.limits.article;
  });
  assert.throws(
    () => build(root, 'article'),
    (error) => error instanceof WriterError && error.kind === 'config' && error.message.includes('"article"')
  );
});
