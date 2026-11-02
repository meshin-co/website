import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { format as prettierFormat, resolveConfig } from 'prettier';

import { renderEntry } from './entry-files.mjs';
import { claimOf, DRAFTS, FORMATS, RUN_DATE, splitEntry } from './fixtures/entry-drafts.mjs';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const REPO = fileURLToPath(new URL('../..', import.meta.url));
const COLLECTION = { term: 'glossary', article: 'post' };

const render = (format, draft = DRAFTS[format]) => renderEntry({ claim: claimOf(format), draft, runDate: RUN_DATE });

test('text that YAML would read as something else survives the round trip as the same string', () => {
  const hostile = [
    'Who decides: the owner? - yes',
    '2026-11-02',
    'yes',
    'It\'s "quoted" and #hashed',
    '- starts like a list',
    '  padded  ',
    'null',
    'caf\u00e9 \u2014 dash',
  ];
  const draft = {
    ...DRAFTS.article,
    fields: { ...DRAFTS.article.fields, keyTakeaways: hostile, description: hostile[0], shortAnswer: hostile[3] },
  };
  const { frontmatter } = splitEntry(render('article', draft).text);

  assert.deepEqual(frontmatter.keyTakeaways, hostile);
  assert.equal(frontmatter.description, hostile[0]);
  assert.equal(frontmatter.shortAnswer, hostile[3]);
});

const liveKeys = (format) => {
  const dir = join(REPO, 'site/src/data', COLLECTION[format]);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => new Set(splitEntry(readFileSync(join(dir, name), 'utf8')).keys));
};

test('a rendered entry invents no key and omits none that every live entry of its collection carries', () => {
  for (const format of FORMATS) {
    const live = liveKeys(format);
    const known = new Set(live.flatMap((keys) => [...keys]));
    const common = [...known].filter((key) => live.every((keys) => keys.has(key)));
    const { keys } = splitEntry(render(format).text);

    assert.deepEqual(
      keys.filter((key) => !known.has(key)),
      [],
      `${format} invents a key`
    );
    assert.deepEqual(
      common.filter((key) => !keys.includes(key)),
      [],
      `${format} omits a key every live entry has`
    );
  }
});

const prettierOptions = async () => {
  const options = await resolveConfig(join(SITE, 'src/data/post/any.md'));
  return { ...options, plugins: [], overrides: [], parser: 'markdown' };
};

for (const format of FORMATS) {
  test(`a ${format} entry is stable under the formatter, and the formatter keeps what the front matter says`, async () => {
    const options = await prettierOptions();
    const { text } = render(format);
    const once = await prettierFormat(text, options);

    assert.equal(await prettierFormat(once, options), once);
    assert.deepEqual(splitEntry(once).frontmatter, splitEntry(text).frontmatter);
  });
}
