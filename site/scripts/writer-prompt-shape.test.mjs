import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { claimFor } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { buildPrompt } from './writer-prompt.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WRITE_COPY = 'site/.agents/skills/write-copy.md';
const WRITE_FOR_HUMANS = 'site/.agents/skills/write-for-humans.md';
const FORMATS = ['article', 'term'];

const NAMED_HERE = [
  [
    'a paragraph that closes by summarising itself',
    /end a paragraph on its last point, not on a sentence that says again what the paragraph said/,
  ],
  ['the same opening word on three paragraphs in a row', /Do not open three paragraphs in a row on the same word/],
  ['a section added only for balance', /Do not add a section only for balance/],
];

const STATED_ELSEWHERE = [
  ['an opening that announces the article', WRITE_COPY, 'guide preambles'],
  ['a list because three items were easy to generate', WRITE_COPY, 'because three items were easy to generate'],
  ['the not X, it is Y turn', WRITE_FOR_HUMANS, 'antithesis-template'],
  ['uniform sentence length', WRITE_FOR_HUMANS, 'sentence-variance'],
  ['uniform paragraph length', WRITE_FOR_HUMANS, 'paragraph-variance'],
  ['a conclusion that repeats the takeaways', WRITE_COPY, 'No recap paragraph'],
  ['a registered concept reworded for variety', WRITE_COPY, 'One spelling per concept, everywhere'],
];

const root = makeRepo();
after(() => removeRepo(root));

const system = (format) =>
  buildPrompt({ repoRoot: root, claim: claimFor(format), demandRow: undefined, runDate: '2026-11-02' }).system;
const shapeBullets = (text) => text.split('\n').filter((line) => line.startsWith('- shape of the prose'));
const sourceText = (file) => readFileSync(join(REPO, file), 'utf8').replace(/\s+/g, ' ');

for (const format of FORMATS) {
  test('the ' + format + ' prompt carries one shape bullet that names the three shapes no block states', () => {
    const bullets = shapeBullets(system(format));
    assert.equal(bullets.length, 1);
    for (const [shape, words] of NAMED_HERE) assert.match(bullets[0], words, shape);
  });

  test('the ' + format + ' shape bullet follows the length of the body and is one line', () => {
    const lines = system(format).split('\n');
    const at = lines.findIndex((line) => line.startsWith('- length of the body'));
    assert.ok(at > 0, 'no length bullet');
    assert.ok(lines[at + 1].startsWith('- shape of the prose'), 'the next line is not the shape bullet');
  });
}

test('every shape the bullet leaves out is stated by a file the prompt copies word for word', () => {
  for (const [shape, file, text] of STATED_ELSEWHERE) {
    assert.ok(
      sourceText(file).includes(text),
      shape + ': "' + text + '" is gone from ' + file + ', so the shape bullet must now name it'
    );
  }
});

test('the shape bullet repeats no rule that a block already states', () => {
  const [bullet] = shapeBullets(system('article'));
  assert.ok(bullet, 'no shape bullet');
  assert.doesNotMatch(bullet, /not only|not just|recap|takeaway|preamble|variance|spelling|three items/i);
});
