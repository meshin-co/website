import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { claimFor } from './fixtures/writer-drafts.mjs';
import { parseBuyerPrompts } from './semantic-core.mjs';
import { PROMPT_SOURCES } from './writer-prompt.mjs';
import { readSources } from './writer-prompt-read.mjs';

const REPOSITORY = join(import.meta.dirname, '..', '..');
const DECLARED_KEYS = PROMPT_SOURCES.flatMap(({ take }) => take.filter(({ key }) => key).map(({ key }) => key)).sort();

for (const format of ['term', 'article']) {
  test(`the ${format} walk resolves every anchor of every source against the committed tree of the repository`, () => {
    const [prompt] = parseBuyerPrompts(readFileSync(join(REPOSITORY, 'docs/SEMANTIC-CORE.md'), 'utf8'));
    assert.ok(prompt, 'the committed core holds no buyer prompt');
    const claim = claimFor(format, { prompt: { number: prompt.number, text: 'the first buyer prompt' } });
    const { texts, data } = readSources({ repoRoot: REPOSITORY, claim, sources: PROMPT_SOURCES });
    assert.ok(texts.every(({ blocks }) => blocks.length > 0));
    assert.deepEqual(Object.keys(data).sort(), DECLARED_KEYS);
  });
}
