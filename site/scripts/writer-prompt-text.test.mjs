import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { claimFor } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { buildPrompt } from './writer-prompt.mjs';

const FACTS_FILE = 'site/content-facts.json';
const FORMATS = ['term', 'article'];
const RUN_DATE = '2026-11-02';

const roots = [];
const rootWithNumbers = (numbers) => {
  const root = makeRepo();
  roots.push(root);
  if (numbers !== undefined) {
    const facts = JSON.parse(readFileSync(join(root, FACTS_FILE), 'utf8'));
    writeFileSync(join(root, FACTS_FILE), JSON.stringify({ ...facts, numbers }));
  }
  return root;
};
after(() => roots.forEach(removeRepo));

const numbersParagraphs = (root, format) => {
  const { system } = buildPrompt({ repoRoot: root, claim: claimFor(format), runDate: RUN_DATE });
  return system.slice(system.indexOf('# Numbers'), system.indexOf('# Banned phrases')).trim().split('\n\n');
};

for (const format of FORMATS) {
  test(`the ${format} prompt tells an empty list of allowed numbers in one plain sentence: no other number is verified, so none is written`, () => {
    const [heading, body, rule] = numbersParagraphs(rootWithNumbers([]), format);
    assert.equal(heading, '# Numbers');
    assert.match(
      body,
      /^Write no number except years, dates and standard or article numbers \(.+\)\. No other number is verified, so write none\.$/
    );
    assert.ok(!body.includes('allowed numbers'));
    assert.match(rule, /^Any other figure fails the gate as unsourced-number\./);
  });

  test(`the ${format} prompt tells a list of allowed numbers whole, and the sentence of the empty list never shows beside it`, () => {
    const root = rootWithNumbers();
    const { numbers } = JSON.parse(readFileSync(join(root, FACTS_FILE), 'utf8'));
    assert.ok(numbers.length > 0);
    const [, body] = numbersParagraphs(root, format);
    assert.ok(body.endsWith(`, and the allowed numbers: ${numbers.join(', ')}.`));
    assert.ok(!body.includes('is verified'));
  });
}
